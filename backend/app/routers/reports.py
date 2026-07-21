"""
Generates the onboarding/offboarding summary report as PDF and stores it
under app/reports/. Uses reportlab's Platypus layer (not raw Canvas
drawString calls) for real pagination, tables, and wrapped text -- the
report covers every domain of data the app actually collects, not just
tasks: employee profile, pipeline progress, AI role classification,
documents (with validation source/confidence), access & assets,
per-track tasks, the full communications log (welcome/org-docs/agenda/
feedback/equipment), and the audit trail.

Pulls tasks from OnboardingTask/OffboardingTask (whichever matches
report_type) -- NOT the retired ComplianceTask/Approval tables, which no
longer receive any data from either orchestrator. Compliance items are
called out via the category="compliance" tag on the task itself.
"""
import os
import json
import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

from app.database import get_db
from app.models import (
    Employee, RoleClassification, AccessRecommendation, AssetAllocation,
    OnboardingTask, OffboardingTask, Report, EmployeeDocument,
    OnboardingTracker, OffboardingTracker, ExitRequest, RiskAssessment, AuditLog,
    WelcomeEmail, OrgDocumentsEmail, FirstDayAgendaEmail,
    FeedbackEmail, FeedbackResponse, EquipmentConfirmationEmail, EquipmentConfirmationResponse,
)

router = APIRouter(prefix="/reports", tags=["reports"])
REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

TASK_MODEL_BY_REPORT_TYPE = {"onboarding": OnboardingTask, "offboarding": OffboardingTask}
TRACKER_MODEL_BY_REPORT_TYPE = {"onboarding": OnboardingTracker, "offboarding": OffboardingTracker}
TRACKS = ["HR", "IT", "Security", "Manager"]

# ---- brand palette, matches the frontend dashboard (purple accent / navy text) ----
PURPLE = colors.HexColor("#6D4FC7")
PURPLE_LIGHT = colors.HexColor("#EEE9FB")
PURPLE_PALE = colors.HexColor("#F8F6FD")
NAVY = colors.HexColor("#14213D")
GRAY = colors.HexColor("#6B7280")
BORDER = colors.HexColor("#E5E7EB")
GREEN = colors.HexColor("#16A34A")
AMBER = colors.HexColor("#D97706")
RED = colors.HexColor("#DC2626")

STATUS_COLOR = {
    "received": GREEN, "approved": GREEN, "allocated": GREEN, "completed": GREEN, "sent": GREEN,
    "replied": GREEN, "passed": GREEN,
    "pending": AMBER, "under_review": AMBER, "drafted": AMBER, "not_run": AMBER, "waiting": AMBER,
    "running": AMBER,
    "rejected": RED, "failed": RED, "damaged": RED,
}

_styles = getSampleStyleSheet()
STYLE_TITLE = ParagraphStyle("ReportTitle", parent=_styles["Title"], textColor=NAVY, fontSize=22, spaceAfter=2)
STYLE_SUBTITLE = ParagraphStyle("ReportSubtitle", parent=_styles["Normal"], textColor=GRAY, fontSize=10, spaceAfter=18)
STYLE_SECTION = ParagraphStyle(
    "SectionHeader", parent=_styles["Heading2"], textColor=PURPLE, fontSize=13,
    spaceBefore=16, spaceAfter=6,
)
STYLE_SUBSECTION = ParagraphStyle(
    "SubsectionHeader", parent=_styles["Heading3"], textColor=NAVY, fontSize=10.5,
    spaceBefore=10, spaceAfter=4,
)
STYLE_BODY = ParagraphStyle("Body", parent=_styles["Normal"], textColor=NAVY, fontSize=9, leading=13)
STYLE_CELL = ParagraphStyle("Cell", parent=_styles["Normal"], textColor=NAVY, fontSize=8.5, leading=11)
STYLE_CELL_MUTED = ParagraphStyle("CellMuted", parent=_styles["Normal"], textColor=GRAY, fontSize=8, leading=10.5)
STYLE_EMPTY = ParagraphStyle("Empty", parent=_styles["Normal"], textColor=GRAY, fontSize=9, leftIndent=4)


def _p(text, style=STYLE_CELL):
    return Paragraph(text if text not in (None, "") else "-", style)


def _status_p(status: str):
    color = STATUS_COLOR.get((status or "").lower(), NAVY)
    return Paragraph(f'<font color="{color.hexval()}"><b>{(status or "-").replace("_", " ").title()}</b></font>', STYLE_CELL)


def _kv_table(pairs: list[tuple[str, str]]) -> Table:
    """Two-column label:value table, label muted+bold, value normal.
    Used for the employee overview block."""
    rows = [[Paragraph(f"<b>{label}</b>", STYLE_CELL_MUTED), _p(value)] for label, value in pairs]
    t = Table(rows, colWidths=[1.5 * inch, 4.8 * inch])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _data_table(headers: list[str], rows: list[list], col_widths=None) -> Table:
    """Standard styled data table -- purple header row, alternating pale
    row shading, hairline borders. Every non-empty section in the report
    uses this same shape so the document reads consistently."""
    header_row = [Paragraph(f"<b>{h}</b>", ParagraphStyle("Head", parent=STYLE_CELL, textColor=colors.white)) for h in headers]
    data = [header_row] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDER),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), PURPLE_PALE))
    t.setStyle(TableStyle(style))
    return t


def _json_list(raw) -> list[str]:
    try:
        return json.loads(raw) if raw else []
    except (json.JSONDecodeError, TypeError):
        return []


# ---------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------

def _gather_report_data(db: Session, employee: Employee, report_type: str) -> dict:
    task_model = TASK_MODEL_BY_REPORT_TYPE[report_type]
    tracker_model = TRACKER_MODEL_BY_REPORT_TYPE[report_type]

    tasks = db.query(task_model).filter(task_model.employee_id == employee.id).order_by(task_model.created_at).all()
    tasks_by_track: dict[str, list] = {}
    for t in tasks:
        tasks_by_track.setdefault(t.track, []).append(t)

    tracker_steps = (
        db.query(tracker_model).filter(tracker_model.employee_id == employee.id).order_by(tracker_model.timestamp).all()
    )

    role_classification = (
        db.query(RoleClassification).filter(RoleClassification.employee_id == employee.id)
        .order_by(RoleClassification.created_at.desc()).first()
    )
    access = (
        db.query(AccessRecommendation).filter(AccessRecommendation.employee_id == employee.id)
        .order_by(AccessRecommendation.created_at.desc()).first()
    )
    assets = (
        db.query(AssetAllocation).filter(AssetAllocation.employee_id == employee.id)
        .order_by(AssetAllocation.created_at.desc()).first()
    )
    audit_entries = (
        db.query(AuditLog).filter(AuditLog.employee_id == employee.id).order_by(AuditLog.timestamp).all()
    )

    data = {
        "tasks_by_track": tasks_by_track,
        "tracker_steps": tracker_steps,
        "role_classification": role_classification,
        "access": access,
        "assets": assets,
        "audit_entries": audit_entries,
    }

    if report_type == "onboarding":
        data["documents"] = (
            db.query(EmployeeDocument).filter(EmployeeDocument.employee_id == employee.id)
            .order_by(EmployeeDocument.requested_at).all()
        )
        data["welcome_email"] = (
            db.query(WelcomeEmail).filter(WelcomeEmail.employee_id == employee.id)
            .order_by(WelcomeEmail.generated_at.desc()).first()
        )
        data["org_documents_email"] = (
            db.query(OrgDocumentsEmail).filter(OrgDocumentsEmail.employee_id == employee.id)
            .order_by(OrgDocumentsEmail.generated_at.desc()).first()
        )
        data["agenda_email"] = (
            db.query(FirstDayAgendaEmail).filter(FirstDayAgendaEmail.employee_id == employee.id)
            .order_by(FirstDayAgendaEmail.generated_at.desc()).first()
        )
        data["feedback_email"] = (
            db.query(FeedbackEmail).filter(FeedbackEmail.employee_id == employee.id)
            .order_by(FeedbackEmail.generated_at.desc()).first()
        )
        data["feedback_response"] = (
            db.query(FeedbackResponse).filter(FeedbackResponse.employee_id == employee.id)
            .order_by(FeedbackResponse.received_at.desc()).first()
        )
        data["equipment_email"] = (
            db.query(EquipmentConfirmationEmail).filter(EquipmentConfirmationEmail.employee_id == employee.id)
            .order_by(EquipmentConfirmationEmail.generated_at.desc()).first()
        )
        data["equipment_response"] = (
            db.query(EquipmentConfirmationResponse).filter(EquipmentConfirmationResponse.employee_id == employee.id)
            .order_by(EquipmentConfirmationResponse.received_at.desc()).first()
        )
    else:
        data["exit_request"] = (
            db.query(ExitRequest).filter(ExitRequest.employee_id == employee.id)
            .order_by(ExitRequest.created_at.desc()).first()
        )
        data["risk_assessment"] = (
            db.query(RiskAssessment).filter(RiskAssessment.employee_id == employee.id)
            .order_by(RiskAssessment.created_at.desc()).first()
        )

    return data


# ---------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------

def _generate_pdf(employee: Employee, report_type: str, data: dict) -> str:
    filename = f"{employee.employee_id}_{report_type}.pdf"
    filepath = os.path.join(REPORTS_DIR, filename)

    doc = SimpleDocTemplate(
        filepath, pagesize=letter,
        topMargin=0.65 * inch, bottomMargin=0.65 * inch, leftMargin=0.65 * inch, rightMargin=0.65 * inch,
    )
    story = []

    # ---- Header ----
    story.append(Paragraph(f"{report_type.title()} Summary Report", STYLE_TITLE))
    story.append(Paragraph(
        f"Generated {datetime.datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}", STYLE_SUBTITLE,
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PURPLE, spaceAfter=14))

    # ---- Employee overview ----
    story.append(Paragraph("Employee Overview", STYLE_SECTION))
    story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceAfter=8))
    story.append(_kv_table([
        ("Name", f"{employee.name} ({employee.employee_id})"),
        ("Department", employee.department),
        ("Title / Role", f"{employee.title or '-'} / {employee.role or 'Not yet resolved'}"),
        ("Experience Level", (employee.experience_level or "-").title()),
        ("Office", employee.office),
        ("Manager", employee.manager),
        ("Joining Date", employee.joining_date or "-"),
        ("Data Source", "HRMS Sync" if employee.sync_source == "hrms" else "Manual Entry"),
        ("Current Status", (employee.status or "-").replace("_", " ").title()),
    ]))

    if report_type == "offboarding":
        exit_request = data.get("exit_request")
        if exit_request:
            story.append(Spacer(1, 6))
            story.append(_kv_table([
                ("Last Working Day", exit_request.last_working_day or "-"),
                ("Exit Reason", exit_request.exit_reason or "-"),
            ]))
        risk = data.get("risk_assessment")
        if risk:
            story.append(Paragraph("Offboarding Risk Assessment", STYLE_SUBSECTION))
            level_color = {"high": RED, "medium": AMBER, "low": GREEN}.get((risk.risk_level or "").lower(), NAVY)
            story.append(Paragraph(
                f'Risk Level: <font color="{level_color.hexval()}"><b>{risk.risk_level}</b></font>', STYLE_BODY,
            ))
            factors = _json_list(risk.factors)
            if factors:
                story.append(Paragraph(f"Factors: {', '.join(factors)}", STYLE_BODY))
            if risk.reasoning:
                story.append(Paragraph(f"Reasoning: {risk.reasoning}", STYLE_BODY))

    # ---- Pipeline progress ----
    tracker_steps = data["tracker_steps"]
    if tracker_steps:
        rows = [
            [_p(s.step), _status_p(s.status), _p(s.timestamp.strftime("%Y-%m-%d %H:%M") if s.timestamp else "-")]
            for s in tracker_steps
        ]
        story.append(Paragraph("Pipeline Progress", STYLE_SECTION))
        story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceAfter=8))
        story.append(_data_table(["Stage", "Status", "Timestamp"], rows, col_widths=[3.2 * inch, 1.5 * inch, 1.6 * inch]))

    # ---- AI role classification ----
    rc = data["role_classification"]
    if rc:
        story.append(Paragraph("AI Role Classification", STYLE_SECTION))
        story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceAfter=8))
        story.append(Paragraph(
            f"Predicted Role: <b>{rc.predicted_role}</b> &nbsp;&nbsp; Confidence: <b>{rc.confidence:.0%}</b>"
            if isinstance(rc.confidence, float) else f"Predicted Role: <b>{rc.predicted_role}</b>",
            STYLE_BODY,
        ))
        if rc.reasoning:
            story.append(Paragraph(f"Reasoning: {rc.reasoning}", STYLE_BODY))
        story.append(Paragraph(
            "Note: HRMS-provided role is used directly when available -- this classifier only runs as a fallback.",
            STYLE_CELL_MUTED,
        ))

    # ---- Documents (onboarding only) ----
    if report_type == "onboarding":
        docs = data.get("documents") or []
        story.append(Paragraph("Document Validation", STYLE_SECTION))
        story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceAfter=8))
        if docs:
            rows = []
            for d in docs:
                source_label = "HRMS Sync" if d.source == "hrms_sync" else "Email"
                rows.append([
                    _p(d.document_name), _status_p(d.status), _p(source_label),
                    _status_p(d.validation_status), _p((d.confidence or "-").title()),
                    Paragraph(d.validation_reasoning or "-", STYLE_CELL_MUTED),
                ])
            story.append(_data_table(
                ["Document", "Status", "Source", "Validation", "Confidence", "Reasoning"], rows,
                col_widths=[1.15 * inch, 0.85 * inch, 0.75 * inch, 0.75 * inch, 0.7 * inch, 1.9 * inch],
            ))
        else:
            story.append(Paragraph("Nothing recorded yet.", STYLE_EMPTY))

    # ---- Access & Assets ----
    story.append(Paragraph("Access & Assets", STYLE_SECTION))
    story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceAfter=8))
    access, assets = data["access"], data["assets"]
    if access:
        apps = _json_list(access.applications)
        groups = _json_list(access.security_groups)
        story.append(Paragraph(f"<b>Applications:</b> {', '.join(apps) if apps else '-'}", STYLE_BODY))
        story.append(Paragraph(f"<b>Security Groups:</b> {', '.join(groups) if groups else '-'}", STYLE_BODY))
        if access.reasoning:
            story.append(Paragraph(f"<b>Reasoning:</b> {access.reasoning}", STYLE_CELL_MUTED))
    if assets:
        asset_list = _json_list(assets.asset_list)
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f'<b>Allocated Assets:</b> {", ".join(asset_list) if asset_list else "-"} '
            f'&nbsp;&nbsp; Status: <font color="{STATUS_COLOR.get(assets.status, NAVY).hexval()}"><b>'
            f'{(assets.status or "-").title()}</b></font>',
            STYLE_BODY,
        ))
    if not access and not assets:
        story.append(Paragraph("Nothing recorded yet.", STYLE_EMPTY))

    # ---- Tasks by track ----
    story.append(Paragraph("Task Tracks", STYLE_SECTION))
    story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceAfter=8))
    any_tasks = False
    for track in TRACKS:
        tasks = data["tasks_by_track"].get(track, [])
        if not tasks:
            continue
        any_tasks = True
        story.append(Paragraph(f"{track} Track", STYLE_SUBSECTION))
        rows = []
        for t in tasks:
            name = t.task_name + (" [Compliance]" if t.category == "compliance" else "")
            rows.append([
                _p(name), _status_p(t.status), _p("Yes" if t.is_mandatory else "No"),
                _p("AI" if t.is_ai_generated == "true" else "Manual"),
                _p(t.decided_at.strftime("%Y-%m-%d %H:%M") if t.decided_at else "-"),
            ])
        story.append(_data_table(
            ["Task", "Status", "Mandatory", "Source", "Decided"], rows,
            col_widths=[2.3 * inch, 1.0 * inch, 0.85 * inch, 0.7 * inch, 1.15 * inch],
        ))
        story.append(Spacer(1, 6))
    if not any_tasks:
        story.append(Paragraph("Nothing recorded yet.", STYLE_EMPTY))

    # ---- Communications log (onboarding only) ----
    if report_type == "onboarding":
        story.append(Paragraph("Communications Log", STYLE_SECTION))
        story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceAfter=8))
        comms_rows = []

        def _one_way_row(label, email_record):
            if not email_record:
                return None
            sent = email_record.sent_at.strftime("%Y-%m-%d %H:%M") if email_record.sent_at else "-"
            return [_p(label), _status_p(email_record.status), _p(sent), _p("One-way, no reply expected")]

        def _two_way_row(label, email_record, response, response_desc_fn):
            if not email_record:
                return None
            sent = email_record.sent_at.strftime("%Y-%m-%d %H:%M") if email_record.sent_at else "-"
            desc = response_desc_fn(response) if response else ("Awaiting reply" if email_record.status == "sent" else "-")
            return [_p(label), _status_p(email_record.status), _p(sent), _p(desc)]

        for row in [
            _one_way_row("Welcome Email", data.get("welcome_email")),
            _one_way_row("Organizational Documents", data.get("org_documents_email")),
            _one_way_row("First-Day Agenda", data.get("agenda_email")),
            _two_way_row(
                "Onboarding Feedback", data.get("feedback_email"), data.get("feedback_response"),
                lambda r: f"Sentiment: {r.sentiment or '-'} -- {r.summary or ''}"[:140],
            ),
            _two_way_row(
                "Equipment Confirmation", data.get("equipment_email"), data.get("equipment_response"),
                lambda r: ("Acknowledged" if r.acknowledged == "true" else f"Issue: {r.issue_summary or '-'}"),
            ),
        ]:
            if row:
                comms_rows.append(row)

        if comms_rows:
            story.append(_data_table(
                ["Communication", "Status", "Sent", "Outcome"], comms_rows,
                col_widths=[1.6 * inch, 0.85 * inch, 1.15 * inch, 2.15 * inch],
            ))
        else:
            story.append(Paragraph("Nothing recorded yet.", STYLE_EMPTY))

    # ---- Audit trail ----
    audit_entries = data["audit_entries"]
    story.append(Paragraph("Audit Trail", STYLE_SECTION))
    story.append(HRFlowable(width="100%", thickness=0.75, color=BORDER, spaceAfter=8))
    if audit_entries:
        rows = [
            [
                _p(e.timestamp.strftime("%Y-%m-%d %H:%M") if e.timestamp else "-"),
                _p(e.agent), _p(e.action),
                Paragraph((e.detail or "-")[:180], STYLE_CELL_MUTED),
            ]
            for e in audit_entries
        ]
        story.append(_data_table(
            ["Timestamp", "Agent", "Action", "Detail"], rows,
            col_widths=[1.1 * inch, 1.3 * inch, 1.5 * inch, 1.85 * inch],
        ))
    else:
        story.append(Paragraph("Nothing recorded yet.", STYLE_EMPTY))

    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(GRAY)
        canvas.drawString(0.65 * inch, 0.4 * inch, f"{employee.name} -- {report_type.title()} Report")
        canvas.drawRightString(letter[0] - 0.65 * inch, 0.4 * inch, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return filepath


@router.get("/{employee_id}")
def get_report_meta(employee_id: str, report_type: str = "onboarding", db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if report_type not in TASK_MODEL_BY_REPORT_TYPE:
        raise HTTPException(status_code=400, detail="report_type must be 'onboarding' or 'offboarding'")

    data = _gather_report_data(db, employee, report_type)
    filepath = _generate_pdf(employee, report_type, data)
    db.add(Report(employee_id=employee_id, report_type=report_type, file_path=filepath))
    db.commit()

    return {"employee_id": employee_id, "report_type": report_type, "file_path": filepath}


@router.get("/{employee_id}/download")
def download_report(employee_id: str, report_type: str = "onboarding", db: Session = Depends(get_db)):
    record = (
        db.query(Report)
        .filter(Report.employee_id == employee_id, Report.report_type == report_type)
        .order_by(Report.generated_at.desc())
        .first()
    )
    if not record or not os.path.exists(record.file_path):
        raise HTTPException(status_code=404, detail="Report not generated yet -- call GET /reports/{employee_id} first")
    return FileResponse(record.file_path, media_type="application/pdf", filename=os.path.basename(record.file_path))
