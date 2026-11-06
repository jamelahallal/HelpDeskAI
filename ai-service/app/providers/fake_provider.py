from ..schemas import AnalyzeRequest


class FakeProvider:
    name = "fake"
    model = "fake-1"

    async def analyze(self, req: AnalyzeRequest) -> dict:
        text = f"{req.title} {req.description}".lower()
        vpn = "vpn" in text
        return {
            "category": "Network / VPN" if vpn else "General",
            "priority": "P2" if vpn else "P3",
            "urgency": "high" if "deadline" in text or "due" in text else "medium",
            "summary": req.title,
            "suggested_team": "Network Support" if vpn else "Service Desk",
            "suggested_article_ids": [a.id for a in req.articles[:1]],
            "duplicate_ticket_ids": [],
            "suggested_reply": "Thanks for reporting this. We are looking into it and will update you shortly.",
        }