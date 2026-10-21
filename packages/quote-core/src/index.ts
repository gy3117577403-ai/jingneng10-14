import { Decimal } from 'decimal.js';
import { z } from 'zod';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export const CALCULATION_VERSION = 'jn-original-20261014-v1' as const;
const text = z.string().max(8000, '文字最多 8000 字');
const numeric = z
  .string()
  .max(40)
  .refine(
    (v) =>
      v === '' ||
      (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v) &&
        new Decimal(v).isFinite() &&
        new Decimal(v).abs().lt('1e15')),
    '请输入有效数字',
  );
export const PRICE_STATUSES = {
  pending: '待定价',
  inquiry: '待询价',
  review: '待确认',
  confirmed: '已确认',
  supplied: '客户供料',
  excluded: '不计价',
} as const;
export const FEE_LABELS = {
  cabinet: '柜体',
  auxiliary: '辅材',
  label: '标牌',
  freight: '运费',
  packaging: '包装',
  assembly: '成套费',
  inspection: '检验费',
  commissioning: '调试费',
} as const;
export type FeeKey = keyof typeof FEE_LABELS;
export const FEE_KEYS = Object.keys(FEE_LABELS) as FeeKey[];
export const LABOR_KEYS: FeeKey[] = ['assembly', 'inspection', 'commissioning'];
export function validationMessage(issue: { path: PropertyKey[]; message: string }): string {
  const labels: Record<string, string> = {
    name: '名称',
    model: '型号',
    brand: '品牌',
    quantity: '数量',
    unitPrice: '单价',
    unit: '单位',
    managementRate: '管理费率',
    taxFeeRate: '税费率',
    profitRate: '利润率',
    customerName: '客户名称',
    projectName: '项目名称',
    quotationDate: '报价日期',
    calculationVersion: '计算规则版本',
    remark: '备注',
  };
  const p = issue.path.map(String);
  let field = labels[p.at(-1) ?? ''] ?? '输入内容';
  if (p[0] === 'cabinets') {
    let prefix = `第 ${Number(p[1]) + 1} 个柜型`;
    if (p[2] === 'materials') prefix += `，第 ${Number(p[3]) + 1} 行物料`;
    if (p[2] === 'fees') prefix += `，${FEE_LABELS[p[3] as FeeKey] ?? '费用'}`;
    field = `${prefix} ${field}`;
  }
  return `${field}：${issue.message}`;
}
export function isImportMaterialName(value: string): boolean {
  const name = value.replace(/[\s\n\r（()）]/g, '').trim();
  return (
    !!name &&
    !/^(物料名称|元件名称|名称|品名|产品名称|材料名称|设备名称|合计|小计|总计|元器件小计|材料小计|金额合计|总金额)[:：]?$/.test(
      name,
    )
  );
}
export const sourceSchema = z.object({
  fileId: text.default(''),
  filename: text.default(''),
  sheet: text.default(''),
  row: z.number().int().nonnegative().default(0),
  original: z.record(z.string(), text).default({}),
});
export const materialSchema = z.object({
  id: z.string().uuid(),
  name: text,
  model: text.default(''),
  brand: text.default(''),
  quantity: numeric,
  unit: text.default('只'),
  unitPrice: numeric.nullable(),
  priceStatus: z.enum(['pending', 'inquiry', 'review', 'confirmed', 'supplied', 'excluded']),
  priceSource: text.default('手工录入'),
  priceType: text.default('未知'),
  priceDate: text.default(''),
  leadTime: text.default(''),
  remark: text.default(''),
  internalNote: text.default(''),
  source: sourceSchema.nullable().default(null),
});
const feeSchema = z.object({ quantity: numeric, unitPrice: numeric, note: text.default('') });
export const cabinetSchema = z.object({
  id: z.string().uuid(),
  name: text,
  specification: text.default(''),
  quantity: numeric.refine((v) => v !== '' && decimal(v).gt(0), '柜型数量必须大于零'),
  quantityBasis: z.enum(['perCabinet', 'project', 'unassigned']),
  materials: z.array(materialSchema).max(5000),
  fees: z.object({
    cabinet: feeSchema,
    auxiliary: feeSchema,
    label: feeSchema,
    freight: feeSchema,
    packaging: feeSchema,
    assembly: feeSchema,
    inspection: feeSchema,
    commissioning: feeSchema,
  }),
  managementRate: numeric,
  taxFeeRate: numeric,
  profitRate: numeric,
  laborNote: text.default(''),
});
export const quoteSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  quoteNo: text.default(''),
  customerName: text,
  projectName: text,
  contactName: text.default(''),
  contactPhone: text.default(''),
  quotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryRequirement: text.default(''),
  remark: text.default(''),
  calculationVersion: z.literal(CALCULATION_VERSION),
  cabinets: z.array(cabinetSchema).max(100),
});
export type QuoteDocument = z.infer<typeof quoteSchema>;
export type Cabinet = z.infer<typeof cabinetSchema>;
export type Material = z.infer<typeof materialSchema>;
export type PriceStatus = Material['priceStatus'];
export const uid = () => crypto.randomUUID();
export function newMaterial(): Material {
  return {
    id: uid(),
    name: '',
    model: '',
    brand: '',
    quantity: '1',
    unit: '只',
    unitPrice: null,
    priceStatus: 'pending',
    priceSource: '手工录入',
    priceType: '未知',
    priceDate: '',
    leadTime: '',
    remark: '',
    internalNote: '',
    source: null,
  };
}
export function newCabinet(name = '新柜型'): Cabinet {
  const fees = Object.fromEntries(
    FEE_KEYS.map((key) => [
      key,
      {
        quantity: LABOR_KEYS.includes(key) ? '0' : '1',
        unitPrice: LABOR_KEYS.includes(key) ? '35' : '0',
        note: '',
      },
    ]),
  ) as Cabinet['fees'];
  return {
    id: uid(),
    name,
    specification: '',
    quantity: '1',
    quantityBasis: 'perCabinet',
    materials: [],
    fees,
    managementRate: '4',
    taxFeeRate: '3',
    profitRate: '',
    laborNote: '',
  };
}
export function newQuote(): QuoteDocument {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
  return {
    id: uid(),
    revision: 0,
    quoteNo: '',
    customerName: '',
    projectName: '',
    contactName: '',
    contactPhone: '',
    quotationDate: date,
    deliveryRequirement: '',
    remark: '',
    calculationVersion: CALCULATION_VERSION,
    cabinets: [newCabinet()],
  };
}
export function decimal(value: string | number | null | undefined): Decimal {
  if (value === '' || value == null) return new Decimal(0);
  try {
    const n = new Decimal(value);
    return n.isFinite() ? n : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}
export const money = (value: string | number | null | undefined) => decimal(value).toFixed(2);
export const exact = (value: Decimal) => value.toFixed();
export function calculateCabinet(c: Cabinet) {
  const count = decimal(c.quantity).gt(0) ? decimal(c.quantity) : new Decimal(1);
  const rows = c.materials.map((m) => {
    const quantity =
      c.quantityBasis === 'project' ? decimal(m.quantity).div(count) : decimal(m.quantity);
    return {
      id: m.id,
      perCabinetQuantity: exact(quantity),
      amount: exact(quantity.mul(decimal(m.unitPrice))),
    };
  });
  const material = rows.reduce((n, r) => n.plus(r.amount), new Decimal(0));
  const fees = Object.fromEntries(
    FEE_KEYS.map((key) => [
      key,
      exact(decimal(c.fees[key].quantity).mul(decimal(c.fees[key].unitPrice))),
    ]),
  ) as Record<FeeKey, string>;
  const labor = LABOR_KEYS.reduce((n, key) => n.plus(fees[key]), new Decimal(0));
  const hours = LABOR_KEYS.reduce(
    (n, key) => n.plus(decimal(c.fees[key].quantity)),
    new Decimal(0),
  );
  const other = FEE_KEYS.filter((k) => k !== 'cabinet').reduce(
    (n, key) => n.plus(fees[key]),
    new Decimal(0),
  );
  const management = material.plus(other).mul(decimal(c.managementRate)).div(100);
  const taxFee = other.mul(decimal(c.taxFeeRate)).div(100);
  const profit = material.plus(other).mul(decimal(c.profitRate)).div(100);
  const total = material.plus(fees.cabinet).plus(other).plus(management).plus(taxFee).plus(profit);
  const pending = c.materials.filter(
    (m) =>
      m.unitPrice == null ||
      m.unitPrice === '' ||
      !['confirmed', 'supplied', 'excluded'].includes(m.priceStatus) ||
      !m.name.trim() ||
      m.quantity === '',
  ).length;
  return {
    id: c.id,
    rows,
    fees,
    material: exact(material),
    other: exact(other),
    feeSubtotal: exact(other.plus(fees.cabinet)),
    labor: exact(labor),
    hours: exact(hours),
    management: exact(management),
    taxFee: exact(taxFee),
    profit: exact(profit),
    total: exact(total),
    net: exact(total.div('1.13')),
    orderTotal: exact(total.mul(count)),
    orderLabor: exact(labor.mul(count)),
    orderHours: exact(hours.mul(count)),
    pending,
    unassigned: c.quantityBasis === 'unassigned',
  };
}
export function calculateQuote(q: QuoteDocument) {
  const cabinets = q.cabinets.map(calculateCabinet);
  const sum = (key: 'orderTotal' | 'orderLabor' | 'orderHours') =>
    exact(cabinets.reduce((n, c) => n.plus(c[key]), new Decimal(0)));
  return {
    cabinets,
    total: sum('orderTotal'),
    labor: sum('orderLabor'),
    hours: sum('orderHours'),
    pending: cabinets.reduce((n, c) => n + c.pending, 0),
    unassigned: cabinets.filter((c) => c.unassigned).length,
    cabinetCount: exact(q.cabinets.reduce((n, c) => n.plus(decimal(c.quantity)), new Decimal(0))),
  };
}
export function copyCabinet(c: Cabinet): Cabinet {
  return {
    ...structuredClone(c),
    id: uid(),
    name: `${c.name}（副本）`,
    materials: c.materials.map((m) => ({ ...structuredClone(m), id: uid() })),
  };
}
