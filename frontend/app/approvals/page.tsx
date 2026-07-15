"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { api } from "../../lib/api";

import { useAuth } from "../../lib/useAuth";

import Sidebar from "../components/Sidebar";
 
function Search({ className }: { className?: string }) {

  return (
<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<circle cx="11" cy="11" r="8" />
<line x1="21" y1="21" x2="16.65" y2="16.65" />
</svg>

  );

}
 
function initials(name: string) {

  return (name || "?")

    .split(" ")

    .filter(Boolean)

    .slice(0, 2)

    .map((p) => p[0]?.toUpperCase())

    .join("");

}
 
const STATUS_STYLES: Record<string, string> = {

  pending: "bg-amber-100 text-amber-700",

  approved: "bg-green-100 text-green-700",

  rejected: "bg-red-100 text-red-700",

};
 
type EmployeeSummary = {

  employee_id: string;

  employee_name: string;

  department: string;

  role?: string;

  experience_level?: string;

  workflow_types: string[];

  pendingCount: number;

  totalCount: number;

  overallStatus: "pending" | "approved" | "rejected";

};
 
export default function ApprovalsDirectoryPage() {

  const { role } = useAuth();

  const router = useRouter();
 
  const [items, setItems] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [department, setDepartment] = useState("all");
 
  useEffect(() => {

    load();

  }, [role]);
 
  async function load() {

    if (!role) return;

    setLoading(true);

    const data = await api.approvalsForRole(role);

    setItems(data);

    setLoading(false);

  }
 
  // Group raw approval items (which can be per workflow) into one row per employee

  const employees: EmployeeSummary[] = useMemo(() => {

    const map = new Map<string, EmployeeSummary>();
 
    items.forEach((item: any) => {

      const existing = map.get(item.employee_id);

      const pending =

        item.workflow_type === "onboarding"

          ? (item.tasks || []).filter((t: any) => t.status === "pending").length

          : item.approval_status === "pending" ? 1 : 0;

      const total =

        item.workflow_type === "onboarding"

          ? (item.tasks || []).length

          : 1;
 
      if (existing) {

        existing.workflow_types.push(item.workflow_type);

        existing.pendingCount += pending;

        existing.totalCount += total;

      } else {

        map.set(item.employee_id, {

          employee_id: item.employee_id,

          employee_name: item.employee_name,

          department: item.department,

          role: item.role,

          experience_level: item.experience_level,

          workflow_types: [item.workflow_type],

          pendingCount: pending,

          totalCount: total,

          overallStatus: "pending",

        });

      }

    });
 
    return Array.from(map.values()).map((e) => ({

      ...e,

      overallStatus: e.pendingCount > 0 ? "pending" : "approved",

    }));

  }, [items]);
 
  const departments = useMemo(() => {

    const unique = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

    return unique.sort();

  }, [employees]);
 
  const filtered = useMemo(() => {

    const q = search.trim().toLowerCase();

    return employees.filter((e) => {

      const matchesDept = department === "all" || e.department === department;

      const matchesSearch =

        !q ||

        [e.employee_name, e.employee_id, e.department, e.role, e.experience_level]

          .filter(Boolean)

          .some((v) => String(v).toLowerCase().includes(q));

      return matchesDept && matchesSearch;

    });

  }, [employees, search, department]);
 
  return (
<Sidebar>
<div className="bg-[#FAFAF9] min-h-screen w-full p-6 flex-1">

        {/* Header */}
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
<div>
<p className="uppercase tracking-[0.25em] text-xs text-[#D9A653]">

              People Operations
</p>
<h2 className="mt-2 text-4xl font-bold text-[#14213D]">

              Approval Dashboard
</h2>
<p className="mt-2 text-gray-500">

              Showing items for your role: <strong className="text-[#14213D]">{role}</strong>. Select View to approve or reject individual tasks.
</p>
</div>
</div>
 
        {/* Search */}
<div className="mt-8 w-full">
<div className="flex items-center gap-4 mb-5">
<div className="relative w-full">
<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
<input

                value={search}

                onChange={(e) => setSearch(e.target.value)}

                placeholder="Search employees..."

                className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#D9A653] focus:border-transparent"

              />
</div>
 
            <select

              value={department}

              onChange={(e) => setDepartment(e.target.value)}

              className="shrink-0 w-48 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-[#D9A653] focus:border-transparent"
>
<option value="all">All departments</option>

              {departments.map((d) => (
<option key={d} value={d}>{d}</option>

              ))}
</select>
 
            <div className="whitespace-nowrap rounded-full bg-[#D9A653]/10 px-4 py-2.5 text-sm font-medium text-[#14213D]">

              {filtered.length} Employee{filtered.length === 1 ? "" : "s"}
</div>
</div>
 
          {/* Table */}
<div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
<table className="w-full table-fixed">
<thead className="bg-[#F4F1EC] border-b border-gray-200">
<tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
<th className="p-3 w-[24%]">Employee</th>
<th className="p-3 w-[14%]">Department</th>
<th className="p-3 w-[16%]">Workflow</th>
<th className="p-3 w-[14%]">Experience</th>
<th className="p-3 w-[14%]">Pending Tasks</th>
<th className="p-3 w-[10%]">Status</th>
<th className="p-3 w-[8%]">Profile</th>
</tr>
</thead>
 
              <tbody>

                {loading && (
<tr>
<td colSpan={7} className="p-10 text-center text-gray-500">

                      Loading...
</td>
</tr>

                )}
 
                {!loading && filtered.map((e, idx) => (
<tr

                    key={e.employee_id}

                    className={`border-t border-gray-100 hover:bg-gray-50 transition ${

                      idx % 2 === 1 ? "bg-gray-50/50" : ""

                    }`}
>
<td className="p-3 py-3.5 align-top">
<div className="flex items-center gap-2">
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14213D] text-white text-xs font-bold shrink-0">

                          {initials(e.employee_name)}
</div>
<div className="min-w-0">
<div className="font-semibold text-[#14213D] truncate">

                            {e.employee_name}
</div>
</div>
</div>
</td>
 
                    <td className="p-3 py-3.5 align-top truncate">{e.department}</td>
 
                    <td className="p-3 py-3.5 align-top text-xs text-gray-600 capitalize">

                      {e.workflow_types.join(", ")}
</td>
 
                    <td className="p-3 py-3.5 align-top">

                      {e.experience_level ? (
<span

                          className={`rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${

                            e.experience_level.toLowerCase() === "fresher"

                              ? "bg-sky-100 text-sky-700"

                              : "bg-violet-100 text-violet-700"

                          }`}
>

                          {e.experience_level.toLowerCase()}
</span>

                      ) : (

                        "—"

                      )}
</td>
 
                    <td className="p-3 py-3.5 align-top text-sm text-gray-700">

                      {e.pendingCount} / {e.totalCount}
</td>
 
                    <td className="p-3 py-3.5 align-top">
<span

                        className={`inline-block rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${

                          STATUS_STYLES[e.overallStatus]

                        }`}
>

                        {e.overallStatus === "pending" ? "Pending" : "Cleared"}
</span>
</td>
 
                    <td className="p-3 py-3.5 align-top">
<button

                        onClick={() => router.push(`/approvals/${e.employee_id}`)}

                        className="rounded-lg bg-[#14213D] px-3 py-1.5 text-xs text-white hover:bg-[#243654] transition"
>

                        View
</button>
</td>
</tr>

                ))}
 
                {!loading && filtered.length === 0 && (
<tr>
<td colSpan={7} className="p-10 text-center text-gray-500">

                      No approvals found.
</td>
</tr>

                )}
</tbody>
</table>
</div>
</div>
</div>
</Sidebar>

  );

}
 
