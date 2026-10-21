import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { quoteApi } from "../../api/endpoints";
import { Button, Card, CardTitle } from "../../components/ui/basic";
import { Field, FormRow, Input, Select, Textarea } from "../../components/ui/form";
import { formatMoney } from "../../components/ui/data";
import { toast } from "../../components/ui/overlay";

interface LineItem {
  key: number;
  productName: string;
  spec: string;
  material: string;
  quantity: number;
  unitPrice: number;
  remark: string;
}

const TAX_RATES = [13, 9, 6, 0];
let keySeq = 1;
const emptyLine = (): LineItem => ({ key: keySeq++, productName: "", spec: "", material: "", quantity: 1, unitPrice: 0, remark: "" });

export function QuoteForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [projectName, setProjectName] = useState("");
  const [deliveryRequirement, setDeliveryRequirement] = useState("");
  const [taxRate, setTaxRate] = useState(13);
  const [remark, setRemark] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
    const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), taxAmount, total: +(subtotal + taxAmount).toFixed(2) };
  }, [lines, taxRate]);

  const setLine = (key: number, patch: Partial<LineItem>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const valid = customerName.trim() !== "" && lines.some((l) => l.productName.trim() && l.quantity > 0);

  const save = async () => {
    if (!valid) {
      toast("请填写客户名称，并至少保留一条有效的明细行", "⚠️");
      return;
    }
    setSaving(true);
    try {
      const q = await quoteApi.create({
        customerName: customerName.trim(),
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        projectName: projectName.trim() || undefined,
        deliveryRequirement: deliveryRequirement.trim() || undefined,
        taxRate,
        remark: remark.trim() || undefined,
        items: lines
          .filter((l) => l.productName.trim())
          .map((l) => ({
            productName: l.productName.trim(),
            spec: l.spec.trim() || undefined,
            material: l.material.trim() || undefined,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            remark: l.remark.trim() || undefined,
          })),
      });
      toast(`报价单 ${q.quoteNo} 已创建`);
      navigate(`/quotes/${q.id}`);
    } catch (e: any) {
      toast(e.message ?? "保存失败", "❌");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">新建报价单</div>
          <div className="page-desc">单号由系统自动生成（Q + 年月 + 4 位流水）</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => navigate("/quotes")}>取消</Button>
          <Button variant="primary" loading={saving} onClick={save}>保存草稿</Button>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardTitle>基本信息</CardTitle>
        <FormRow>
          <Field label="客户名称" required><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="如：杭州临安电力设备有限公司" /></Field>
          <Field label="项目名称"><Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="如：临安工业园配电改造" /></Field>
        </FormRow>
        <FormRow>
          <Field label="联系人"><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></Field>
          <Field label="联系电话"><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
        </FormRow>
        <FormRow>
          <Field label="交货要求"><Input value={deliveryRequirement} onChange={(e) => setDeliveryRequirement(e.target.value)} placeholder="如：合同签订后 25 天交货" /></Field>
          <Field label="税率">
            <Select value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}>
              {TAX_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </Select>
          </Field>
        </FormRow>
        <Field label="备注"><Textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="补充说明…" /></Field>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <CardTitle>明细行</CardTitle>
          <Button size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}>＋ 添加行</Button>
        </div>
        {lines.map((l, i) => (
          <div key={l.key} style={{
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-m)",
            padding: 16, marginBottom: 12, background: "rgba(0,0,0,0.015)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)" }}>第 {i + 1} 行</span>
              <Button variant="text" size="sm" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} disabled={lines.length <= 1}>删除</Button>
            </div>
            <FormRow>
              <Field label="产品名称" required><Input value={l.productName} onChange={(e) => setLine(l.key, { productName: e.target.value })} placeholder="如：GCS 低压抽出式开关柜" /></Field>
              <Field label="规格型号"><Input value={l.spec} onChange={(e) => setLine(l.key, { spec: e.target.value })} placeholder="如：GCS 2200×1000×800" /></Field>
            </FormRow>
            <FormRow>
              <Field label="材质"><Input value={l.material} onChange={(e) => setLine(l.key, { material: e.target.value })} placeholder="如：镀锌板 2.0mm" /></Field>
              <Field label="数量"><Input type="number" min={0} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) })} /></Field>
              <Field label="单价（元）"><Input type="number" min={0} value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: Number(e.target.value) })} /></Field>
              <Field label="小计"><Input value={formatMoney(l.quantity * l.unitPrice)} disabled style={{ fontWeight: 600 }} /></Field>
            </FormRow>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <div style={{ minWidth: 260, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "var(--color-text-2)" }}>
              <span>小计（未税）</span><span className="num">{formatMoney(totals.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "var(--color-text-2)" }}>
              <span>税额（{taxRate}%）</span><span className="num">{formatMoney(totals.taxAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontWeight: 700, fontSize: 16, borderTop: "1px solid var(--color-border)", marginTop: 4 }}>
              <span>价税合计</span><span className="num" style={{ color: "var(--color-accent)" }}>{formatMoney(totals.total)}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
