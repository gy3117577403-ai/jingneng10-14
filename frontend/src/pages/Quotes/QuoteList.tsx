import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { quoteApi } from "../../api/endpoints";
import type { Quote } from "../../types";
import { Button, StatusBadge } from "../../components/ui/basic";
import { SearchInput, Select } from "../../components/ui/form";
import { Table, Pagination, formatMoney, formatTime } from "../../components/ui/data";
import { QUOTE_DOC_STATUS_LABEL } from "../../types/api";

const STATUS_OPTIONS = Object.entries(QUOTE_DOC_STATUS_LABEL).map(([v, label]) => ({ v, label }));

export function QuoteList() {
  const navigate = useNavigate();
  const [list, setList] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [docStatus, setDocStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await quoteApi.list({
        keyword: keyword || undefined,
        docStatus: docStatus || undefined,
        page,
        pageSize,
      });
      setList(r.list);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }, [keyword, docStatus, page]);

  useEffect(() => { load(); }, [load]);

  // 搜索防抖：输入时重置页码
  const onKeyword = (v: string) => { setKeyword(v); setPage(1); };
  const onStatus = (v: string) => { setDocStatus(v); setPage(1); };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">报价管理</div>
          <div className="page-desc">报价单登记 · 审批流转 · 协同评论 · 转订单</div>
        </div>
        <Button variant="primary" onClick={() => navigate("/quotes/new")}>＋ 新建报价单</Button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <SearchInput value={keyword} onChange={onKeyword} placeholder="搜索单号 / 客户 / 项目…" />
        <Select value={docStatus} onChange={(e) => onStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </Select>
      </div>

      <Table<Quote>
        loading={loading}
        data={list}
        rowKey={(q) => q.id}
        onRowClick={(q) => navigate(`/quotes/${q.id}`)}
        columns={[
          { key: "quoteNo", title: "报价单号", render: (q) => <span className="num" style={{ fontWeight: 600 }}>{q.quoteNo}</span> },
          { key: "customerName", title: "客户", render: (q) => <div><div>{q.customerName}</div><div style={{ fontSize: 12, color: "var(--color-text-3)" }}>{q.projectName ?? "—"}</div></div> },
          { key: "salesmanName", title: "业务员", render: (q) => q.salesmanName ?? "—" },
          { key: "totalAmount", title: "价税合计", align: "right", render: (q) => <span className="num" style={{ fontWeight: 600 }}>{formatMoney(q.totalAmount)}</span> },
          { key: "docStatus", title: "单据状态", render: (q) => <StatusBadge status={q.docStatus} /> },
          { key: "approvalStatus", title: "审批状态", render: (q) => <StatusBadge status={q.approvalStatus} /> },
          { key: "updatedAt", title: "更新时间", render: (q) => <span className="num" style={{ color: "var(--color-text-3)", fontSize: 13 }}>{formatTime(q.updatedAt)}</span> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
    </div>
  );
}
