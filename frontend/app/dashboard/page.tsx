"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

import { api } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

import Sidebar from "../components/Sidebar";
import DashboardHeader from "./DashboardHeader";
import StatCard from "../dashboard/StatCard";
import ChartCard from "./ChartCard";

function timeAgo(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;

  return `${Math.floor(mins / 60)} hr ago`;
}

/* ============================================================
   Sample Data (Frontend Only)
============================================================ */

const onboardingComparison = [
  { month: "Jan", manual: 15, ai: 8 },
  { month: "Feb", manual: 20, ai: 14 },
  { month: "Mar", manual: 22, ai: 20 },
  { month: "Apr", manual: 24, ai: 28 },
  { month: "May", manual: 21, ai: 35 },
  { month: "Jun", manual: 18, ai: 42 },
];

const offboardingComparison = [
  { month: "Jan", manual: 8, ai: 4 },
  { month: "Feb", manual: 10, ai: 7 },
  { month: "Mar", manual: 12, ai: 10 },
  { month: "Apr", manual: 13, ai: 14 },
  { month: "May", manual: 11, ai: 18 },
  { month: "Jun", manual: 9, ai: 21 },
];

const onboardingDepartments = [
  { name: "HR", value: 18 },
  { name: "IT", value: 42 },
  { name: "Finance", value: 15 },
  { name: "Sales", value: 28 },
  { name: "Marketing", value: 12 },
  { name: "Operations", value: 20 },
];

const offboardingDepartments = [
  { name: "HR", value: 8 },
  { name: "IT", value: 14 },
  { name: "Finance", value: 5 },
  { name: "Sales", value: 7 },
  { name: "Marketing", value: 3 },
  { name: "Operations", value: 6 },
];

const pendingApprovals = [
  { department: "HR", onboarding: 6, offboarding: 2 },
  { department: "IT", onboarding: 15, offboarding: 5 },
  { department: "Finance", onboarding: 5, offboarding: 2 },
  { department: "Sales", onboarding: 9, offboarding: 3 },
  { department: "Marketing", onboarding: 4, offboarding: 1 },
];

const COLORS = [
  "#14213D",
  "#D9A653",
  "#3B82F6",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
];

/* ============================================================
   AI Insights
============================================================ */

const aiInsights = [
  {
    title: "AI Agent Processing Faster",
    description:
      "AI onboarding has exceeded manual processing for the last three months.",
  },
  {
    title: "IT Department Load High",
    description:
      "IT currently handles the highest onboarding workload.",
  },
  {
    title: "Pending Approvals Increasing",
    description:
      "Approval queue increased by 18% compared with last week.",
  },
  {
    title: "Provisioning Delay",
    description:
      "Most onboarding delays occur during IT provisioning.",
  },
];

/* ============================================================
   Dashboard Component
============================================================ */

export default function DashboardPage() {
  useAuth();

  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api.dashboardSummary().then(setSummary);
  }, []);

  if (!summary) {
    return (
      <Sidebar>
        <div className="flex-1 p-6">
          Loading Dashboard...
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>

      <div className="min-h-screen bg-slate-50 p-6">

        <DashboardHeader />

        {/* Executive Header */}

        <div className="mt-6 mb-6 flex justify-between items-center">

          <div>

            <h1 className="text-3xl font-bold text-slate-800">
              Executive Workforce Dashboard
            </h1>

            <p className="text-gray-500 mt-1">
              Real-time employee onboarding & offboarding analytics
            </p>

          </div>

          <div className="bg-white px-5 py-3 rounded-xl shadow border">

            <p className="text-sm text-gray-500">
              Total Workforce
            </p>

            <h2 className="text-3xl font-bold text-[#14213D]">
              {summary.total_employees}
            </h2>

          </div>

        </div>

        {/* KPI Cards */}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">

          <StatCard
            label="Total Employees"
            value={summary.total_employees}
          />

          <StatCard
            label="Onboarded Today"
            value={summary.onboarded_today}
          />

          <StatCard
            label="Offboarded Today"
            value={summary.offboarded_today}
          />

          <StatCard
            label="Pending Onboarding"
            value={summary.pending_onboarding}
          />

          <StatCard
            label="Pending Offboarding"
            value={summary.pending_offboarding}
          />

          <StatCard
            label="Approval Pending"
            value={summary.pending_approvals}
          />

        </div>

        {/* ===========================
            PART 2 STARTS HERE
            (Charts Section)
        =========================== */}
        {/* ===========================
    PART 2 STARTS HERE
=========================== */}

<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">

  {/* Onboarding */}

  <ChartCard title="Manual vs AI Agent Onboarding">

    <div className="h-80">

      <ResponsiveContainer width="100%" height="100%">

        <LineChart data={onboardingComparison}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="month" />

          <YAxis
            label={{
              value: "Employee Count",
              angle: -90,
              position: "insideLeft",
            }}
          />

          <Tooltip />

          <Legend />

          <Line
            type="monotone"
            dataKey="manual"
            stroke="#2563EB"
            strokeWidth={3}
            name="Manual Process"
          />

          <Line
            type="monotone"
            dataKey="ai"
            stroke="#EF4444"
            strokeWidth={3}
            name="AI Agent"
          />

        </LineChart>

      </ResponsiveContainer>

    </div>

  </ChartCard>

  {/* Offboarding */}

  <ChartCard title="Manual vs AI Agent Offboarding">

    <div className="h-80">

      <ResponsiveContainer width="100%" height="100%">

        <LineChart data={offboardingComparison}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="month" />

          <YAxis
            label={{
              value: "Employee Count",
              angle: -90,
              position: "insideLeft",
            }}
          />

          <Tooltip />

          <Legend />

          <Line
            type="monotone"
            dataKey="manual"
            stroke="#2563EB"
            strokeWidth={3}
            name="Manual Process"
          />

          <Line
            type="monotone"
            dataKey="ai"
            stroke="#EF4444"
            strokeWidth={3}
            name="AI Agent"
          />

        </LineChart>

      </ResponsiveContainer>

    </div>

  </ChartCard>

</div>

{/* Department Charts */}

<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">

  <ChartCard title="Department-wise Onboarding">

    <div className="h-80">

      <ResponsiveContainer width="100%" height="100%">

        <PieChart>

          <Pie
            data={onboardingDepartments}
            dataKey="value"
            nameKey="name"
            outerRadius={110}
            label
          >

            {onboardingDepartments.map((entry, index) => (

              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
              />

            ))}

          </Pie>

          <Tooltip />

          <Legend />

        </PieChart>

      </ResponsiveContainer>

    </div>

  </ChartCard>

  <ChartCard title="Department-wise Offboarding">

    <div className="h-80">

      <ResponsiveContainer width="100%" height="100%">

        <PieChart>

          <Pie
            data={offboardingDepartments}
            dataKey="value"
            nameKey="name"
            outerRadius={110}
            label
          >

            {offboardingDepartments.map((entry, index) => (

              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
              />

            ))}

          </Pie>

          <Tooltip />

          <Legend />

        </PieChart>

      </ResponsiveContainer>

    </div>

  </ChartCard>

</div>

{/* Pending Approvals */}

<div className="mt-8">

  <ChartCard title="Department-wise Pending Approvals">

    <div className="h-96">

      <ResponsiveContainer width="100%" height="100%">

        <BarChart data={pendingApprovals}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="department" />

          <YAxis />

          <Tooltip />

          <Legend />

          <Bar
            dataKey="onboarding"
            fill="#2563EB"
            name="Onboarding"
          />

          <Bar
            dataKey="offboarding"
            fill="#EF4444"
            name="Offboarding"
          />

        </BarChart>

      </ResponsiveContainer>

    </div>

  </ChartCard>

</div>

{/* ===========================
    PART 3 STARTS HERE
=========================== */}
{/* ===========================
    AI Insights
=========================== */}

<div className="mt-8">

  <div className="bg-white rounded-xl border shadow-sm p-6">

    <div className="flex items-center justify-between mb-6">

      <div>

        <h2 className="text-xl font-bold text-slate-800">
          AI Executive Insights
        </h2>

        <p className="text-sm text-gray-500">
          AI-generated insights based on current workforce data
        </p>

      </div>

      <div className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold">
        AI Analytics
      </div>

    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

      {aiInsights.map((item, index) => (

        <div
          key={index}
          className="rounded-xl border border-slate-200 bg-slate-50 p-5 hover:shadow-md transition"
        >

          <h3 className="font-semibold text-[#14213D] mb-2">
            {item.title}
          </h3>

          <p className="text-sm text-gray-600 leading-6">
            {item.description}
          </p>

        </div>

      ))}

    </div>

  </div>

</div>

{/* ===========================
    Executive Summary
=========================== */}

<div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">

  <div className="bg-white rounded-xl border p-6">

    <h3 className="text-lg font-semibold mb-4">
      Workforce Summary
    </h3>

    <div className="space-y-4">

      <div className="flex justify-between">

        <span>Total Employees</span>

        <span className="font-bold">
          {summary.total_employees}
        </span>

      </div>

      <div className="flex justify-between">

        <span>Today's Onboarding</span>

        <span className="font-bold text-green-600">
          {summary.onboarded_today}
        </span>

      </div>

      <div className="flex justify-between">

        <span>Today's Offboarding</span>

        <span className="font-bold text-red-600">
          {summary.offboarded_today}
        </span>

      </div>

      <div className="flex justify-between">

        <span>Pending Approvals</span>

        <span className="font-bold text-orange-500">
          {summary.pending_approvals}
        </span>

      </div>

    </div>

  </div>

  <div className="bg-white rounded-xl border p-6">

    <h3 className="text-lg font-semibold mb-4">
      Process Efficiency
    </h3>

    <div className="space-y-5">

      <div>

        <p className="text-sm text-gray-500">
          AI Automation
        </p>

        <div className="w-full bg-gray-200 rounded-full h-3 mt-2">

          <div
            className="bg-green-500 h-3 rounded-full"
            style={{ width: "88%" }}
          />

        </div>

      </div>

      <div>

        <p className="text-sm text-gray-500">
          Manual Processing
        </p>

        <div className="w-full bg-gray-200 rounded-full h-3 mt-2">

          <div
            className="bg-blue-500 h-3 rounded-full"
            style={{ width: "62%" }}
          />

        </div>

      </div>

    </div>

  </div>

  <div className="bg-white rounded-xl border p-6">

    <h3 className="text-lg font-semibold mb-4">
      Key Highlights
    </h3>

    <ul className="space-y-3 text-sm text-gray-600">

      <li>• AI onboarding is 34% faster than manual onboarding.</li>

      <li>• IT department has the highest onboarding requests.</li>

      <li>• Approval backlog reduced compared to last month.</li>

      <li>• Offboarding SLA maintained above 95%.</li>

    </ul>

  </div>

</div>

{/* ===========================
    Recent Activity
=========================== */}

<div className="mt-8">

  <div className="bg-white rounded-xl border shadow-sm p-6">

    <div className="flex justify-between items-center mb-5">

      <h2 className="text-xl font-bold">
        Recent Activities
      </h2>

      <span className="text-sm text-gray-400">
        Live Updates
      </span>

    </div>

    <div className="space-y-4">

      {summary.recent_activity.map(
        (activity: any, index: number) => (

          <div
            key={index}
            className="flex justify-between items-center border-b pb-4"
          >

            <div>

              <p className="font-semibold text-slate-800">

                {activity.agent}

              </p>

              <p className="text-gray-600">

                {activity.action}

              </p>

            </div>

            <span className="text-sm text-gray-400">

              {timeAgo(activity.timestamp)}

            </span>

          </div>

        )
      )}

    </div>

  </div>

</div>

{/* ===========================
      PART 4 STARTS HERE
=========================== */}
{/* ===========================
      Executive Metrics
=========================== */}

<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">

  <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl p-6">

    <h3 className="text-sm uppercase tracking-wide opacity-80">
      AI Processing Rate
    </h3>

    <p className="text-4xl font-bold mt-3">
      88%
    </p>

    <p className="text-sm mt-2 opacity-80">
      Faster than manual process
    </p>

  </div>

  <div className="bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl p-6">

    <h3 className="text-sm uppercase tracking-wide opacity-80">
      Completion Rate
    </h3>

    <p className="text-4xl font-bold mt-3">
      96%
    </p>

    <p className="text-sm mt-2 opacity-80">
      Successful workflows
    </p>

  </div>

  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl p-6">

    <h3 className="text-sm uppercase tracking-wide opacity-80">
      Pending Tasks
    </h3>

    <p className="text-4xl font-bold mt-3">
      {summary.pending_approvals}
    </p>

    <p className="text-sm mt-2 opacity-80">
      Awaiting approvals
    </p>

  </div>

  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-6">

    <h3 className="text-sm uppercase tracking-wide opacity-80">
      Employee Growth
    </h3>

    <p className="text-4xl font-bold mt-3">
      +12%
    </p>

    <p className="text-sm mt-2 opacity-80">
      Compared to last month
    </p>

  </div>

</div>

{/* ===========================
      Dashboard Footer
=========================== */}

<div className="mt-10 mb-6">

  <div className="bg-white border rounded-xl p-5 flex justify-between items-center">

    <div>

      <h3 className="font-semibold text-slate-800">
        Executive Dashboard
      </h3>

      <p className="text-sm text-gray-500 mt-1">
        Workforce Analytics • AI Agent Monitoring • HR Operations
      </p>

    </div>

    <div className="text-right">

      <p className="text-sm text-gray-500">
        Last Updated
      </p>

      <p className="font-semibold">
        {new Date().toLocaleString()}
      </p>

    </div>

  </div>

</div>

      </div>

    </Sidebar>

  );
}