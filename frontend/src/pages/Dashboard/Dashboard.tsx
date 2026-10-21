import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { quoteApi, approvalApi } from "../../api/endpoints";
import type { Quote, Approval } from "../../types";
import { Card, CardTitle, Button, StatusBadge, Avatar } from "../../components/ui/basic";
import { formatMoney, formatTime } from "../../components/ui/data";
import "./dashboard.css";

interface Stat {
  label: string;
  value: string;
  icon: string;
  bg: string;
  link: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [todos, setTodos] = useState<Approval[]>([]);

  useEffect(() => {
    quoteApi.list({ page: 1, pageSize: 5 }).then((r) => setQuotes(r.list)).catch(() => {});
    approvalApi.list("todo", undefined, 1, 5).then((r) => setTodos(r.list)).catch(() => {});
  }, []);

  const pending = quotes.filter((q) => q.docStatus === "pending").length;
  const monthTotal = quotes.reduce((s, q) => s + q.totalAmount, 0);
  const ordered = quotes.filter((q) => q.docStatus === "ordered").length;

  const stats: Stat[] = [
    { label: "本月报价单", value: String(quotes.length), icon: "📝", bg: "linear-gradient(135deg,#ffd60a,#ff9f0a)", link: "/quotes" },
    { label: "待审批", value: String(pending), icon: "⏳", bg: "linear-gradient(135deg,#ff9f0a,#ff375f)", link: "/approvals" },
    { label: "报价总额", value: "¥" + (monthTotal / 10000).toFixed(1) + "万", icon: "💰", bg: "linear-gradient(135deg,#7dffa8,#34c759)", link: "/quotes" },
    { label: "已转订单", value: String(ordered), icon: "📦", bg: "linear-gradient(135deg,#5ac8fa,#0071e3)", link: "/quotes" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">工作台</div>
          <div className="page-desc">早上好，开始今天的协同工作吧</div>
        </div>
        <Button variant="primary" onClick={() => navigate("/quotes/new")}>＋ 新建报价单</Button>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <Card key={s.label} hover className="stat-card" >
            <div onClick={() => navigate(s.link)} style={{ cursor: "pointer" }}>
              <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
              <div className="stat-value num">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="dash-grid">
        <Card>
          <div className="dash-card-head">
            <CardTitle>待我审批</CardTitle>
            <Button variant="text" size="sm" onClick={() => navigate("/approvals")}>查看全部 ›</Button>
          </div>
          {todos.length === 0 && <div style={{ color: "var(--color-text-3)", fontSize: 13, padding: "12px 0" }}>暂无待办审批</div>}
          {todos.map((a) => (
            <div key={a.id} className="todo-item" onClick={() => navigate("/approvals")}>
              <Avatar name={a.applicantName ?? "?"} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="todo-title">{a.title}</div>
                <div className="todo-meta num">{a.applicantName} · {formatTime(a.createdAt)} · 第 {a.currentStep}/{a.totalSteps} 步</div>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </Card>

        <Card>
          <div className="dash-card-head">
            <CardTitle>最新报价单</CardTitle>
            <Button variant="text" size="sm" onClick={() => navigate("/quotes")}>查看全部 ›</Button>
          </div>
          {quotes.map((q) => (
            <div key={q.id} className="todo-item" onClick={() => navigate(`/quotes/${q.id}`)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="todo-title num">{q.quoteNo} · {q.customerName}</div>
                <div className="todo-meta">{q.projectName ?? "—"} · <span className="num">{formatMoney(q.totalAmount)}</span></div>
              </div>
              <StatusBadge status={q.docStatus} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
