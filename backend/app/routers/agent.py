from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent.munshi_agent import ask_munshi
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.agent_query import AgentQuery
from app.models.user import User
from app.schemas.agent import AgentAskRequest, AgentAskResponse

router = APIRouter(prefix="/agent", tags=["agent"], dependencies=[Depends(get_current_user)])


@router.post("/ask", response_model=AgentAskResponse)
def ask(payload: AgentAskRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = ask_munshi(payload.question)

    log = AgentQuery(
        user_id=user.id,
        question=payload.question,
        answer=result["answer"],
        tools_called=result["tools_called"],
        flagged=result["flagged"],
    )
    db.add(log)
    db.commit()

    return AgentAskResponse(**result)
