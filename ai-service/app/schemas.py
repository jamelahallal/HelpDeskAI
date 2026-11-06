from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

Priority = Literal["P1", "P2", "P3", "P4"]
Urgency = Literal["low", "medium", "high", "critical"]


class ArticleRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    title: str
    excerpt: str = ""


class TicketRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    title: str


class AnalyzeRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=8000)
    articles: list[ArticleRef] = []          # candidates from the knowledge base
    candidate_tickets: list[TicketRef] = []  # recent tickets, for duplicate detection


class Analysis(BaseModel):
    """What the model must return. Anything else is rejected."""
    category: str = Field(min_length=1, max_length=80)
    priority: Priority
    urgency: Urgency
    summary: str = Field(min_length=1, max_length=500)
    suggested_team: str = Field(min_length=1, max_length=80)
    suggested_article_ids: list[str] = []
    duplicate_ticket_ids: list[str] = []
    suggested_reply: str = Field(min_length=1, max_length=2000)


class AnalyzeResponse(Analysis):
    provider: str
    model: str