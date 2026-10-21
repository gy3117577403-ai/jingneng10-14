import type { ReactNode } from "react";
import "./ui.css";

export interface Column<T> {
  key: string;
  title: string;
  width?: number | string;
  align?: "left" | "center" | "right";
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  loading?: boolean;
}

export function Table<T>({ columns, data, rowKey, onRowClick, loading }: TableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align ?? "left" }}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? "row-clickable" : ""}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align ?? "left" }}>
                  {c.render ? c.render(row) : (row as any)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && data.length === 0 && (
        <div style={{ padding: "var(--space-4)" }}>
          <div className="empty"><div className="empty-icon">📭</div><div className="empty-title">暂无数据</div></div>
        </div>
      )}
      {loading && (
        <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--color-text-3)" }}>
          加载中…
        </div>
      )}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>共 <span className="num">{total}</span> 条</span>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      <span className="num">{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (k: T) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.key} className={`tab${t.key === active ? " active" : ""}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export interface TimelineNode {
  title: ReactNode;
  desc?: ReactNode;
  time?: string;
  state?: "done" | "now" | "todo";
  icon?: string;
}

export function Timeline({ nodes }: { nodes: TimelineNode[] }) {
  return (
    <div className="timeline">
      {nodes.map((n, i) => (
        <div className="timeline-item" key={i}>
          <div className={`timeline-dot ${n.state ?? ""}`}>{n.icon}</div>
          <div className="timeline-content">
            <div className="timeline-title">{n.title}</div>
            {n.desc && <div style={{ color: "var(--color-text-2)" }}>{n.desc}</div>}
            {n.time && <div className="timeline-time num">{formatTime(n.time)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function formatMoney(n: number) {
  return "¥" + n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
