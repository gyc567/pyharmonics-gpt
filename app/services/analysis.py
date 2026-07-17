"""Analysis orchestrator: coordinates validation, detection, interpretation, charting."""
import logging
import time
import uuid
from types import SimpleNamespace
from typing import Optional
from app.domain.enums import Market, Interval, AnalysisType, Status, ErrorCode
from app.domain.schemas import (
    AnalyzeRequest,
    AnalysisData,
    TechnicalResult,
    Interpretation,
    ChartMeta,
    TimingInfo,
)
from app.domain.validators import (
    validate_symbol,
    validate_interval,
    validate_market,
    validate_analysis_type,
    validate_bounds,
)
from app.api.errors import AppError
from app.infra.pyharmonics_adapter import (
    fetch_market_data,
    detect_patterns,
    generate_chart,
    technical_result_to_schema,
)
from app.domain.signals import resolve_analysis_type
from app.services.signal_engine import build_signal, extract_candidates
from app.infra.supabase_client import upload_chart, get_chart_url
from app.services.chart import compress_chart, validate_chart_size
from app.openai_handler import query_openai

logger = logging.getLogger(__name__)


def _generate_interpretation(technical_json: str, prompt_context: str) -> Interpretation:
    """Generate model interpretation of technical results.

    Args:
        technical_json: JSON string of technical results.
        prompt_context: Developer prompt context for OpenAI.

    Returns:
        Interpretation schema.
    """
    try:
        raw_response = query_openai(technical_json, prompt_context)
        return Interpretation(
            sentiment=_extract_sentiment(raw_response),
            summary=raw_response[:500] if raw_response else None,
            raw_response=raw_response,
        )
    except Exception as e:
        logger.exception("Model interpretation failed")
        raise AppError(
            ErrorCode.MODEL_ERROR,
            "模型解读生成失败，技术结果仍可查看。",
            retryable=True,
            original_error=e,
        )


def _extract_sentiment(text: Optional[str]) -> Optional[str]:
    """Extract sentiment keyword from model response.

    Args:
        text: Raw model response text.

    Returns:
        Sentiment string or None.
    """
    if not text:
        return None
    text_lower = text.lower()
    if "bull" in text_lower or "多" in text:
        return "bullish"
    elif "bear" in text_lower or "空" in text:
        return "bearish"
    elif "neutral" in text_lower or "中性" in text:
        return "neutral"
    return None


class AnalysisOrchestrator:
    """Orchestrates the full analysis pipeline."""

    def __init__(self, prompt_context: Optional[dict] = None):
        """Initialize orchestrator.

        Args:
            prompt_context: Loaded prompt_intent.yaml dict.
        """
        self.prompt_context = prompt_context or {}

    @staticmethod
    def _build_trade_signal(candle_data, interval, detection_result: dict,
                            limit_to: int = 10, percent_complete: float = 0.8):
        """Build a trade signal from the detection result (best-effort).

        Signal generation never blocks the analysis pipeline: any failure is
        logged and results in no signal attached.
        """
        try:
            candidates = extract_candidates(detection_result)
            if not candidates:
                return None

            def detect_on_slice(slice_df):
                """Re-run pattern detection on a sub-window (stability check)."""
                try:
                    proxy = SimpleNamespace(
                        df=slice_df,
                        symbol=candle_data.symbol,
                        interval=candle_data.interval,
                    )
                    det = detect_patterns(
                        proxy,
                        limit_to=limit_to,
                        percent_complete=percent_complete,
                        analysis_type="forming",
                    )
                    sub_candidates = extract_candidates(det)
                    return sub_candidates[0].name if sub_candidates else None
                except Exception:
                    return None

            return build_signal(
                df=candle_data.df,
                interval=interval.value,
                candidates=candidates,
                divergences=detection_result.get("divergences", {}),
                stability_detector=detect_on_slice,
            )
        except Exception:
            logger.exception("Signal engine failed, continuing without signal")
            return None

    def analyze(self, request: AnalyzeRequest, user_id: Optional[str] = None, analysis_id: Optional[str] = None) -> AnalysisData:
        """Run full analysis pipeline.

        Pipeline:
        1. Validate inputs
        2. Fetch market data
        3. Detect patterns
        4. Generate interpretation (optional)
        5. Generate chart and upload to Storage
        6. Build response

        Args:
            request: Validated analyze request.
            user_id: Optional user ID for chart upload.
            analysis_id: Optional analysis ID for chart upload.

        Returns:
            AnalysisData with results.

        Raises:
            AppError: On any pipeline failure.
        """
        start_time = time.time()
        if analysis_id is None:
            analysis_id = str(uuid.uuid4())[:12]

        # Step 1: Validate
        market = validate_market(request.market.value)
        symbol = validate_symbol(request.symbol)
        interval = validate_interval(request.interval.value)
        analysis_type = validate_analysis_type(request.analysis_type.value)
        validate_bounds(request.limit_to, request.percent_complete, request.candles)

        timing = TimingInfo(
            started_at=str(int(start_time)),
        )

        # Step 2: Fetch market data
        try:
            candle_data = fetch_market_data(
                market=market,
                symbol=symbol,
                interval=interval,
                candles=request.candles,
            )
        except AppError:
            raise

        # Step 3: Detect patterns
        detection_result = detect_patterns(
            candle_data=candle_data,
            limit_to=request.limit_to,
            percent_complete=request.percent_complete,
            analysis_type=analysis_type.value,
        )

        # Check if any patterns found
        has_patterns = detection_result.get("position") is not None
        if not has_patterns:
            # No patterns is a valid terminal state
            technical = technical_result_to_schema(detection_result)
            timing.duration_ms = int((time.time() - start_time) * 1000)
            timing.completed_at = str(int(time.time()))

            return AnalysisData(
                analysis_id=analysis_id,
                status=Status.NO_RESULT,
                market=market,
                symbol=symbol,
                interval=interval,
                analysis_type=analysis_type,
                parameters=request.model_dump(),
                technical_result=technical,
                timing=timing,
            )

        # Step 4: Technical result (+ executable trade signal, best-effort)
        signal = self._build_trade_signal(
            candle_data,
            interval,
            detection_result,
            limit_to=request.limit_to,
            percent_complete=request.percent_complete,
        )
        technical = technical_result_to_schema(
            detection_result,
            signal=signal.to_dict() if signal else None,
        )
        # resolved_type: what the engine actually used (auto mode's answer).
        # request value stays in AnalysisData.analysis_type unchanged.
        technical.resolved_type = resolve_analysis_type(signal)

        # Step 5: Interpretation (optional - can fail without failing whole analysis)
        interpretation = Interpretation()
        try:
            tech_json = technical.model_dump_json()
            prompt = self.prompt_context.get("technical_analysis", "")
            if prompt:
                interpretation = _generate_interpretation(tech_json, prompt)
        except AppError as e:
            if e.code == ErrorCode.MODEL_ERROR:
                logger.warning("Interpretation failed, continuing with technical results only")
                interpretation = Interpretation(
                    summary="模型解读暂时不可用，请参考技术结果。",
                )
            else:
                raise

        # Step 6: Chart
        chart = ChartMeta()
        try:
            chart = generate_chart(
                detection_result,
                dpi=150,
                max_width=1200,
                max_height=800,
            )
            # Attempt to compress if plot has to_image
            plot = detection_result.get("plot") or detection_result.get("plot_fallback")
            if plot and hasattr(plot, "to_image"):
                raw_bytes = plot.to_image(dpi=150)
                if raw_bytes:
                    compressed, chart_meta = compress_chart(raw_bytes)
                    if validate_chart_size(compressed):
                        chart = chart_meta
                        # Upload to Supabase Storage if user_id provided
                        if user_id and analysis_id:
                            try:
                                storage_path = upload_chart(user_id, analysis_id, compressed)
                                if storage_path:
                                    signed_url = get_chart_url(storage_path, expires_in=300)
                                    chart.path = storage_path
                                    chart.url = signed_url
                                    logger.info("Chart uploaded to Storage: %s", storage_path)
                                else:
                                    logger.warning("Chart upload returned None, using local data")
                            except Exception as e:
                                logger.warning("Chart upload failed: %s", e)
                                # Continue without URL - chart data still in response
                    else:
                        logger.warning("Chart exceeds size limit, omitting")
                        chart = ChartMeta(format="png", path=None, url=None)
        except AppError as e:
            if e.code == ErrorCode.CHART_ERROR:
                logger.warning("Chart generation failed, continuing without chart")
                chart = ChartMeta(format="png", path=None, url=None)
            else:
                raise

        # Finalize timing
        timing.duration_ms = int((time.time() - start_time) * 1000)
        timing.completed_at = str(int(time.time()))

        return AnalysisData(
            analysis_id=analysis_id,
            status=Status.COMPLETED,
            market=market,
            symbol=symbol,
            interval=interval,
            analysis_type=analysis_type,
            parameters=request.model_dump(),
            technical_result=technical,
            interpretation=interpretation,
            chart=chart,
            timing=timing,
        )
