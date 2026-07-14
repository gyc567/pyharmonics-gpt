"""Authentication helpers for API endpoints."""
import logging
from functools import wraps
from typing import Optional, Dict, Any, Callable
from flask import request, jsonify

from app.api.errors import AppError
from app.domain.enums import ErrorCode
from app.infra.supabase_client import (
    verify_user_token,
    reserve_user_quota,
    release_ledger_quota,
    create_analysis_record,
    update_analysis_record,
    upload_chart,
    get_chart_url,
    log_audit_event,
)

logger = logging.getLogger(__name__)


def get_auth_token() -> Optional[str]:
    """Extract Bearer token from Authorization header.

    Returns:
        Token string or None.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def require_auth(f: Callable) -> Callable:
    """Decorator to require valid Supabase auth token.

    Injects `user` dict into kwargs if valid.
    Returns 401 if missing or invalid.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = get_auth_token()
        if not token:
            return jsonify({
                "success": False,
                "error": {
                    "code": ErrorCode.UNAUTHORIZED.value,
                    "message": "Authorization header required.",
                    "retryable": False,
                }
            }), 401

        user = verify_user_token(token)
        if not user:
            return jsonify({
                "success": False,
                "error": {
                    "code": ErrorCode.UNAUTHORIZED.value,
                    "message": "Invalid or expired token.",
                    "retryable": False,
                }
            }), 401

        if user.get("status") != "active":
            return jsonify({
                "success": False,
                "error": {
                    "code": ErrorCode.UNAUTHORIZED.value,
                    "message": "Account suspended.",
                    "retryable": False,
                }
            }), 403

        kwargs["user"] = user
        return f(*args, **kwargs)
    return wrapper


def check_quota(user_id: str, analysis_id: str, units: int = 1) -> tuple[bool, int, Optional[str]]:
    """Reserve quota for analysis.

    Args:
        user_id: User UUID.
        analysis_id: Analysis UUID.
        units: Units to reserve.

    Returns:
        (success, remaining, ledger_id)
    """
    return reserve_user_quota(user_id, analysis_id, units)
