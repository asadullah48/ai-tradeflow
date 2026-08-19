from pydantic import BaseModel


class AgentAskRequest(BaseModel):
    question: str


class AgentAskResponse(BaseModel):
    answer: str
    tools_called: list[str]
    flagged: bool
    blocked: bool = False
