import hmac
from fastapi import FastAPI, Header, HTTPException
from pydantic import ValidationError

from . import config
import hmac
from fastapi import FastAPI, Header, HTTPException
from fastembed import TextEmbedding
from pydantic import BaseModel, Field, ValidationError

from . import config
from .providers.fake_provider import FakeProvider
from .providers.groq_provider import GroqProvider, ProviderError
from .schemas import Analysis, AnalyzeRequest, AnalyzeResponse

app = FastAPI(title="HelpDeskAI analysis service")

_embedder = TextEmbedding("BAAI/bge-small-en-v1.5")


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


@app.post("/embed")
def embed(req: EmbedRequest, x_service_token: str = Header(default="")):
    if config.AI_SERVICE_TOKEN and not hmac.compare_digest(x_service_token, config.AI_SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="unauthorized")
    return {"vectors": [v.tolist() for v in _embedder.embed(req.texts)]}


def get_provider():
    if config.AI_PROVIDER == "groq":
        return GroqProvider(config.GROQ_API_KEY, config.GROQ_MODEL, config.AI_TIMEOUT_SECONDS)
    return FakeProvider()


provider = get_provider()


@app.get("/healthz")
def healthz():
    return {"status": "ok", "provider": provider.name}


@app.post("/analyze-ticket", response_model=AnalyzeResponse)
async def analyze_ticket(req: AnalyzeRequest, x_service_token: str = Header(default="")):
    if config.AI_SERVICE_TOKEN and not hmac.compare_digest(x_service_token, config.AI_SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        raw = await provider.analyze(req)
        result = Analysis.model_validate(raw)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ValidationError:
        raise HTTPException(status_code=502, detail="invalid_model_output")

    # The model may only reference ids we actually sent.
    allowed_articles = {a.id for a in req.articles}
    allowed_tickets = {t.id for t in req.candidate_tickets}
    result.suggested_article_ids = [i for i in result.suggested_article_ids if i in allowed_articles]
    result.duplicate_ticket_ids = [i for i in result.duplicate_ticket_ids if i in allowed_tickets]

    return AnalyzeResponse(**result.model_dump(), provider=provider.name, model=provider.model)