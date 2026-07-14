"""API error definitions and formatting."""
import uuid
from typing import Optional
from app.domain.enums import ErrorCode


class AppError(Exception):
    """Application-level error with structured code and message."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        retryable: bool = False,
        request_id: Optional[str] = None,
        original_error: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.request_id = request_id or str(uuid.uuid4())[:8]
        self.original_error = original_error

    def to_dict(self) -> dict:
        """Convert to standard error response dict."""
        return {
            "success": False,
            "error": {
                "code": self.code.value,
                "message": self.message,
                "retryable": self.retryable,
                "request_id": self.request_id,
            },
        }


def format_error(
    code: ErrorCode,
    message: str,
    retryable: bool = False,
    request_id: Optional[str] = None,
) -> dict:
    """Format a standard error response dict.

    Args:
        code: Error code enum.
        message: Human-readable error message.
        retryable: Whether the client should retry.
        request_id: Unique request identifier.

    Returns:
        Standard error response dict.
    """
    return {
        "success": False,
        "error": {
            "code": code.value,
            "message": message,
            "retryable": retryable,
            "request_id": request_id or str(uuid.uuid4())[:8],
        },
    }


def map_exception_to_error(exc: Exception, request_id: Optional[str] = None) -> AppError:
    """Map unknown exceptions to structured AppError.

    Args:
        exc: Original exception.
        request_id: Optional request ID.

    Returns:
        AppError with INTERNAL_ERROR code.
    """
    return AppError(
        code=ErrorCode.INTERNAL_ERROR,
        message="An unexpected error occurred. Please try again later.",
        retryable=True,
        request_id=request_id,
        original_error=exc,
    )
