from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.services import whatsapp_export_service

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(get_current_user)])


@router.get("/daily-summary")
def daily_summary(on_date: date_type | None = None, db: Session = Depends(get_db)):
    text = whatsapp_export_service.build_daily_summary_text(db, on_date=on_date)
    return {"text": text}


@router.get("/party-statement/{party_id}")
def party_statement(party_id: str, db: Session = Depends(get_db)):
    try:
        text = whatsapp_export_service.build_party_statement_text(db, party_id=party_id)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    return {"text": text}


@router.get("/party-statement/{party_id}/pdf")
def party_statement_pdf(party_id: str, db: Session = Depends(get_db)):
    try:
        pdf_bytes = whatsapp_export_service.build_party_statement_pdf(db, party_id=party_id)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="statement-{party_id}.pdf"'},
    )
