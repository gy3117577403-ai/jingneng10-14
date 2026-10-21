import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import "./ui.css";

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label className="field-label">
        {required && <span className="required">*</span>}
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 12, color: "var(--color-text-3)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${props.className ?? ""}`} {...props} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select ${props.className ?? ""}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`textarea ${props.className ?? ""}`} {...props} />;
}

export function SearchInput({ value, onChange, placeholder = "搜索…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search-box" style={{ width: 280 }}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function FormRow({ children }: { children: ReactNode }) {
  return <div className="form-row">{children}</div>;
}
