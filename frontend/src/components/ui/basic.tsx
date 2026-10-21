import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ui.css";

type BtnVariant = "primary" | "default" | "text" | "danger";
type BtnSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
}

export function Button({ variant = "default", size = "md", loading, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "处理中…" : children}
    </button>
  );
}

export function Card({ children, hover, className = "", style }: { children: ReactNode; hover?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`card${hover ? " card-hover" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <div className="card-title">{children}</div>;
}

type BadgeVariant = "blue" | "green" | "orange" | "red" | "gray" | "purple";

export function Badge({ variant = "gray", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

/** 状态徽标：报价单据状态 / 审批状态 */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { v: BadgeVariant; label: string }> = {
    draft: { v: "gray", label: "草稿" },
    pending: { v: "orange", label: "待审批" },
    approved: { v: "green", label: "已批准" },
    rejected: { v: "red", label: "已驳回" },
    ordered: { v: "blue", label: "已转订单" },
    none: { v: "gray", label: "未提交" },
    cancelled: { v: "gray", label: "已撤回" },
  };
  const m = map[status] ?? { v: "gray" as BadgeVariant, label: status };
  return <Badge variant={m.v}>{m.label}</Badge>;
}

const AVATAR_COLORS = [
  "linear-gradient(135deg,#5ac8fa,#0071e3)",
  "linear-gradient(135deg,#7dffa8,#34c759)",
  "linear-gradient(135deg,#ffd60a,#ff9f0a)",
  "linear-gradient(135deg,#ff9f0a,#ff375f)",
  "linear-gradient(135deg,#b28dff,#a259ff)",
];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const idx = (name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % AVATAR_COLORS.length;
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.4, background: AVATAR_COLORS[idx] }}
      title={name}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function Empty({ icon = "📭", title = "暂无数据", desc }: { icon?: string; title?: string; desc?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
    </div>
  );
}
