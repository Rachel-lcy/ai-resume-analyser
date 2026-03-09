"use client";

import { useState } from "react";

export default function AccessCodeModal({ open, onClose, onSuccess }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/access/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data?.message || "Invalid access code.");
        return;
      }

      setCode("");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <h2 style={{ marginBottom: "8px" }}>Recruiter Demo Access</h2>
        <p style={{ marginBottom: "16px", color: "#666" }}>
          Enter the access code to unlock the live AI analysis demo.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter access code"
            style={inputStyle}
          />

          {error ? (
            <p style={{ color: "crimson", marginTop: "10px" }}>{error}</p>
          ) : null}

          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={onClose}
              style={secondaryButtonStyle}
              disabled={loading}
            >
              Cancel
            </button>

            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? "Verifying..." : "Unlock Demo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modalStyle = {
  width: "100%",
  maxWidth: "420px",
  background: "#fff",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  outline: "none",
  fontSize: "16px",
};

const buttonRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "18px",
};

const primaryButtonStyle = {
  background: "#4338ca",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "10px 16px",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  background: "#fff",
  color: "#111",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "10px 16px",
  cursor: "pointer",
};