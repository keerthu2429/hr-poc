"use client";

import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../lib/useAuth";
import { getToken } from "../../lib/api";
import Sidebar from "../components/Sidebar";

/* ============================================================
   Design tokens (matches workforce_overview_revamp_ForReview.html /
   the Workforce Overview dashboard, kept identical here)
============================================================ */

const T = {
  navy: "#0d1730",
  amber: "#c9791f",
  border: "#e6e8ee",
  bg: "#f5f6f9",
  text: "#111827",
  muted: "#6b7280",
  blue: "#3b6fe0",
  red: "#e0473b",
};

/* ============================================================
   API config — HR Assistant backend contract.
   Move this to an env var (NEXT_PUBLIC_HR_ASSISTANT_API_URL) before
   shipping so it isn't hardcoded to localhost.
============================================================ */

const HR_ASSISTANT_BASE_URL =
  process.env.NEXT_PUBLIC_HR_ASSISTANT_API_URL || "http://localhost:8000/hr-assistant";

type ChatSource = { document: string; chunk_id: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

async function askAssistant(
  employeeId: string,
  question: string,
  conversationId: string | null
): Promise<{ conversation_id: string; answer: string; sources: ChatSource[] }> {
  const token = getToken();

  const res = await fetch(`${HR_ASSISTANT_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      employee_id: employeeId,
      question,
      conversation_id: conversationId,
    }),
  });

  if (!res.ok) {
    // Surface the real reason instead of a generic network-failure message —
    // a 401 (missing/expired token) and a 500 (backend error) need different
    // fixes, and both used to look identical to the user.
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || "";
    } catch {
      // response wasn't JSON — ignore, we still have res.status
    }
    throw new Error(
      detail || `HR Assistant request failed (${res.status} ${res.statusText})`
    );
  }

  return res.json();
}

/* ============================================================
   Small building blocks
============================================================ */

function SourcePill({ source }: { source: ChatSource }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        color: T.muted,
        background: "#fff",
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: "3px 9px",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
      title={`chunk: ${source.chunk_id}`}
    >
      {source.document}
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "78%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          background: isUser ? T.navy : "#fff",
          color: isUser ? "#fff" : T.text,
          border: isUser ? "none" : `1px solid ${T.border}`,
          padding: "10px 14px",
          borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {message.content}
      </div>

      {!isUser && message.sources && message.sources.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {message.sources.map((s) => (
            <SourcePill key={s.chunk_id} source={s} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   HR Assistant Chat Page
============================================================ */

export default function HrAssistantPage() {
  const { user } = useAuth() as { user?: { employee_id?: string; id?: string } };
  const employeeId = user?.employee_id || user?.id || "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    // Without an employee id the backend has nothing to scope the answer
    // to — fail fast with a clear message instead of sending "" and
    // getting back a confusing 400/422 from the API.
    if (!employeeId) {
      setError("You need to be signed in to use the HR Assistant.");
      return;
    }

    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const data = await askAssistant(employeeId, question, conversationId);
      setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the HR Assistant. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  return (
    <Sidebar>
      <div style={{ minHeight: "100vh", background: T.bg, padding: "26px 32px" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: T.amber, fontWeight: 700 }}>
            HR SELF-SERVICE
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "4px 0 6px", color: T.text }}>
            AI HR Assistant
          </h1>
          <div style={{ fontSize: 13.5, color: T.muted }}>
            Ask about leave, policy, benefits, and other HR questions.
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            maxWidth: 720,
            display: "flex",
            flexDirection: "column",
            height: "65vh",
          }}
        >
          {/* Thread */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {messages.length === 0 && !loading && (
              <div style={{ fontSize: 13, color: T.muted, margin: "auto" }}>
                Ask a question to get started — e.g. "How many casual leaves do employees get?"
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}

            {loading && (
              <div style={{ alignSelf: "flex-start", fontSize: 13, color: T.muted }}>
                Thinking…
              </div>
            )}

            {error && (
              <div style={{ alignSelf: "flex-start", fontSize: 13, color: T.red }}>{error}</div>
            )}

            <div ref={threadEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: 14,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question"
              disabled={loading}
              style={{
                flex: 1,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                background: T.navy,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}