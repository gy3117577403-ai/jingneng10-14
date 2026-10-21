import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { quoteApi } from "../../api/endpoints";
import type { QuoteDetail as QD } from "../../types";
import { APPROVAL_ACTION_LABEL } from "../../types/api";
import { Button, Card, CardTitle, StatusBadge, Avatar } from "../../components/ui/basic";
import { Table, Timeline, formatMoney, formatTime } from "../../components/ui/data";
import { Textarea } from "../../components/ui/form";
import { Confirm, toast } from "../../components/ui/overlay";

export function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<QD | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState<null | { action: "submit" | "approve" | "reject" | "convert"; note: string; danger?: boolean }>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setDetail(await quoteApi.detail(Number(id)));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doAction = async () => {
    if (!detail || !confirm) return;
    setActing(true);
    try {
      const fn = {
        submit: quoteApi.submit,
        approve: quoteApi.approve,
        reject: quoteApi.reject,
        convert: quoteApi.convertToOrder,
      }[confirm.action];
      await fn(detail.id);
      toast({ submit: "已提交审批", approve: "已通过", reject: "已驳回", convert: "已转订单" }[confirm.action]);
      setConfirm(null);
      load();
    } catch (e: any) {
      toast(e.message ?? "操作失败", "❌");
    } finally {
      setActing(false);
    }
  };

  const sendComment = async () => {
    if (!detail || !comment.trim()) return;
    setSending(true);
    try {
      await quoteApi.addComment(detail.id, comment.trim());
      setComment("");
      toast("评论已发表");
      load();
    } catch (e: any) {
      toast(e.message ?? "发表失败", "❌");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="page"><div style={{ color: "var(--color-text-3)" }}>加载中…</div></div>;
  if (!detail) return <div className="page"><div style={{ color: "var(--color-text-3)" }}>报价单不存在</div></div>;

  const canSubmit = detail.docStatus === "draft";
  const canReview = detail.docStatus === "pending";
  const canConvert = detail.docStatus === "approved";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="page-title num">{detail.quoteNo}</div>
            <StatusBadge status={detail.docStatus} />
            <StatusBadge status={detail.approvalStatus} />
          </div>
          <div className="page-desc">{detail.customerName}{detail.projectName ? ` · ${detail.projectName}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => navigate("/quotes")}>返回列表</Button>
          {canSubmit && <Button variant="primary" onClick={() => setConfirm({ action: "submit", note: "提交后将进入审批流程，草稿不可再编辑。" })}>提交审批</Button>}
          {canReview && (
            <>
              <Button variant="danger" onClick={() => setConfirm({ action: "reject", note: "驳回后单据将退回给业务员修改。", danger: true })}>驳回</Button>
              <Button variant="primary" onClick={() => setConfirm({ action: "approve", note: "通过后单据状态变为「已批准」。", danger: false })}>通过</Button>
            </>
          )}
          {canConvert && <Button variant="primary" onClick={() => setConfirm({ action: "convert", note: "转订单后将推送至 ERP 进入生产流程。" })}>转订单</Button>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
        <div>
          <Card style={{ marginBottom: 16 }}>
            <CardTitle>基本信息</CardTitle>
            <InfoRow label="客户名称" value={detail.customerName} />
            <InfoRow label="联系人" value={`${detail.contactName ?? "—"}${detail.contactPhone ? `（${detail.contactPhone}）` : ""}`} />
            <InfoRow label="业务员" value={detail.salesmanName ?? "—"} />
            <InfoRow label="交货要求" value={detail.deliveryRequirement ?? "—"} />
            <InfoRow label="备注" value={detail.remark ?? "—"} />
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <CardTitle>明细行</CardTitle>
            <Table
              data={detail.items}
              rowKey={(it) => it.id}
              columns={[
                { key: "lineNo", title: "#", width: 40, render: (it) => <span className="num">{it.lineNo}</span> },
                { key: "productName", title: "产品", render: (it) => <div><div style={{ fontWeight: 500 }}>{it.productName}</div><div style={{ fontSize: 12, color: "var(--color-text-3)" }}>{[it.spec, it.material].filter(Boolean).join(" · ")}</div></div> },
                { key: "quantity", title: "数量", align: "right", render: (it) => <span className="num">{it.quantity}</span> },
                { key: "unitPrice", title: "单价", align: "right", render: (it) => <span className="num">{formatMoney(it.unitPrice)}</span> },
                { key: "amount", title: "金额", align: "right", render: (it) => <span className="num" style={{ fontWeight: 600 }}>{formatMoney(it.amount)}</span> },
              ]}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <div style={{ minWidth: 240, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--color-text-2)" }}>
                  <span>小计（未税）</span><span className="num">{formatMoney(detail.subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--color-text-2)" }}>
                  <span>税额（{detail.taxRate}%）</span><span className="num">{formatMoney(detail.taxAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontWeight: 700, fontSize: 16, borderTop: "1px solid var(--color-border)", marginTop: 4 }}>
                  <span>价税合计</span><span className="num" style={{ color: "var(--color-accent)" }}>{formatMoney(detail.totalAmount)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>协同评论</CardTitle>
            {detail.comments.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
                <Avatar name={c.userName ?? "?"} size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}><b>{c.userName}</b> <span style={{ color: "var(--color-text-3)", fontSize: 12 }} className="num">{formatTime(c.createdAt)}</span></div>
                  <div style={{ fontSize: 14, marginTop: 2 }}>{c.content}</div>
                </div>
              </div>
            ))}
            {detail.comments.length === 0 && <div style={{ color: "var(--color-text-3)", fontSize: 13, padding: "8px 0" }}>暂无评论，来发表第一条吧</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="写下你的评论…（可用 @ 提及同事）" style={{ minHeight: 40 }} />
              <Button variant="primary" loading={sending} onClick={sendComment} style={{ flexShrink: 0 }}>发表</Button>
            </div>
          </Card>
        </div>

        <Card>
          <CardTitle>审批时间线</CardTitle>
          {detail.approvalTimeline.length === 0 ? (
            <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>尚未提交审批</div>
          ) : (
            <Timeline
              nodes={detail.approvalTimeline.map((r, i, arr) => ({
                title: `${r.approverName ?? "—"} · ${APPROVAL_ACTION_LABEL[r.action]}`,
                desc: r.comment,
                time: r.createdAt,
                state: i === arr.length - 1 ? "now" : "done",
                icon: r.action === "approve" ? "✓" : r.action === "reject" ? "✕" : "•",
              }))}
            />
          )}
        </Card>
      </div>

      {confirm && (
        <Confirm
          title="请确认"
          content={confirm.note}
          okText={{ submit: "提交审批", approve: "通过", reject: "驳回", convert: "转订单" }[confirm.action]}
          danger={confirm.danger}
          onOk={doAction}
          onCancel={() => !acting && setConfirm(null)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", padding: "7px 0", borderBottom: "1px solid var(--color-border)", fontSize: 14 }}>
      <div style={{ width: 110, flexShrink: 0, color: "var(--color-text-3)" }}>{label}</div>
      <div style={{ flex: 1 }}>{value}</div>
    </div>
  );
}
