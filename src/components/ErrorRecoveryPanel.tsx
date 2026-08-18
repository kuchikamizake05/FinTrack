"use client";

import { useEffect, useRef, type CSSProperties } from "react";

type ErrorRecoveryPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  retryLabel: string;
  dashboardLabel: string;
  onRetry?: () => void;
};

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "flex",
    minHeight: "100svh",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    padding: "24px",
    background: "linear-gradient(180deg, #e9f8ee 0%, #f7faf7 55%, #ffffff 100%)",
    color: "#0f2b1d",
    fontFamily: "Manrope, Arial, sans-serif",
  },
  card: {
    width: "min(100%, 32rem)",
    boxSizing: "border-box",
    border: "1px solid rgba(22, 101, 52, 0.15)",
    borderRadius: "28px",
    background: "rgba(255, 255, 255, 0.96)",
    padding: "clamp(1.5rem, 5vw, 2.5rem)",
    textAlign: "center",
    boxShadow: "0 24px 70px rgba(18, 53, 36, 0.12)",
  },
  mark: {
    display: "grid",
    width: "52px",
    height: "52px",
    margin: "0 auto",
    placeItems: "center",
    borderRadius: "16px",
    background: "#123524",
    color: "#4ade80",
    fontSize: "14px",
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  eyebrow: {
    margin: "20px 0 0",
    color: "#15803d",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: "10px 0 0",
    color: "#123524",
    fontSize: "clamp(1.5rem, 5vw, 2rem)",
    fontWeight: 800,
    letterSpacing: "-0.045em",
    lineHeight: 1.16,
  },
  description: {
    margin: "14px auto 0",
    maxWidth: "27rem",
    color: "#425f50",
    fontSize: "14px",
    lineHeight: 1.65,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "center",
    marginTop: "24px",
  },
  primaryAction: {
    minHeight: "44px",
    border: 0,
    borderRadius: "12px",
    background: "#15803d",
    color: "#ffffff",
    cursor: "pointer",
    padding: "10px 16px",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 800,
  },
  secondaryAction: {
    display: "inline-flex",
    minHeight: "44px",
    boxSizing: "border-box",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(18, 53, 36, 0.16)",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#123524",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 800,
    textDecoration: "none",
  },
};

export function ErrorRecoveryPanel({
  eyebrow,
  title,
  description,
  retryLabel,
  dashboardLabel,
  onRetry,
}: ErrorRecoveryPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main style={styles.shell}>
      <section aria-labelledby="fintrack-error-title" style={styles.card}>
        <div aria-hidden="true" style={styles.mark}>FT</div>
        <p style={styles.eyebrow}>{eyebrow}</p>
        <h1 id="fintrack-error-title" ref={headingRef} tabIndex={-1} style={styles.title}>{title}</h1>
        <p role="alert" style={styles.description}>{description}</p>
        <div style={styles.actions}>
          {onRetry && <button type="button" onClick={onRetry} style={styles.primaryAction}>{retryLabel}</button>}
          <a href="/dashboard" style={styles.secondaryAction}>{dashboardLabel}</a>
        </div>
      </section>
    </main>
  );
}
