// frontend/lib/api.js
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- token storage ---
export function setToken(token, role) {
  localStorage.setItem("access_token", token);
  localStorage.setItem("user_role", role);
}
export function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
}
export function getRole() {
  return typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
}
export function clearToken() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_role");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) clearToken(); // token expired/invalid -- force re-login
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  listEmployees: () => request("/employees"),
  getEmployee: (id) => request(`/employees/${id}`),
  createEmployee: (payload) =>
    request("/employees", { method: "POST", body: JSON.stringify(payload) }),
  syncHrmsNewHires: () => request("/hrms/sync/new-hires", { method: "POST" }),
  syncHrmsExits: () => request("/hrms/sync/exits", { method: "POST" }),
  onboardingStatus: (id) => request(`/onboarding/${id}/status`),
  offboardingStatus: (id) => request(`/offboarding/${id}/status`),
  accessRecommendation: (id) => request(`/access/${id}/recommendation`),
  assets: (id) => request(`/assets/${id}`),
  approvals: (id) => request(`/approvals/${id}`),
  decideApproval: (id, role, status) =>
    request(`/approvals/${id}/${role}/decide`, { method: "POST", body: JSON.stringify({ status }) }),
  auditTrail: (id) => request(`/audit/${id}`),
  dashboardSummary: () => request("/dashboard/summary"),
};