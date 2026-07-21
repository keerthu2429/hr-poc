"""
Both ONBOARDING and OFFBOARDING approvals are now TASK-LEVEL -- the old
per-track Approval table is fully retired for both workflows (it's kept
as a model for now, unused, rather than dropped -- see main progress
doc for the housekeeping note on cleaning it up later). This endpoint
reads OnboardingTask and OffboardingTask directly, grouped by employee,
for whichever track matches the logged-in role.
"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Employee, OnboardingTask, OffboardingTask,
    WelcomeEmail, FeedbackEmail, OrgDocumentsEmail, FirstDayAgendaEmail,
    EquipmentConfirmationEmail, DocumentRequestEmail,
)
from app.services.track_status import TRACKS

router = APIRouter(prefix="/approvals", tags=["approvals"])

# task_name -> email model, for attaching the actual drafted subject/body
# to email_draft tasks. Mirrors onboarding.py's get_tasks lookup -- these
# are two independent serializers over the same tasks (see README), so a
# field added to one does not automatically appear on the other. Keep
# this in sync with onboarding.py's get_tasks if a new email type is added.
_EMAIL_MODEL_BY_TASK_NAME = {
    "Welcome Email": WelcomeEmail,
    "Onboarding Feedback Request": FeedbackEmail,
    "Organizational Documents": OrgDocumentsEmail,
    "First-Day Agenda": FirstDayAgendaEmail,
    "Equipment Confirmation": EquipmentConfirmationEmail,
}


def _serialize_tasks(db: Session, employee_id: str, task_list):
    entries = []
    for t in task_list:
        entry = {
            "id": t.id, "task_name": t.task_name, "status": t.status,
            "is_mandatory": t.is_mandatory,
            "is_ai_generated": t.is_ai_generated == "true",
            "ai_recommendation": t.ai_recommendation,
            "task_type": t.task_type,
            "options": json.loads(t.options) if t.options else None,
            "selected_options": json.loads(t.selected_options) if t.selected_options else None,
            "category": t.category,
            "document_id": getattr(t, "document_id", None),
        }
        if t.task_type == "email_draft":
            email_model = _EMAIL_MODEL_BY_TASK_NAME.get(t.task_name, DocumentRequestEmail)
            email_record = (
                db.query(email_model)
                .filter(email_model.employee_id == employee_id)
                .order_by(email_model.generated_at.desc())
                .first()
            )
            if email_record:
                entry["email_subject"] = email_record.subject
                entry["email_body"] = email_record.body
                entry["email_status"] = email_record.status
        entries.append(entry)
    return entries


def _tasks_by_employee(db: Session, task_model, approver_role: str):
    tasks = (
        db.query(task_model)
        .filter(task_model.track == approver_role)
        .order_by(task_model.created_at.desc())
        .all()
    )
    grouped: dict[str, list] = {}
    for t in tasks:
        grouped.setdefault(t.employee_id, []).append(t)
    return grouped


@router.get("/pending/{approver_role}")
def get_approvals_for_role(approver_role: str, db: Session = Depends(get_db)):
    if approver_role not in TRACKS:
        return []

    results = []

    for workflow_type, task_model in (("onboarding", OnboardingTask), ("offboarding", OffboardingTask)):
        grouped = _tasks_by_employee(db, task_model, approver_role)
        for employee_id, task_list in grouped.items():
            employee = db.query(Employee).filter(Employee.id == employee_id).first()
            if not employee:
                continue
            results.append({
                "employee_id": employee.id, "employee_name": employee.name,
                "emp_id": employee.employee_id,
                "department": employee.department, "role": employee.role,
                "experience_level": employee.experience_level,
                "workflow_type": workflow_type,
                "tasks": _serialize_tasks(db, employee_id, task_list),
            })

    return results
