"use client";

import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { Fraunces } from "next/font/google";
import { api, setToken } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

// Display serif for the wordmark + stage numerals — swap Inter/system-sans
// out for something with more personality on the brand panel only.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

// ==========================
// Lifecycle motif
// ==========================
// Was a static 01/02 stack. Replaced with a literal "lifecycle rail":
// a vertical line with pulses that travel along it, since the product's
// whole pitch is a continuous lifecycle, not a two-item list.

const STAGES = [
  {
    label: "Onboarding",
    note: "Every new hire moves from signed offer to a confident first day, automatically.",
  },
  {
    label: "Offboarding",
    note: "When someone leaves, access, assets, and paperwork are wrapped up cleanly.",
  },
];

function LifecycleRail() {
  return (
    <div className="relative mt-12 max-w-sm">
      {/* the rail — gold where it leaves Onboarding, teal where it
          arrives at Offboarding, with a chevron marking the handoff
          so the line reads as "flows into", not just a divider */}
      <div className="absolute left-[13px] top-[14px] bottom-[14px] w-px bg-gradient-to-b from-[#D9A653] via-[#D9A653]/40 to-[#4FD1C5]">
        <span className="lifecycle-pulse" style={{ animationDelay: "0s" }} />
        <span className="lifecycle-pulse" style={{ animationDelay: "1.5s" }} />
        <span className="lifecycle-pulse" style={{ animationDelay: "3s" }} />

        <svg
          viewBox="0 0 12 12"
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white/30"
          fill="none"
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {STAGES.map((stage, i) => (
        <div key={stage.label} className="relative flex items-start gap-5 py-4">
          <span
            className={`${fraunces.className} relative z-[1] flex h-7 w-7 flex-none items-center justify-center rounded-full border text-xs
              ${i === 0
                ? "border-[#D9A653] text-[#D9A653]"
                : "border-[#4FD1C5] text-[#4FD1C5]"}
              bg-[#0F1B31]`}
          >
            0{i + 1}
          </span>

          <div>
            <p className="text-[17px] font-semibold text-[#F7F5F0]">
              {stage.label}
            </p>
            <p className="text-[13.5px] leading-snug text-white/50">
              {stage.note}
            </p>
          </div>
        </div>
      ))}

      <style jsx>{`
        .lifecycle-pulse {
          position: absolute;
          left: -1.5px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #4fd1c5;
          box-shadow: 0 0 8px 2px rgba(79, 209, 197, 0.7);
          animation: travel 4.5s linear infinite;
        }
        @keyframes travel {
          0% {
            top: 0%;
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lifecycle-pulse {
            animation: none;
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  // Existing authentication hook
  const { role, logout } = useAuth();

  // Existing login state
  const [email, setEmail] = useState("hr@example.com");
  const [password, setPassword] = useState("demo123");

  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  async function handleLogin() {
    const newErrors = {
      email: "",
      password: "",
    };

    let isValid = true;

    if (!email.trim()) {
      newErrors.email = "Email is required";
      isValid = false;
    }

    if (!password.trim()) {
      newErrors.password = "Password is required";
      isValid = false;
    }

    setErrors(newErrors);

    if (!isValid) return;

    setError("");
    setLoading(true);

    try {
      const result = await api.login(email, password);

      setToken(result.access_token, result.role);

      router.push("/dashboard");
    } catch (e) {
      // setError("Login failed -- check credentials");

      setErrors({
        email: "",
        password: "Invalid email or password",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FAFAF9]">
      {/* Left */}

      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-center overflow-hidden bg-[#0B1220] p-20">
        {/* ambient glow, replaces the flat oversized "4" watermark */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 15% 0%, rgba(79,209,197,0.16), transparent 60%), radial-gradient(70% 60% at 100% 100%, rgba(217,166,83,0.14), transparent 60%)",
          }}
        />

        <div className="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-[#D9A653] via-[#D9A653] to-transparent" />

        <p className="relative text-[#D9A653] uppercase tracking-[0.25em] text-xs">
          People Operations Platform
        </p>

        <h1
          className={`${fraunces.className} relative text-5xl leading-[1.1] font-medium text-white mt-3 tracking-tight max-w-md`}
        >
          Vantaracg{" "}
          <em className="text-[#4FD1C5] font-light not-italic italic">
            HR Agent
          </em>
        </h1>

        <p className="relative text-gray-300 mt-5 max-w-sm">
          One system for every stage of the employee lifecycle.
        </p>

        <div className="relative">
          <LifecycleRail />
        </div>
      </div>

      {/* Right */}

      <div className="w-full lg:w-1/2 flex justify-center items-center px-6">
        <div className="w-full max-w-[380px]">
          <p className="uppercase tracking-[0.25em] text-[#D9A653] text-xs">
            Sign In
          </p>

          <h2 className="text-4xl font-bold text-[#14213D] mt-2">
            Welcome
          </h2>

          <p className="text-gray-500 mt-2">
            Enter your credentials.
          </p>

          {/* <p className="text-xs text-gray-400 mt-2">
            Demo users:
            <br />
            hr@example.com
            <br />
            manager@example.com
            <br />
            it@example.com
            <br />
            security@example.com
            <br />
            Password: demo123
          </p> */}

          {/* Email */}

          <div className="mt-8">
            <label className="text-sm">Email</label>

            <input
              type="email"
              value={email}
              placeholder="hr@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full border-b p-2 outline-none"
            />

            {errors.email && (
              <p className="text-red-500 text-xs mt-1">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}

          <div className="mt-6">
            <label className="text-sm">Password</label>

            <div className="flex border-b items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                placeholder="********"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2 outline-none"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="px-2"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {errors.password && (
              <p className="text-red-500 text-xs mt-1">
                {errors.password}
              </p>
            )}

            {error && (
              <p className="text-red-500 text-xs mt-2">
                {error}
              </p>
            )}
          </div>

          {/* Remember */}

          <div className="flex justify-between mt-6">
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) =>
                  setRememberMe(e.target.checked)
                }
              />

              Remember me
            </label>

            <a
              href="#"
              className="text-[#D9A653] text-sm"
            >
              Forgot Password?
            </a>
          </div>

          {/* Login */}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-8 bg-[#14213D] text-white py-3 hover:bg-[#D9A653] transition-colors disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}