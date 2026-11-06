import json
import httpx
from ..prompt import build_messages
from ..schemas import AnalyzeRequest

URL = "https://api.groq.com/openai/v1/chat/completions"


class ProviderError(Exception):
    pass


class GroqProvider:
    name = "groq"

    def __init__(self, api_key: str, model: str, timeout: float):
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set")
        self.api_key, self.model, self.timeout = api_key, model, timeout

    async def analyze(self, req: AnalyzeRequest) -> dict:
        payload = {
            "model": self.model,
            "messages": build_messages(req),
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 900,
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(
                    URL, json=payload, headers={"Authorization": f"Bearer {self.api_key}"}
                )
        except httpx.HTTPError as e:
            raise ProviderError("provider_unavailable") from e
        if r.status_code != 200:
            raise ProviderError(f"provider_status_{r.status_code}")
        try:
            return json.loads(r.json()["choices"][0]["message"]["content"])
        except (KeyError, IndexError, ValueError, TypeError) as e:
            raise ProviderError("provider_malformed_response") from e