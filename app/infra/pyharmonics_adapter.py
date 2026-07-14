"""Pyharmonics adapter: wraps all pyharmonics calls and converts exceptions."""
import logging
from typing import Any, Optional

# Import pyharmonics classes at module level for testability
from pyharmonics.marketdata import YahooCandleData, BinanceCandleData
from pyharmonics.technicals import OHLCTechnicals
from pyharmonics.search import HarmonicSearch, DivergenceSearch
from pyharmonics.plotter import HarmonicPlotter, PositionPlotter
from pyharmonics.positions import Position

from app.api.errors import AppError, ErrorCode
from app.domain.enums import Market, Interval, Status
from app.domain.schemas import TechnicalResult, ChartMeta

logger = logging.getLogger(__name__)


def fetch_market_data(
    market: Market,
    symbol: str,
    interval: Interval,
    candles: int = 1000,
) -> Any:
    """Fetch candle data from market source.

    Args:
        market: Market source enum.
        symbol: Uppercase symbol.
        interval: Candle interval.
        candles: Number of candles to fetch.

    Returns:
        Candle data object (YahooCandleData or BinanceCandleData).

    Raises:
        AppError: If market data is unavailable.
    """
    try:
        if market == Market.BINANCE:
            cd = BinanceCandleData()
            cd.get_candles(symbol, interval.value, candles)
            return cd
        elif market == Market.YAHOO:
            cd = YahooCandleData()
            cd.get_candles(symbol, interval.value, candles)
            return cd
        else:
            raise AppError(
                ErrorCode.INVALID_PARAMS,
                f"Market '{market.value}' is not supported for data fetching.",
            )
    except AppError:
        raise
    except Exception as e:
        logger.exception("Failed to fetch market data for %s/%s", market.value, symbol)
        raise AppError(
            ErrorCode.MARKET_DATA_UNAVAILABLE,
            f"暂时无法获取 {symbol} 的行情数据，请稍后重试。",
            retryable=True,
            original_error=e,
        )


def detect_patterns(
    candle_data: Any,
    limit_to: int = 10,
    percent_complete: float = 0.8,
    analysis_type: str = "forming",
) -> dict:
    """Run harmonic and divergence pattern detection.

    Args:
        candle_data: Candle data object with .df, .symbol, .interval.
        limit_to: Pattern limit.
        percent_complete: Formation completion ratio.
        analysis_type: Type of analysis (forming/formed/divergence).

    Returns:
        Dict with technical results including patterns, divergences, position.

    Raises:
        AppError: If detection fails.
    """
    try:
        t = OHLCTechnicals(candle_data.df, candle_data.symbol, candle_data.interval)
        hs = HarmonicSearch(t)
        d = DivergenceSearch(t)
        p = HarmonicPlotter(t)

        if analysis_type == "forming":
            hs.forming(limit_to=limit_to, percent_c_to_d=percent_complete)
        hs.search(limit_to=limit_to)
        d.search(limit_to=limit_to)

        p.add_peaks()
        p.add_harmonic_plots(hs.get_patterns(family=hs.XABCD))
        p.add_harmonic_plots(hs.get_patterns(family=hs.ABCD))
        p.add_harmonic_plots(hs.get_patterns(family=hs.ABC))
        p.add_divergence_plots(d.get_patterns())

        # Extract patterns
        assessment = {
            "forming": hs.get_patterns(formed=False),
            "patterns": hs.get_patterns(),
        }

        divergences = {
            family: [pa.to_dict() for pa in found[-1:]]
            for family, found in d.get_patterns().items()
        }

        result = {
            "divergences": divergences,
            "patterns": {},
            "position": None,
            "plot": None,
        }

        # Find best pattern
        pattern = None
        if assessment["patterns"].get(hs.XABCD):
            pattern = assessment["patterns"][hs.XABCD][0]
            result["patterns"]["family"] = "XABCD"
        elif assessment["patterns"].get(hs.ABCD):
            pattern = assessment["patterns"][hs.ABCD][0]
            result["patterns"]["family"] = "ABCD"
        elif assessment["patterns"].get(hs.ABC):
            pattern = assessment["patterns"][hs.ABC][0]
            result["patterns"]["family"] = "ABC"
        elif assessment["forming"].get(hs.XABCD):
            pattern = assessment["forming"][hs.XABCD][0]
            result["patterns"]["family"] = "XABCD"
            result["patterns"]["forming"] = True
        elif assessment["forming"].get(hs.ABCD):
            pattern = assessment["forming"][hs.ABCD][0]
            result["patterns"]["family"] = "ABCD"
            result["patterns"]["forming"] = True
        elif assessment["forming"].get(hs.ABC):
            pattern = assessment["forming"][hs.ABC][0]
            result["patterns"]["family"] = "ABC"
            result["patterns"]["forming"] = True

        if pattern:
            strike = (pattern.completion_min_price + pattern.completion_max_price) / 2
            position = Position(pattern, strike=strike, dollar_amount=100)
            pos_plot = PositionPlotter(t, position)
            pos_plot.add_divergence_plots(d.get_patterns())
            result["position"] = position
            result["plot"] = pos_plot
            result["patterns"]["direction"] = getattr(pattern, "direction", None)
            result["patterns"]["completion_min"] = getattr(pattern, "completion_min_price", None)
            result["patterns"]["completion_max"] = getattr(pattern, "completion_max_price", None)

        result["plot_fallback"] = p
        return result

    except AppError:
        raise
    except Exception as e:
        logger.exception("Pattern detection failed")
        raise AppError(
            ErrorCode.INTERNAL_ERROR,
            "形态检测过程中发生错误。",
            retryable=True,
            original_error=e,
        )


def generate_chart(
    detection_result: dict,
    dpi: int = 150,
    max_width: int = 1200,
    max_height: int = 800,
) -> ChartMeta:
    """Generate chart image from detection result.

    Args:
        detection_result: Result from detect_patterns.
        dpi: DPI for chart rendering.
        max_width: Maximum width in pixels.
        max_height: Maximum height in pixels.

    Returns:
        ChartMeta with image metadata.

    Raises:
        AppError: If chart generation fails.
    """
    try:
        plot = detection_result.get("plot") or detection_result.get("plot_fallback")
        if plot is None:
            raise AppError(
                ErrorCode.CHART_ERROR,
                "No plot data available for chart generation.",
            )

        image_bytes = plot.to_image(dpi=dpi)
        if not image_bytes:
            raise AppError(
                ErrorCode.CHART_ERROR,
                "Chart rendering returned empty data.",
            )

        # Estimate dimensions (rough: dpi * inches, matplotlib default ~8x6)
        width = min(int(dpi * 8), max_width)
        height = min(int(dpi * 6), max_height)

        return ChartMeta(
            format="png",
            width=width,
            height=height,
            path=None,
            url=None,
        )

    except AppError:
        raise
    except Exception as e:
        logger.exception("Chart generation failed")
        raise AppError(
            ErrorCode.CHART_ERROR,
            "图表生成失败，结构化结果仍可查看。",
            retryable=True,
            original_error=e,
        )


def technical_result_to_schema(detection_result: dict) -> TechnicalResult:
    """Convert raw detection result to TechnicalResult schema.

    Args:
        detection_result: Raw dict from detect_patterns.

    Returns:
        TechnicalResult schema instance.
    """
    position = detection_result.get("position")
    patterns = detection_result.get("patterns", {})

    result = TechnicalResult(
        pattern_family=patterns.get("family"),
        pattern_type="forming" if patterns.get("forming") else "formed",
        direction=patterns.get("direction"),
        divergences=detection_result.get("divergences", {}),
        raw_patterns=patterns,
    )

    if position:
        result.entry_price = getattr(position, "strike", None)
        result.stop_loss = getattr(position, "stop_loss", None)
        result.target_price = getattr(position, "target", None)
        result.risk_reward_ratio = getattr(position, "risk_reward", None)

    return result
