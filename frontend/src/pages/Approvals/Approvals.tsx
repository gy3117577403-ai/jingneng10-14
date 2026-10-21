import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { approvalApi } from "../../api/endpoints";
import type { Approval } from "../../types";
import { StatusBadge, Avatar } from "../../components/ui/basic";
import { SearchInput } from "../../components/ui/form";
import { Table, Tabs, Pagination, formatTime } from "../../components/ui/data";

export function Approvals() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"todo" | "done" | "mine">("todo");
  const [keyword, setKeyword] = useState("");
  const [list, setList] = useState<Approval[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await approvalApi.list(tab, keyword || undefined, page, pageSize);
      setList(r.list);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }, [tab, keyword, page]);

  useEffect(() => { load(); }, [load]);

  const openApproval = (a: Approval) => {
    if (a.bizType === "quote") navigate(`/quotes/${a.bizId}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">审批中心</div>
          <div className="page-desc">所有业务单据的审批统一在这里流转</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Tabs
          tabs={[
            { key: "todo", label: "待我审批" },
            { key: "done", label: "我已审批" },
            { key: "mine", label: "我发起的" },
          ]}
          active={tab}
          onChange={(k) => { setTab(k); setPage(1); }}
        />
        <SearchInput value={keyword} onChange={(v) => { setKeyword(v); setPage(1); }} placeholder="搜索标题…" />
      </div>

      <Table<Approval>
        loading={loading}
        data={list}
        rowKey={(a) => a.id}
        onRowClick={openApproval}
        columns={[
          { key: "title", title: "审批事项", render: (a) => <div style={{ fontWeight: 500 }}>{a.title}</div> },
          { key: "applicantName", title: "申请人", render: (a) => (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={a.applicantName ?? "?"} size={26} />
              <span>{a.applicantName}</span>
            </div>
          ) },
          { key: "step", title: "进度", render: (a) => <span className="num">{a.currentStep} / {a.totalSteps}</span> },
          { key: "status", title: "状态", render: (a) => <StatusBadge status={a.status} /> },
          { key: "createdAt", title: "发起时间", render: (a) => <span className="num" style={{ color: "var(--color-text-3)", fontSize: 13 }}>{formatTime(a.createdAt)}</span> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
    </div>
  );
}
