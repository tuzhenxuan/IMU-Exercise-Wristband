import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "lg";
}

export function Button({ variant = "secondary", size = "md", className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={`btn btn-${variant} btn-${size} ${className}`.trim()} {...rest} />;
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="back" onClick={onClick}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {children}
    </button>
  );
}

export function LogTable({ head, rows, numericFrom }: { head: string[]; rows: ReactNode[][]; numericFrom?: number }) {
  return (
    <table className="log-table">
      <thead>
        <tr>{head.map((h, i) => <th key={h} className={numericFrom != null && i >= numericFrom ? "num" : ""}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((cell, j) => <td key={j} className={numericFrom != null && j >= numericFrom ? "num" : ""}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
