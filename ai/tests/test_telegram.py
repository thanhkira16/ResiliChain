"""Unit tests cho Telegram Bot Integration."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from src.integrations.telegram import TelegramClient


def test_telegram_is_configured():
    client = TelegramClient(bot_token="test_token", chat_id="12345")
    assert client.is_configured() is True

    unconfigured = TelegramClient(bot_token="", chat_id="")
    assert unconfigured.is_configured() is False


@patch("src.integrations.telegram.httpx.Client")
def test_send_order_risk_alert(mock_client_cls):
    mock_response = MagicMock()
    mock_response.is_success = True
    mock_http_client = MagicMock()
    mock_http_client.post.return_value = mock_response
    mock_client_cls.return_value.__enter__.return_value = mock_http_client

    client = TelegramClient(bot_token="test_token", chat_id="12345")
    success = client.send_order_risk_alert(
        po_number="PO-2026-999",
        sku="SKU-850760",
        sku_name="Lithium Battery Pack 48V",
        supplier_name="TNHH Pin Viet",
        delay_risk_score=75.5,
        summary="Don PO-2026-999 tre 10 ngay.",
        incident_id="INC-PO-2026-999",
    )

    assert success is True
    assert mock_http_client.post.called is True
    call_kwargs = mock_http_client.post.call_args.kwargs
    payload = call_kwargs.get("json", {})
    assert payload.get("chat_id") == "12345"
    assert "PO-2026-999" in payload.get("text", "")
    assert "75.5/100" in payload.get("text", "")


@patch("src.integrations.telegram.httpx.Client")
def test_send_supplier_risk_alert(mock_client_cls):
    mock_response = MagicMock()
    mock_response.is_success = True
    mock_http_client = MagicMock()
    mock_http_client.post.return_value = mock_response
    mock_client_cls.return_value.__enter__.return_value = mock_http_client

    client = TelegramClient(bot_token="test_token", chat_id="12345")
    success = client.send_supplier_risk_alert(
        supplier_id="SUP-01",
        supplier_name="Shimano Inc.",
        pors_score=62.4,
        risk_level="HIGH",
        status_label="Ca hai truc",
    )

    assert success is True
    assert mock_http_client.post.called is True
    call_kwargs = mock_http_client.post.call_args.kwargs
    payload = call_kwargs.get("json", {})
    assert payload.get("chat_id") == "12345"
    assert "Shimano Inc." in payload.get("text", "")
    assert "HIGH" in payload.get("text", "")
