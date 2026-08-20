"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandHeader from "@/components/BrandHeader";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't log in.");
        setSubmitting(false);
        return;
      }
      router.push("/admin/setup");
    } catch {
      setError("Couldn't reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <div className="cc-container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <BrandHeader size="lg" />
      </div>
      <div className="cc-title" style={{ marginBottom: 24, textAlign: "center" }}>
        Command Login
      </div>
      <div className="cc-card">
        <label className="cc-label">Email</label>
        <input className="cc-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        <label className="cc-label">Password</label>
        <input
          className="cc-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <div className="cc-error">{error}</div>}
        <button className="cc-btn cc-btn-primary cc-btn-block" disabled={submitting} onClick={submit}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </div>
    </div>
  );
}
