"""Pydantic schemas for the AI Trading Assistant (Vibe) module."""
from typing import Any, Optional
from pydantic import BaseModel, Field


class VibeSession(BaseModel):
    """A vibe session."""

    id: str
    user_id: str
    title: Optional[str] = None
    status: str = "active"
    context: dict = Field(default_factory=dict)
    summary: Optional[str] = None
    message_count: int = 0
    last_message_at: Optional[str] = None
    created_at: str
    updated_at: str


class VibeMessage(BaseModel):
    """A single message in a vibe session."""

    id: str
    session_id: str
    run_id: Optional[str] = None
    role: str  # system, user, assistant, tool
    content: Optional[str] = None
    tool_calls: Optional[list[dict]] = None
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None
    tool_input: Optional[dict] = None
    tool_output_ref: Optional[str] = None
    tool_output_summary: Optional[dict] = None
    cards: Optional[list[dict]] = None
    event_id: Optional[str] = None
    created_at: str


class VibeRun(BaseModel):
    """A single agent run."""

    id: str
    session_id: str
    user_id: str
    status: str
    tool_trace: list[dict] = Field(default_factory=list)
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    duration_ms: Optional[int] = None
    user_prompt: Optional[str] = None
    system_prompt_version: Optional[str] = None
    model: Optional[str] = None
    decision_basis: Optional[dict] = None
    error: Optional[str] = None
    cancelled_by: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class CreateSessionRequest(BaseModel):
    """Request to create a new vibe session."""

    title: Optional[str] = Field(default=None, max_length=200)
    context: dict = Field(default_factory=dict)


class CreateSessionResponse(BaseModel):
    """Response after creating a session."""

    session: VibeSession


class SendMessageRequest(BaseModel):
    """Request to send a message in a session."""

    content: str = Field(..., min_length=1, max_length=4000)
    attachments: list[dict] = Field(default_factory=list)


class SendMessageResponse(BaseModel):
    """Response after sending a message (non-streaming)."""

    run_id: str
    status: str


class VibeEvent(BaseModel):
    """A single event in the vibe event stream."""

    event_id: str
    run_id: str
    type: str  # run_started, tool_call_start, tool_call_end, delta, card, done, error
    content: Optional[str] = None
    call_id: Optional[str] = None
    tool: Optional[str] = None
    input: Optional[dict] = None
    output: Optional[dict] = None
    card_type: Optional[str] = None
    payload: Optional[dict] = None
    status: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    duration_ms: Optional[int] = None
    code: Optional[str] = None
    message: Optional[str] = None
    retryable: Optional[bool] = None


class PollEventsResponse(BaseModel):
    """Response for polling run events."""

    run_id: str
    status: str
    events: list[VibeEvent]
    has_more: bool


class ToolRequest(BaseModel):
    """Request to invoke a tool directly."""

    input: dict = Field(default_factory=dict)


class ToolResponse(BaseModel):
    """Response from a direct tool invocation."""

    success: bool = True
    data: Optional[dict] = None
    error: Optional[dict] = None


class VibeErrorDetail(BaseModel):
    """Standard error detail for vibe APIs."""

    code: str
    message: str
    retryable: bool = False
    request_id: Optional[str] = None
