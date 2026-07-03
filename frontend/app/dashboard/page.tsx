"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
      <p className="text-sm text-gray-500">{label}</p>
      <h3 className="mt-3 text-4xl font-bold text-[#14213D]">{value}</h3>
    </div>
  );
}

export default function DashboardPage() {
  const { role, logout } = useAuth();
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api.dashboardSummary().then(setSummary);
  }, []);

  if (!summary) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FAFAF9]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#14213D]">Executive Dashboard</h2>
          <p className="mt-3 text-gray-500">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex">
      <aside className="hidden lg:flex w-72 flex-col bg-[#14213D] text-white">
        <div className="p-8 border-b border-white/10">
          <p className="uppercase tracking-[0.25em] text-xs text-[#D9A653]">
            People Operations
          </p>
          <h1 className="mt-2 text-2xl font-bold">HR Platform</h1>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <div className="rounded-lg bg-white/10 px-4 py-3">Dashboard</div>
          <div className="px-4 py-3 text-white/70">Employee Directory</div>
          <div className="px-4 py-3 text-white/70">Departments</div>
          <div className="px-4 py-3 text-white/70">Reports</div>
          <div className="px-4 py-3 text-white/70">Settings</div>
        </nav>

        <div className="p-6 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full rounded-lg border border-white/20 py-3 hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
          <div>
            <p className="uppercase tracking-[0.25em] text-xs text-[#D9A653]">
              Executive Dashboard
            </p>
            <h2 className="mt-2 text-4xl font-bold text-[#14213D]">
              Workforce Overview
            </h2>
            <p className="mt-2 text-gray-500">
              Monitor employee lifecycle and organizational health.
            </p>
          </div>

          <div className="rounded-xl border bg-white px-5 py-3 shadow-sm">
            Logged in as <span className="font-semibold capitalize">{role}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total Employees" value={summary.total_employees} />
          <StatCard label="Onboarding In Progress" value={summary.onboarding_in_progress} />
          <StatCard label="Offboarding In Progress" value={summary.offboarding_in_progress} />
          <StatCard label="Pending Approvals" value={summary.pending_approvals} />
          <StatCard label="High Risk Employees" value={summary.high_risk_employees} />
          <StatCard
            label="Compliance Completion"
            value={`${summary.compliance_completion_pct}%`}
          />
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-xl font-semibold text-[#14213D]">
              Department-wise Employees
            </h3>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.department_distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-30}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#D9A653" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-xl font-semibold text-[#14213D]">
              Role-wise Distribution
            </h3>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.role_distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-30}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#14213D" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-[#14213D]">
            HR Operations Summary
          </h3>

          <div className="mt-6 grid gap-6 md:grid-cols-4">
            <div>
              <p className="text-gray-500 text-sm">Compliance</p>
              <p className="text-2xl font-bold">{summary.compliance_completion_pct}%</p>
            </div>

            <div>
              <p className="text-gray-500 text-sm">Pending Approvals</p>
              <p className="text-2xl font-bold">{summary.pending_approvals}</p>
            </div>

            <div>
              <p className="text-gray-500 text-sm">High Risk</p>
              <p className="text-2xl font-bold">{summary.high_risk_employees}</p>
            </div>

            <div>
              <p className="text-gray-500 text-sm">Employees</p>
              <p className="text-2xl font-bold">{summary.total_employees}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}