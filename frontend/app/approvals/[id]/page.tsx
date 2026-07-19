"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";


function initials(name: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// --- Default email draft builder --------------------------------------------
function parseMissingDocsFromRecommendation(rec: string): string[] {
  if (!rec) return [];
  const match = rec.match(/missing:\s*([^.]+)\./i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildDefaultEmailDraft(task: any, employeeName?: string | null) {
  const docs = parseMissingDocsFromRecommendation(task.ai_recommendation || "");
  const subject = "Action Required: Missing Onboarding Documents";
  const bulletList = docs.length > 0 ? docs.map((d) => `- ${d}`).join("\n") : "- (see task details)";
  const body =
    `Hi ${employeeName || "there"},\n\n` +
    `To complete your onboarding, we still need the following document(s) from you:\n` +
    `${bulletList}\n\n` +
    `Please reply directly to this email with the document(s) attached (PDF or image) at your earliest convenience.\n\n` +
    `Thanks,\nHR Team`;
  return { subject, body };
}

function normalizeTasks(rawTasks: any): any[] {
  if (Array.isArray(rawTasks)) return rawTasks;
  if (rawTasks && typeof rawTasks === "object") {
    return Object.entries(rawTasks).flatMap(([group, list]) =>
      Array.isArray(list) ? list.map((t: any) => ({ ...t, _roleGroup: group })) : []
    );
  }
  return [];
}

const HR_KEYWORDS = [
  "aadhaar", "pan card", "education", "offer letter", "employment", "passport",
  "government id", "relieving", "hr portal", "hr document", "background check",
  "security clearance", "nda", "confidentiality", "access badge", "security training",
  "police verification", "reference check", "security token", "clearance",
];
const IT_KEYWORDS = [
  "laptop", "vpn", "jetbrains", "ide", "admin panel", "building access",
  "workstation", "license", "hardware", "software", "asset allocation", "asset",
  "assign application", "application access", "app access", "corporate email account",
  "email account setup", "outlook", "teams", "sharepoint", "onedrive", "monitor",
  "dock", "headset", "mobile device", "provision", "system access", "erp",
  "time entry", "billing system", "create user account", "user account",
  "account creation", "user id",
];
const DELIVERY_KEYWORDS = [
  "team assignment", "onboarding track", "buddy", "mentor", "manager",
  "delivery team", "project allocation",
];

type StageKey = "hr" | "it" | "delivery";
type WorkflowType = "onboarding" | "offboarding";

function matchesAny(name: string, keywords: string[]) {
  return keywords.some((k) => name.includes(k));
}

function classifyStage(t: any): StageKey {
  const group = (t._roleGroup || "").toLowerCase();
  if (group === "hr" || group === "security") return "hr";
  if (group === "it") return "it";
  if (group === "manager" || group === "delivery") return "delivery";
  if (t.task_type === "email_draft") return "hr";
  const explicit = (t.stage || t.category || "").toLowerCase();
  if (explicit) {
    if (explicit.includes("hr") || explicit.includes("document") || explicit.includes("security") || explicit.includes("clearance"))
      return "hr";
    if (explicit.includes("it") || explicit.includes("provision")) return "it";
    if (explicit.includes("manager") || explicit.includes("team") || explicit.includes("delivery"))
      return "delivery";
  }
  const name = (t.task_name || "").toLowerCase();
  if (matchesAny(name, DELIVERY_KEYWORDS)) return "delivery";
  if (matchesAny(name, IT_KEYWORDS)) return "it";
  if (matchesAny(name, HR_KEYWORDS)) return "hr";
  if (typeof window !== "undefined") {
    console.warn(`[classifyStage] Unmatched task, defaulting to HR:`, t.task_name, t);
  }
  return "hr";
}

const STAGES: { key: StageKey; eyebrow: string; title: string }[] = [
  { key: "hr", eyebrow: "STAGE 1 · DOCUMENTATION", title: "HR Verification" },
  { key: "it", eyebrow: "STAGE 2 · PROVISIONING", title: "IT Provisioning" },
  { key: "delivery", eyebrow: "STAGE 3 · TEAM ASSIGNMENT", title: "Delivery Team" },
];

const STAGE_APPROVER: Record<StageKey, string> = {
  hr: "HR", it: "IT", delivery: "Manager",
};

type StageDisplay = {
  text: string;
  textColor: string;
  circleColor: string;
};

function getStageDisplay(
  stage: StageKey,
  status: "completed" | "pending" | "locked",
  role?: string | null
): StageDisplay {
  const r = (role || "").toLowerCase();
  const currentStage =
    (r === "hr" && stage === "hr") ||
    (r === "it" && stage === "it") ||
    ((r === "manager" || r === "delivery") && stage === "delivery");
  if (currentStage) {
    if (status === "completed") {
      return { text: "Approved", textColor: "text-green-600", circleColor: "bg-green-600 text-white" };
    }
    return { text: `Waiting for ${STAGE_APPROVER[stage]} Approval`, textColor: "text-red-600", circleColor: "bg-red-500 text-white" };
  }
  if (status === "completed") {
    return { text: "Approved", textColor: "text-green-600", circleColor: "bg-green-600 text-white" };
  }
  return { text: `Waiting for ${STAGE_APPROVER[stage]} Approval`, textColor: "text-gray-400", circleColor: "bg-white border-2 border-gray-200 text-gray-400" };
}

// --- Derive overall status from tasks array ---
function deriveOverallStatus(item: any): string {
  if (!item) return "Unknown";
  
  const directStatus = item.status || item.approval_status || item.employee_status || item.overall_status;
  if (typeof directStatus === "string" && directStatus.trim()) {
    return directStatus;
  }
  
  const tasks = item.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) return "Unknown";
  
  const allApproved = tasks.every((t: any) => t.status === "approved" || t.status === "verified");
  const allRejected = tasks.every((t: any) => t.status === "rejected");
  const anyPending = tasks.some((t: any) => t.status === "pending");
  
  if (allApproved) return "Cleared";
  if (allRejected) return "Rejected";
  if (anyPending) return "Pending";
  
  return "In Progress";
}

// --- Get badge colors based on status value ---
function getStatusBadgeStyle(status: string | undefined | null): { bg: string; text: string; label: string } {
  const s = (status || "Unknown").toLowerCase().trim();
  switch (s) {
    case "cleared":
    case "completed":
    case "approved":
      return { bg: "bg-green-100", text: "text-green-700", label: status! };
    case "in_progress":
    case "in progress":
      return { bg: "bg-blue-100", text: "text-blue-700", label: status! };
    case "pending":
      return { bg: "bg-amber-100", text: "text-amber-700", label: status! };
    case "not_started":
    case "not started":
      return { bg: "bg-gray-100", text: "text-gray-600", label: "Not Started" };
    case "rejected":
      return { bg: "bg-red-100", text: "text-red-700", label: status! };
    default:
      const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
      return { bg: "bg-amber-100", text: "text-amber-700", label };
  }
}

const ROLE_STAGE_MAP: Record<string, StageKey> = {
  hr: "hr", it: "it", manager: "delivery", delivery: "delivery", "delivery team": "delivery",
};
const ADMIN_ROLES = ["admin", "superadmin", "owner"];

function stageForRole(role?: string | null): StageKey | "all" | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (ADMIN_ROLES.includes(r)) return "all";
  return ROLE_STAGE_MAP[r] ?? null;
}

function taskCardStyle(t: any) {
  const status = (t.status || "").toLowerCase();
  if (t.flag === "expired" || t.flag === "missing") {
    return { bg: "bg-red-50 border-red-100", checked: false };
  }
  if (status === "approved" || status === "verified" || status === "rejected") {
    return { bg: "bg-green-50 border-green-100", checked: true };
  }
  return { bg: "bg-white border-gray-100", checked: false };
}

function TaskListButton({
  task, isSelected, onSelect,
}: { task: any; isSelected: boolean; onSelect: () => void; }) {
  const { checked } = taskCardStyle(task);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm font-semibold transition flex items-center justify-between gap-2 ${
        checked
          ? "bg-green-50 border-green-200 text-green-700"
          : isSelected
          ? "border-[#14213D] bg-white text-[#14213D] shadow-sm"
          : "border-gray-200 bg-white text-[#14213D] hover:border-gray-300"
      }`}
    >
      <span className="truncate">{task.task_name}</span>
      {checked ? (
        <span className="text-green-600 text-xs shrink-0">✓</span>
      ) : task.flag ? (
        <span className="text-[10px] font-semibold text-red-600 shrink-0 whitespace-nowrap">
          {task.flag === "expired" ? "Expired" : "Missing"}
        </span>
      ) : null}
    </button>
  );
}

// --- Empty State Component (shown when no task is selected) ------------------
function EmptyTaskPanel({ stageKey }: { stageKey: StageKey }) {
  const messages: Record<StageKey, { icon: string; title: string; desc: string }> = {
    hr: {
      icon: "📧",
      title: "Document Request Email",
      desc: "Select a task from the left to review AI recommendations, edit the email draft, and approve or reject.",
    },
    it: {
      icon: "💻",
      title: "IT Asset & Access Provisioning",
      desc: "Select a task from the left to review AI recommendations and approve or reject provisioning requests.",
    },
    delivery: {
      icon: "👥",
      title: "Team Assignment & Onboarding Track",
      desc: "Select a task from the left to review AI recommendations and approve or reject team assignments.",
    },
  };
  const msg = messages[stageKey];
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center h-full flex flex-col items-center justify-center min-h-[280px]">
      <div className="text-4xl mb-3">{msg.icon}</div>
      <h4 className="text-sm font-semibold text-[#14213D] mb-1">{msg.title}</h4>
      <p className="text-xs text-gray-400 max-w-[280px]">{msg.desc}</p>
    </div>
  );
}

// --- Right column: full task detail ------------------------------------------
function TaskDetailPanel({
  employeeId, employeeName, task, workflow, onChanged, locked,
}: {
  employeeId: string; employeeName?: string | null; task: any;
  workflow: WorkflowType; onChanged: () => void; locked?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<string[]>(task.selected_options || []);

  const isEmailDraft = task.task_type === "email_draft";
  const defaultDraft = isEmailDraft ? buildDefaultEmailDraft(task, employeeName) : null;
  const [emailSubject, setEmailSubject] = useState<string>(
    task.email_subject || defaultDraft?.subject || ""
  );
  const [emailBody, setEmailBody] = useState<string>(
    task.email_body || defaultDraft?.body || ""
  );
  const [emailSaving, setEmailSaving] = useState(false);
  const [checkingInbox, setCheckingInbox] = useState(false);
  const [inboxMessage, setInboxMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelection(task.selected_options || []);
    setEmailSubject(task.email_subject || defaultDraft?.subject || "");
    setEmailBody(task.email_body || defaultDraft?.body || "");
    setInboxMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const isEditable =
    !locked &&
    task.status === "pending" &&
    (task.task_type === "multi_select" || task.task_type === "single_select");

  const emailEditable = !locked && task.status === "pending";
  const isDecided =
    task.status === "approved" || task.status === "rejected" || task.status === "verified";

  const updateSelection =
    workflow === "onboarding" ? api.updateTaskSelection : api.updateOffboardingTaskSelection;
  const decideTask = workflow === "onboarding" ? api.decideTask : api.decideOffboardingTask;

  async function saveSelection(next: string[]) {
    if (locked) return;
    setSelection(next);
    setSaving(true);
    try {
      await updateSelection(employeeId, task.id, next);
    } finally {
      setSaving(false);
    }
  }

  function toggleOption(option: string) {
    if (locked) return;
    if (task.task_type === "single_select") {
      saveSelection([option]);
    } else {
      const next = selection.includes(option)
        ? selection.filter((o) => o !== option)
        : [...selection, option];
      saveSelection(next);
    }
  }

  async function decide(status: "approved" | "rejected") {
    if (locked) return;
    setSaving(true);
    try {
      await decideTask(employeeId, task.id, status);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEmailEdits() {
    if (!emailEditable) return;
    setEmailSaving(true);
    try {
      await api.updateEmailDraft(employeeId, emailSubject, emailBody);
      onChanged();
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleCheckInbox() {
    if (locked) return;
    setCheckingInbox(true);
    setInboxMessage(null);
    try {
      const result = await api.checkInbox(employeeId);
      const replyFound = result?.replyFound ?? result?.reply_found ?? false;
      if (replyFound) {
        onChanged();
      } else {
        setInboxMessage("No reply found yet. Please check again later.");
      }
    } catch (err) {
      setInboxMessage("Something went wrong while checking the inbox.");
    } finally {
      setCheckingInbox(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 md:p-5">
      {/* Header: AI Recommended Access + Check Inbox button on the RIGHT */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F1FB] border border-[#D9CFF5] px-3 py-1 text-xs font-semibold text-[#6D4FC7]">
            <span>✦</span>
            <span className="uppercase tracking-wider">AI Recommended Access</span>
          </span>
        </div>
        {isEmailDraft && (
          <button
            onClick={handleCheckInbox}
            disabled={locked || checkingInbox}
            className="rounded-lg border border-[#D9CFF5] bg-[#F3F1FB] px-3 py-1.5 text-xs font-semibold text-[#6D4FC7] hover:bg-[#EEE9FB] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {checkingInbox ? "Checking..." : "Check Inbox for Reply"}
          </button>
        )}
      </div>

      {task.ai_recommendation && (
        <div className="text-xs text-gray-500 mb-3">
          {task.is_ai_generated ? "✦ " : ""}
          {task.ai_recommendation}
        </div>
      )}

      {/* single_select */}
      {task.task_type === "single_select" && task.options && (
        <div className="mb-3">
          <select
            value={selection[0] || ""}
            disabled={!isEditable || saving}
            onChange={(e) => toggleOption(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#14213D] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="" disabled>Select…</option>
            {task.options.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      {/* multi_select */}
      {task.task_type === "multi_select" && task.options && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {task.options.map((opt: string) => (
            <label
              key={opt}
              className={`text-xs rounded-md border px-2 py-1 ${
                isEditable ? "cursor-pointer" : "cursor-default"
              } ${
                selection.includes(opt)
                  ? "bg-[#EEE9FB] border-[#D9CFF5] text-[#6D4FC7]"
                  : "bg-white border-gray-200 text-[#14213D]"
              }`}
            >
              <input
                type="checkbox"
                checked={selection.includes(opt)}
                disabled={!isEditable || saving}
                onChange={() => toggleOption(opt)}
                className="mr-1.5 align-middle"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {/* email_draft: Subject/Body + Save Edits */}
      {isEmailDraft && (
        <div className="mb-3 space-y-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Subject
            </label>
            <input
              type="text"
              value={emailSubject}
              disabled={!emailEditable || emailSaving}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#14213D] disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Body
            </label>
            <textarea
              value={emailBody}
              disabled={!emailEditable || emailSaving}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#14213D] disabled:opacity-60 disabled:cursor-not-allowed resize-y"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveEmailEdits}
              disabled={!emailEditable || emailSaving}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#14213D] hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {emailSaving ? "Saving..." : "Save Edits"}
            </button>
          </div>
          {inboxMessage && <p className="text-xs text-amber-600">{inboxMessage}</p>}
        </div>
      )}

      {/* Approve / Reject buttons at bottom */}
      {!locked && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
          {task.status !== "rejected" && (
            <button
              onClick={() => decide("approved")}
              disabled={saving || isDecided}
              className={`rounded-lg px-5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed ${
                task.status === "approved"
                  ? "bg-green-600 text-white"
                  : "bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
              }`}
            >
              {task.status === "approved" ? "Approved" : saving ? "Saving..." : "Approve"}
            </button>
          )}
          {task.status !== "approved" && (
            <button
              onClick={() => decide("rejected")}
              disabled={saving || isDecided}
              className={`rounded-lg border px-5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed ${
                task.status === "rejected"
                  ? "bg-red-600 text-white border-red-600"
                  : "border-gray-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40"
              }`}
            >
              {task.status === "rejected" ? "Rejected" : "Reject"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmployeeApprovalPage() {
  const { role } = useAuth();
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowType>("onboarding");
  const [selectedStage, setSelectedStage] = useState<StageKey | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const myStage = useMemo(() => stageForRole(role), [role]);

  function isStageLockedForRole(key: StageKey) {
    if (myStage === "all") return false;
    return myStage !== key;
  }

  async function load() {
    if (!role) return;
    setLoading(true);
    try {
      let data: any[] = [];
      if (typeof (api as any).approvalsForEmployee === "function") {
        data = await (api as any).approvalsForEmployee(employeeId);
      } else {
        data = await api.approvalsForRole(role);
      }
      const normalized = Array.isArray(data) ? data : data ? [data] : [];
      setItems(normalized);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [role]);

  const employeeItems = useMemo(
    () => items.filter((item: any) => item.employee_id === employeeId),
    [items, employeeId]
  );

  const header = employeeItems[0];

  const availableWorkflows = useMemo(() => {
    const set = new Set<WorkflowType>(employeeItems.map((i: any) => i.workflow_type));
    return (["onboarding", "offboarding"] as WorkflowType[]).filter((w) => set.has(w));
  }, [employeeItems]);

  useEffect(() => {
    if (availableWorkflows.length > 0 && !availableWorkflows.includes(activeWorkflow)) {
      setActiveWorkflow(availableWorkflows[0]);
    }
  }, [availableWorkflows, activeWorkflow]);

  const allTasks = useMemo(() => {
    return employeeItems
      .filter((i: any) => i.workflow_type === activeWorkflow)
      .flatMap((i: any) => normalizeTasks(i.tasks).map((t: any) => ({ ...t, _workflow: activeWorkflow })));
  }, [employeeItems, activeWorkflow]);

  const tasksByStage = useMemo(() => {
    const grouped: Record<StageKey, any[]> = { hr: [], it: [], delivery: [] };
    allTasks.forEach((t: any) => grouped[classifyStage(t)].push(t));
    return grouped;
  }, [allTasks]);

  // --- FIXED: Compute stage statuses in a single pass to avoid infinite recursion ---
  const stageStatuses = useMemo(() => {
    const result: Record<StageKey, "completed" | "pending" | "locked"> = {
      hr: "pending",
      it: "locked",
      delivery: "locked",
    };

    // HR stage: always unlocked. Completed if all HR tasks are approved/verified
    const hrTasks = tasksByStage.hr;
    if (hrTasks.length === 0) {
      result.hr = "completed"; // no tasks = considered done
    } else {
      const allHrDone = hrTasks.every(
        (t) => t.status === "approved" || t.status === "verified" || t.status === "rejected"
      );
      result.hr = allHrDone ? "completed" : "pending";
    }

    // IT stage: locked until HR is completed
    if (result.hr !== "completed") {
      result.it = "locked";
    } else {
      const itTasks = tasksByStage.it;
      if (itTasks.length === 0) {
        result.it = "completed";
      } else {
        const allItDone = itTasks.every(
          (t) => t.status === "approved" || t.status === "verified" || t.status === "rejected"
        );
        result.it = allItDone ? "completed" : "pending";
      }
    }

    // Delivery stage: locked until IT is completed
    if (result.it !== "completed") {
      result.delivery = "locked";
    } else {
      const deliveryTasks = tasksByStage.delivery;
      if (deliveryTasks.length === 0) {
        result.delivery = "completed";
      } else {
        const allDeliveryDone = deliveryTasks.every(
          (t) => t.status === "approved" || t.status === "verified" || t.status === "rejected"
        );
        result.delivery = allDeliveryDone ? "completed" : "pending";
      }
    }

    return result;
  }, [tasksByStage]);

  // Helper to get status for a specific stage (now reads from memoized object)
  function stageStatus(key: StageKey): "completed" | "pending" | "locked" {
    return stageStatuses[key];
  }

  useEffect(() => { setSelectedStage(null); }, [activeWorkflow]);

  useEffect(() => {
    if (selectedStage || employeeItems.length === 0) return;
    // Auto-select the first non-completed stage
    const current = STAGES.find((s) => stageStatuses[s.key] !== "completed") || STAGES[STAGES.length - 1];
    setSelectedStage(current.key);
  }, [selectedStage, employeeItems, stageStatuses]);

  useEffect(() => { setSelectedTaskId(null); }, [selectedStage, activeWorkflow]);

  const activeStageDef = selectedStage ? STAGES.find((s) => s.key === selectedStage) || null : null;
  const activeStatus = selectedStage ? stageStatus(selectedStage) : null;
  const activeTasks = selectedStage ? tasksByStage[selectedStage] : [];
  const activeLocked = activeStatus === "locked";
  const activeRoleLocked = selectedStage ? isStageLockedForRole(selectedStage) : false;
  const activeStageIndex = selectedStage ? STAGES.findIndex((s) => s.key === selectedStage) : -1;

  const selectedTask = useMemo(
    () => activeTasks.find((t: any) => t.id === selectedTaskId) || null,
    [activeTasks, selectedTaskId]
  );

  // Derive overall status from the header item
  const overallStatus = useMemo(() => deriveOverallStatus(header), [header]);
  
  // Get dynamic badge colors based on the actual status value
  const statusBadge = useMemo(() => getStatusBadgeStyle(overallStatus), [overallStatus]);

  return (
    <div className="bg-[#FAFAF9] min-h-screen w-full p-6 flex-1">
      {/* Top bar */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="uppercase tracking-[0.25em] text-xs text-[#D9A653] font-semibold">
            Employee {activeWorkflow === "onboarding" ? "Onboarding" : "Offboarding"}
          </p>
          <h1 className="mt-2 text-4xl font-bold text-[#14213D]">Approval Dashboard</h1>
          <p className="mt-2 text-gray-500">
            Review, edit AI selections and approve or reject each task across HR, IT and Delivery Team.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#14213D]">
            Logged in as {role}
          </div>
          <button
            onClick={() => router.push("/approvals")}
            className="rounded-xl bg-[#14213D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#243654] transition"
          >
            Back to Directory
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && !header && (
        <p className="text-gray-500">No pending approvals found for this employee.</p>
      )}

      {!loading && header && (
        <>
          {/* Employee header card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 mb-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#14213D] text-white text-base font-bold shrink-0">
                {initials(header.employee_name)}
              </div>
              <div className="mr-auto">
                <div className="text-xl font-bold text-[#14213D]">{header.employee_name}</div>
                <div className="text-sm text-gray-500">
                  {header.employee_id ?? "—"}
                  {header.email ? ` · ${header.email}` : ""}
                </div>
              </div>
              <div className="flex gap-8 flex-wrap">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Department</div>
                  <div className="font-semibold text-[#14213D]">{header.department || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Role</div>
                  <div className="font-semibold text-[#14213D]">{header.role || "—"}</div>
                </div>
                {header.experience_level && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">Experience</div>
                    <div className="font-semibold text-[#14213D]">{header.experience_level}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Status</div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
                    {statusBadge.label}
                  </span>
                </div>
              </div>
            </div>

            {availableWorkflows.length > 1 && (
              <div className="flex gap-2 mt-5 border-t border-gray-100 pt-4">
                {availableWorkflows.map((w) => (
                  <button
                    key={w}
                    onClick={() => setActiveWorkflow(w)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      activeWorkflow === w
                        ? "bg-[#14213D] text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {w === "onboarding" ? "Onboarding" : "Offboarding"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stage selector */}
          <div className="flex items-center mb-6 flex-wrap">
            {STAGES.map((s, idx) => {
              const status = stageStatus(s.key);
              const display = getStageDisplay(s.key, status, role);
              const locked = status === "locked";
              const roleLocked = isStageLockedForRole(s.key);
              const isActive = selectedStage === s.key;
              const hideHrStatus = role !== "hr" && s.key === "hr";
              return (
                <div key={s.key} className="flex items-center">
                  <button
                    onClick={() => setSelectedStage(s.key)}
                    className={`flex items-center gap-3 rounded-2xl border px-5 py-3 text-left transition ${
                      isActive
                        ? "border-[#14213D] bg-white shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0 ${display.circleColor}`}>
                      {hideHrStatus ? "1" : status === "completed" ? "✓" : idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-[#14213D] text-sm flex items-center gap-1.5 whitespace-nowrap">
                        {s.title}
                        {(locked || roleLocked) && <span className="text-xs">🔒</span>}
                      </div>
                      <div className={`text-xs whitespace-nowrap ${display.textColor}`}>
                        {display.text}
                      </div>
                    </div>
                  </button>
                  {idx < STAGES.length - 1 && (
                    <div className={`h-0.5 w-8 md:w-16 mx-1.5 rounded-full shrink-0 ${
                      status === "completed" ? "bg-green-500" : "bg-gray-200"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected stage panel */}
          {activeStageDef && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 md:p-8">
              <p className="text-xs font-semibold tracking-wide text-[#D9A653] uppercase">
                {activeStageDef.eyebrow}
              </p>
              <div className="flex items-center justify-between mt-1 mb-4 flex-wrap gap-2">
                <h3 className="text-2xl font-bold text-[#14213D] flex items-center gap-2">
                  {activeStageDef.title}
                  {activeRoleLocked && (
                    <span
                      title={`Read-only — only ${activeStageDef.title} reviewers can edit this stage`}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500"
                    >
                      🔒 View only
                    </span>
                  )}
                </h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                  activeLocked
                    ? "bg-gray-100 text-gray-500"
                    : activeStatus === "completed"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {activeLocked ? "Locked" : activeStatus === "completed" ? "Completed" : "In Progress"}
                </span>
              </div>

              {activeLocked && (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  {activeStageIndex === 0 
                    ? "This stage will open once previous requirements are met." 
                    : `This stage opens for editing once ${STAGES[activeStageIndex - 1]?.title} is completed. You can still review what's queued here.`}
                </div>
              )}

              {/* Master-detail layout */}
              <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
                {/* Left: task list */}
                <div className="space-y-2">
                  {activeTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                      <div className="text-3xl mb-2">📄</div>
                      <p className="text-sm text-gray-500">
                        {activeStageDef.key === "hr"
                          ? "Documents submitted by the employee will appear here once available."
                          : activeLocked 
                            ? `This stage will unlock once ${STAGES[activeStageIndex - 1]?.title} is completed.`
                            : "No tasks yet for this stage."}
                      </p>
                    </div>
                  )}
                  {activeTasks.map((t: any) => (
                    <TaskListButton
                      key={t.id}
                      task={t}
                      isSelected={selectedTaskId === t.id}
                      onSelect={() => setSelectedTaskId(t.id)}
                    />
                  ))}
                </div>

                {/* Right: detail panel */}
                <div>
                  {!selectedTask && activeStageDef && (
                    <EmptyTaskPanel stageKey={activeStageDef.key} />
                  )}
                  {selectedTask && (
                    <TaskDetailPanel
                      employeeId={employeeId}
                      employeeName={header.employee_name}
                      task={selectedTask}
                      workflow={selectedTask._workflow}
                      onChanged={load}
                      locked={activeLocked || activeRoleLocked}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}