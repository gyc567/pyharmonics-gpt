"""Integration tests for new API endpoints."""
import pytest
from unittest.mock import MagicMock, patch

from app.main import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"
        assert data["version"] == "0.2.0"
        assert "timestamp" in data


class TestMarketsEndpoint:
    def test_markets_returns_all(self, client):
        resp = client.get("/api/markets")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "markets" in data
        assert "intervals" in data
        assert "analysis_types" in data
        assert "binance" in data["markets"]
        assert "yahoo" in data["markets"]
        assert "1d" in data["intervals"]
        assert "forming" in data["analysis_types"]


class TestAnalyzeEndpoint:
    def test_analyze_missing_body(self, client):
        resp = client.post("/api/analyze")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_PARAMS"

    def test_analyze_empty_json(self, client):
        resp = client.post("/api/analyze", json={})
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_PARAMS"

    def test_analyze_invalid_symbol(self, client):
        resp = client.post("/api/analyze", json={
            "market": "binance",
            "symbol": "",
            "interval": "1d",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False

    def test_analyze_invalid_market(self, client):
        resp = client.post("/api/analyze", json={
            "market": "kraken",
            "symbol": "BTCUSDT",
            "interval": "1d",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False

    def test_analyze_invalid_interval(self, client):
        resp = client.post("/api/analyze", json={
            "market": "binance",
            "symbol": "BTCUSDT",
            "interval": "5m",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False

    @patch("app.main.orchestrator")
    def test_analyze_success_no_patterns(self, mock_orch, client):
        from app.domain.enums import Status, Market, Interval, AnalysisType
        from app.domain.schemas import AnalysisData, TechnicalResult, TimingInfo

        mock_orch.analyze.return_value = AnalysisData(
            analysis_id="test123",
            status=Status.NO_RESULT,
            market=Market.BINANCE,
            symbol="BTCUSDT",
            interval=Interval.D1,
            analysis_type=AnalysisType.FORMING,
            technical_result=TechnicalResult(),
            timing=TimingInfo(duration_ms=1000),
        )

        resp = client.post("/api/analyze", json={
            "market": "binance",
            "symbol": "BTCUSDT",
            "interval": "1d",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["status"] == "no_result"
        assert data["data"]["symbol"] == "BTCUSDT"

    @patch("app.main.orchestrator")
    def test_analyze_success_with_patterns(self, mock_orch, client):
        from app.domain.enums import Status, Market, Interval, AnalysisType
        from app.domain.schemas import (
            AnalysisData, TechnicalResult, ChartMeta, TimingInfo
        )

        mock_orch.analyze.return_value = AnalysisData(
            analysis_id="test456",
            status=Status.COMPLETED,
            market=Market.BINANCE,
            symbol="BTCUSDT",
            interval=Interval.D1,
            analysis_type=AnalysisType.FORMING,
            technical_result=TechnicalResult(
                pattern_family="XABCD",
                entry_price=100.0,
            ),
            chart=ChartMeta(format="png", width=1200, height=800),
            timing=TimingInfo(duration_ms=5000),
        )

        resp = client.post("/api/analyze", json={
            "market": "binance",
            "symbol": "BTCUSDT",
            "interval": "1d",
            "analysis_type": "forming",
            "limit_to": 10,
            "percent_complete": 0.8,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["status"] == "completed"
        assert data["data"]["technical_result"]["pattern_family"] == "XABCD"

    @patch("app.main.orchestrator")
    def test_analyze_market_data_error(self, mock_orch, client):
        from app.api.errors import AppError
        from app.domain.enums import ErrorCode

        mock_orch.analyze.side_effect = AppError(
            ErrorCode.MARKET_DATA_UNAVAILABLE,
            "暂时无法获取行情",
            retryable=True,
        )

        resp = client.post("/api/analyze", json={
            "market": "binance",
            "symbol": "BTCUSDT",
            "interval": "1d",
        })
        assert resp.status_code == 503
        data = resp.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "MARKET_DATA_UNAVAILABLE"
        assert data["error"]["retryable"] is True

    @patch("app.main.orchestrator")
    def test_analyze_internal_error(self, mock_orch, client):
        mock_orch.analyze.side_effect = RuntimeError("Unexpected")

        resp = client.post("/api/analyze", json={
            "market": "binance",
            "symbol": "BTCUSDT",
            "interval": "1d",
        })
        assert resp.status_code == 500
        data = resp.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "INTERNAL_ERROR"
        assert "request_id" in data["error"]

    def test_analyze_yahoo_market(self, client):
        with patch("app.main.orchestrator.analyze") as mock_analyze:
            from app.domain.enums import Status, Market, Interval, AnalysisType
            from app.domain.schemas import AnalysisData, TechnicalResult, TimingInfo

            mock_analyze.return_value = AnalysisData(
                analysis_id="yahoo123",
                status=Status.NO_RESULT,
                market=Market.YAHOO,
                symbol="AAPL",
                interval=Interval.D1,
                analysis_type=AnalysisType.FORMING,
                technical_result=TechnicalResult(),
                timing=TimingInfo(duration_ms=1000),
            )

            resp = client.post("/api/analyze", json={
                "market": "yahoo",
                "symbol": "AAPL",
                "interval": "1d",
            })
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["data"]["market"] == "yahoo"
            assert data["data"]["symbol"] == "AAPL"

    def test_analyze_custom_params(self, client):
        with patch("app.main.orchestrator.analyze") as mock_analyze:
            from app.domain.enums import Status, Market, Interval, AnalysisType
            from app.domain.schemas import AnalysisData, TechnicalResult, TimingInfo

            mock_analyze.return_value = AnalysisData(
                analysis_id="custom123",
                status=Status.COMPLETED,
                market=Market.BINANCE,
                symbol="ETHUSDT",
                interval=Interval.H4,
                analysis_type=AnalysisType.FORMED,
                technical_result=TechnicalResult(),
                timing=TimingInfo(duration_ms=2000),
            )

            resp = client.post("/api/analyze", json={
                "market": "binance",
                "symbol": "ETHUSDT",
                "interval": "4h",
                "analysis_type": "formed",
                "limit_to": 5,
                "percent_complete": 0.9,
                "candles": 2000,
            })
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["success"] is True

    def test_analyze_idempotency_key(self, client):
        with patch("app.main.orchestrator.analyze") as mock_analyze:
            from app.domain.enums import Status, Market, Interval, AnalysisType
            from app.domain.schemas import AnalysisData, TechnicalResult, TimingInfo

            mock_analyze.return_value = AnalysisData(
                analysis_id="idem123",
                status=Status.COMPLETED,
                market=Market.BINANCE,
                symbol="BTCUSDT",
                interval=Interval.D1,
                analysis_type=AnalysisType.FORMING,
                technical_result=TechnicalResult(),
                timing=TimingInfo(duration_ms=1000),
            )

            resp = client.post("/api/analyze", json={
                "market": "binance",
                "symbol": "BTCUSDT",
                "interval": "1d",
                "idempotency_key": "my-key-123",
            })
            assert resp.status_code == 200
            # Verify the request was parsed correctly
            call_args = mock_analyze.call_args[0][0]
            assert call_args.idempotency_key == "my-key-123"

    def test_analyze_formed_analysis_type(self, client):
        with patch("app.main.orchestrator.analyze") as mock_analyze:
            from app.domain.enums import Status, Market, Interval, AnalysisType
            from app.domain.schemas import AnalysisData, TechnicalResult, TimingInfo

            mock_analyze.return_value = AnalysisData(
                analysis_id="formed123",
                status=Status.COMPLETED,
                market=Market.BINANCE,
                symbol="BTCUSDT",
                interval=Interval.W1,
                analysis_type=AnalysisType.FORMED,
                technical_result=TechnicalResult(),
                timing=TimingInfo(duration_ms=1000),
            )

            resp = client.post("/api/analyze", json={
                "market": "binance",
                "symbol": "BTCUSDT",
                "interval": "1w",
                "analysis_type": "formed",
            })
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["data"]["analysis_type"] == "formed"

    def test_analyze_divergence_type(self, client):
        with patch("app.main.orchestrator.analyze") as mock_analyze:
            from app.domain.enums import Status, Market, Interval, AnalysisType
            from app.domain.schemas import AnalysisData, TechnicalResult, TimingInfo

            mock_analyze.return_value = AnalysisData(
                analysis_id="div123",
                status=Status.COMPLETED,
                market=Market.YAHOO,
                symbol="TSLA",
                interval=Interval.H1,
                analysis_type=AnalysisType.DIVERGENCE,
                technical_result=TechnicalResult(),
                timing=TimingInfo(duration_ms=1000),
            )

            resp = client.post("/api/analyze", json={
                "market": "yahoo",
                "symbol": "TSLA",
                "interval": "1h",
                "analysis_type": "divergence",
            })
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["data"]["analysis_type"] == "divergence"
