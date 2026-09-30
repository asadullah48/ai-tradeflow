from pydantic import BaseModel, Field


class AgentAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class AgentAskResponse(BaseModel):
    answer: str
    tools_called: list[str]
    flagged: bool
    blocked: bool = False
