"""
Executive Dashboard summary endpoint.
"""
import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import (
    Employee, Approval, RiskAssessment, ComplianceTask,
    OnboardingTracker, OffboardingTracker, AuditLog,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
TREND_DAYS = 7


def _daily_trend(db: Session, tracker_model, step_name: str, days: int = TREND_DAYS):
    since = datetime.datetime.utcnow().date() - datetime.timedelta(days=days - 1)
    rows = (
        db.query(func.date(tracker_model.timestamp).label("day"), func.count(tracker_model.id))
        .filter(tracker_model.step == step_name, tracker_model.status == "completed")
        .filter(func.date(tracker_model.timestamp) >= since)
        .group_by("day")
        .order_by("day")
        .all()
    )
    counts_by_day = {str(day): count for day, count in rows}
    result = []
    for i in range(days):
        day = since + datetime.timedelta(days=i)
        result.append({"date": str(day), "count": counts_by_day.get(str(day), 0)})
    return result


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    today = datetime.datetime.utcnow().date()

    total_employees = db.query(Employee).count()
    pending_onboarding = db.query(Employee).filter(Employee.status == "onboarding").count()
    pending_offboarding = db.query(Employee).filter(Employee.status == "offboarding").count()
    pending_approvals = db.query(Approval).filter(Approval.status == "pending").count()
    high_risk_employees = db.query(RiskAssessment).filter(RiskAssessment.risk_level == "High").count()

    total_tasks = db.query(ComplianceTask).count()
    completed_tasks = db.query(ComplianceTask).filter(ComplianceTask.status == "completed").count()
    compliance_completion_pct = round((completed_tasks / total_tasks * 100), 1) if total_tasks else 0.0

    # Proxy for "onboarded/offboarded today" -- schema doesn't have a distinct
    # "completed" timestamp yet, so this uses the first tracker step of each flow.
    onboarded_today = (
        db.query(OnboardingTracker)
        .filter(OnboardingTracker.step == "Registered", OnboardingTracker.status == "completed")
        .filter(func.date(OnboardingTracker.timestamp) == today)
        .count()
    )
    offboarded_today = (
        db.query(OffboardingTracker)
        .filter(OffboardingTracker.step == "Exit Request", OffboardingTracker.status == "completed")
        .filter(func.date(OffboardingTracker.timestamp) == today)
        .count()
    )

    department_rows = db.query(Employee.department, func.count(Employee.id)).group_by(Employee.department).all()
    role_rows = (
        db.query(Employee.role, func.count(Employee.id))
        .filter(Employee.role.isnot(None))
        .group_by(Employee.role)
        .all()
    )

    recent_activity = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()

    return {
        "total_employees": total_employees,
        "onboarded_today": onboarded_today,
        "offboarded_today": offboarded_today,
        "pending_onboarding": pending_onboarding,
        "pending_offboarding": pending_offboarding,
        "pending_approvals": pending_approvals,
        "high_risk_employees": high_risk_employees,
        "compliance_completion_pct": compliance_completion_pct,
        "department_distribution": [{"name": d or "Unassigned", "count": c} for d, c in department_rows],
        "role_distribution": [{"name": r, "count": c} for r, c in role_rows],
        "onboarding_trend": _daily_trend(db, OnboardingTracker, "Registered"),
        "offboarding_trend": _daily_trend(db, OffboardingTracker, "Exit Request"),
        "recent_activity": [
            {"timestamp": r.timestamp, "agent": r.agent, "action": r.action,
             "detail": r.detail, "employee_id": r.employee_id}
            for r in recent_activity
        ],
    }