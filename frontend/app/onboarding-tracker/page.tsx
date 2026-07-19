"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import Sidebar from "../components/Sidebar";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  onboarding: { bg: "#fef3c7", color: "#b45309", label: "Onboarding" },
  documents_pending: { bg: "#dbeafe", color: "#1d4ed8", label: "Documents Pending" },
  active: { bg: "#dcfce7", color: "#15803d", label: "Active" },
};

const EXPERIENCE_STYLE: Record<string, { bg: string; color: string }> = {
  experienced: { bg: "#ede9fe", color: "#6d28d9" },
  fresher: { bg: "#dbeafe", color: "#1d4ed8" },
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Your API's field names for these two weren't confirmed, so try the
// common variants in order and fall back gracefully. Once you tell me
// the real key, this can collapse back to a single e.fieldName lookup.
function getEmployeeCode(e: any): string {
  return (
    e.employeeId ??
    e.employee_id ??
    e.empId ??
    e.emp_id ??
    e.employeeCode ??
    e.employee_code ??
    e.code ??
    e.id ??
    "—"
  );
}

function getExperience(e: any): string {
  return (
    e.experience ??
    e.experienceLevel ??
    e.experience_level ??
    e.seniority ??
    e.level ??
    e.experienceType ??
    ""
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { bg: "#f1f5f9", color: "#475569", label: status };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

function ExperienceBadge({ experience }: { experience: string }) {
  if (!experience) {
    return <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>;
  }
  const s = EXPERIENCE_STYLE[experience.toLowerCase()] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 12px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {experience.toLowerCase()}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            height: "100%",
            background: value >= 100 ? "#16a34a" : "#d97706",
            borderRadius: 999,
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: "#6b7280", width: 32, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

const TRACKER_STEPS = ["Registered", "Validation", "HR Track", "IT Track", "Security Track", "Manager Track"];

function computeProgress(steps: any[]): number {
  if (!steps || steps.length === 0) return 0;
  const latestByStep = new Map<string, any>();
  steps.forEach((s) => latestByStep.set(s.step, s));
  const completedCount = TRACKER_STEPS.filter((step) => latestByStep.get(step)?.status === "completed").length;
  return Math.round((completedCount / TRACKER_STEPS.length) * 100);
}

export default function OnboardingTrackerDirectoryPage() {
  useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");

  useEffect(() => {
    loadEmployees();
  }, []);

  const departments = useMemo(() => {
    const unique = Array.from(new Set(employees.map((e: any) => e.department).filter(Boolean)));
    return unique.sort();
  }, [employees]);

  async function loadEmployees() {
    setLoading(true);
    const all = await api.listEmployees();
    const relevant = all.filter((e: any) =>
      e.status === "onboarding" || e.status === "active" || e.status === "documents_pending"
    );

    const withProgress = await Promise.all(
      relevant.map(async (e: any) => {
        try {
          const steps = await api.onboardingStatus(e.id);
          return { ...e, progress: computeProgress(steps) };
        } catch {
          return { ...e, progress: 0 };
        }
      })
    );

    setEmployees(withProgress);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e: any) => {
      const matchesDept = department === "all" || e.department === department;
      const matchesSearch =
        !q ||
        [e.name, getEmployeeCode(e), e.department, getExperience(e)]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(q));
      return matchesDept && matchesSearch;
    });
  }, [employees, search, department]);

  return (
    <Sidebar>
      {/* --- FIXED: Increased maxWidth from 1160 to 1400 for wider content --- */}
      <main style={{ padding: 32, flex: 1, maxWidth: 1400, width: "100%", background: "#fdfcfa" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.5, color: "#d97706", textTransform: "uppercase" }}>
              People Operations
            </div>
            <h1 style={{ margin: "6px 0 6px", fontSize: 40, fontWeight: 800, color: "#0f172a", letterSpacing: -0.5 }}>
              Onboarding Tracker
            </h1>
            <p style={{ fontSize: 14, color: "#6b7280", marginTop: 0, marginBottom: 28 }}>
              View onboarding progress by employee. Select View to see the full step-by-step tracker.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              position: "relative",
              flex: "1 1 auto",
              background: "#fff",
              border: "1px solid #eef0f2",
              borderRadius: 14,
              boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: "absolute",
                left: 18,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px 16px 14px 44px",
                fontSize: 14,
                border: "none",
                outline: "none",
                background: "transparent",
                borderRadius: 14,
              }}
            />
          </div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={{
              padding: "0 16px",
              fontSize: 14,
              border: "1px solid #eef0f2",
              outline: "none",
              background: "#fff",
              borderRadius: 14,
              width: 180,
              height: 48,
              flexShrink: 0,
              color: department === "all" ? "#6b7280" : "#0f172a",
              boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
            }}
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              background: "#fdf1d9",
              color: "#92620f",
              padding: "13px 22px",
              borderRadius: 999,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {filtered.length} Employee{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading && <p>Loading...</p>}

        {!loading && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #eef0f2",
              borderRadius: 16,
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f8f5ee", textAlign: "left" }}>
                  <th style={thStyle}>Employee</th>
                  <th style={thStyle}>Employee ID</th>
                  <th style={thStyle}>Department</th>
                  <th style={thStyle}>Experience</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Progress</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Profile</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} style={{ borderTop: "1px solid #f3f1ea" }}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: "#0f172a",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {initials(e.name || "?")}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{e.name}</div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: "#94a3b8", fontSize: 13 }}>{getEmployeeCode(e)}</td>
                    <td style={tdStyle}>{e.department}</td>
                    <td style={tdStyle}>
                      <ExperienceBadge experience={getExperience(e)} />
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={e.status} />
                    </td>
                    <td style={tdStyle}>
                      <ProgressBar value={e.progress ?? 0} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => router.push(`/onboarding-tracker/${e.id}`)}
                        style={{
                          background: "#0f172a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px 20px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>
                      No employees match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Sidebar>
  );
}

const thStyle: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 12,
  fontWeight: 600,
  color: "#8a7658",
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const tdStyle: React.CSSProperties = {
  padding: "16px",
  verticalAlign: "middle",
};