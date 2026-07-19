"use client";
import { useEffect, useState } from "react";
import { api, API_BASE } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import Sidebar from "../components/Sidebar";

// ---- Inline SVG icons (no external icon package, per project convention) ----
function IconFileText({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6M9 9h1" />
    </svg>
  );
}

function IconDownload({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

function IconLoader({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const REPORT_TYPES = [
  {
    value: "onboarding",
    label: "Onboarding Report",
    description: "New-hire progress, document status, and task completion.",
  },
  {
    value: "offboarding",
    label: "Offboarding Report",
    description: "Exit checklist, asset return status, and access revocation.",
  },
];

export default function ReportsPage() {
  useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reportType, setReportType] = useState("onboarding");
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listEmployees().then((all) => {
      setEmployees(all);
      if (all.length) setSelectedId(all[0].id);
    });
  }, []);

  useEffect(() => {
    setReady(false);
    setError("");
  }, [selectedId, reportType]);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      await api.generateReport(selectedId, reportType);
      setReady(true);
    } catch (e) {
      setError("Something went wrong while generating the report. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const selectedEmployee = employees.find((e) => e.id === selectedId);
  const selectedReport = REPORT_TYPES.find((r) => r.value === reportType);
  const downloadUrl = `${API_BASE}/reports/${selectedId}/download?report_type=${reportType}`;

  return (
    <Sidebar>
      <main className="flex-1 min-h-screen bg-[#FAFAF9]">
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-8 border-b border-[#E5E7EB] bg-white">
          <div>
            <h1 className="text-2xl font-bold text-[#14213D]">Reports</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Generate onboarding and offboarding reports for any employee.
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#14213D] text-white flex items-center justify-center font-bold">
            <IconFileText />
          </div>
        </div>

        <div className="p-8 max-w-7xl">
          <div className="grid lg:grid-cols-3 gap-6 items-start">
            {/* Left column: configuration + summary */}
            <div className="lg:col-span-2 space-y-6">
              {/* Report configuration card */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm p-6">
                <h2 className="text-sm font-medium text-[#D9A653] uppercase tracking-wide mb-4">
                  Report Configuration
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Employee select */}
                  <div>
                    <label className="block text-sm font-medium text-[#14213D] mb-1.5">
                      Employee
                    </label>
                    <select
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                      className="w-full h-12 rounded-xl border border-[#E5E7EB] px-4 text-sm text-[#14213D] bg-white focus:outline-none focus:ring-2 focus:ring-[#D9A653] transition"
                    >
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} — {e.department}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Report type select */}
                  <div>
                    <label className="block text-sm font-medium text-[#14213D] mb-1.5">
                      Report Type
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full h-12 rounded-xl border border-[#E5E7EB] px-4 text-sm text-[#14213D] bg-white focus:outline-none focus:ring-2 focus:ring-[#D9A653] transition"
                    >
                      {REPORT_TYPES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Report type description */}
                {selectedReport && (
                  <p className="text-sm text-[#9CA3AF] mt-3">{selectedReport.description}</p>
                )}

                <div className="border-t border-[#E5E7EB] mt-6 pt-6 flex items-center gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={!selectedId || generating}
                    className="h-12 px-6 rounded-xl bg-[#14213D] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#D9A653] disabled:opacity-60 disabled:hover:bg-[#14213D] transition duration-300"
                  >
                    {generating ? (
                      <>
                        <IconLoader />
                        Generating...
                      </>
                    ) : (
                      <>
                        <IconFileText />
                        Generate Report
                      </>
                    )}
                  </button>

                  {ready && (
                    <span className="text-sm text-[#166534] flex items-center gap-1.5">
                      <IconCheck />
                      Ready — download it from the snapshot panel
                    </span>
                  )}
                </div>

                {error && (
                  <div className="mt-4 rounded-xl bg-[#FEE2E2] text-[#991B1B] text-sm px-4 py-3">
                    {error}
                  </div>
                )}
              </div>

              {/* Status card */}
              {selectedEmployee && (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm p-6">
                  <h2 className="text-sm font-medium text-[#D9A653] uppercase tracking-wide mb-4">
                    Summary
                  </h2>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-[#14213D]">
                        {selectedEmployee.name}
                      </p>
                      <p className="text-sm text-[#6B7280]">{selectedEmployee.department}</p>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                        ready
                          ? "bg-[#DCFCE7] text-[#166534]"
                          : "bg-[#FEF3C7] text-[#92400E]"
                      }`}
                    >
                      {ready && <IconCheck />}
                      {ready ? "Report Ready" : "Not Generated"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right column: employee snapshot */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-medium text-[#D9A653] uppercase tracking-wide mb-4">
                Employee Snapshot
              </h2>
              {selectedEmployee ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#14213D] text-white flex items-center justify-center font-bold text-sm">
                      {selectedEmployee.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#14213D]">
                        {selectedEmployee.name}
                      </p>
                      <p className="text-xs text-[#9CA3AF]">{selectedEmployee.department}</p>
                    </div>
                  </div>

                  <div className="border-t border-[#E5E7EB] pt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6B7280]">Report type</span>
                      <span className="font-medium text-[#14213D]">{selectedReport?.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6B7280]">Status</span>
                      <span
                        className={`font-medium ${
                          ready ? "text-[#166534]" : "text-[#92400E]"
                        }`}
                      >
                        {ready ? "Ready" : "Pending"}
                      </span>
                    </div>
                  </div>

                  {ready && (
                    <a href={downloadUrl} target="_blank" rel="noreferrer" className="block">
                      <button className="w-full h-11 rounded-xl bg-[#14213D] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#D9A653] transition duration-300">
                        <IconDownload />
                        Download PDF
                      </button>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#9CA3AF]">Select an employee to see their snapshot.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </Sidebar>
  );
}