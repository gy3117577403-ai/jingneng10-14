import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import {
  CALCULATION_VERSION,
  FEE_KEYS,
  FEE_LABELS,
  LABOR_KEYS,
  calculateCabinet,
  calculateQuote,
  decimal,
  newCabinet,
  newMaterial,
  newQuote,
  PRICE_STATUSES,
  isImportMaterialName,
  type Cabinet,
  type Material,
  type QuoteDocument,
} from '@jingneng/quote-core';

export type Mapping = Record<
  | 'name'
  | 'model'
  | 'brand'
  | 'quantity'
  | 'unit'
  | 'unitPrice'
  | 'remark'
  | 'leadTime'
  | 'cabinet',
  number
>;
export interface ImportConfig {
  sheet: string;
  headerRow: number;
  startRow: number;
  endRow: number;
  mapping: Mapping;
  excludedRows: number[];
  includeHidden: boolean;
  cabinetName: string;
  cabinetQuantity: string;
  quantityBasis: Cabinet['quantityBasis'];
  usePrices: boolean;
}
export interface SheetPreview {
  name: string;
  hidden: boolean;
  signature: string;
  rows: { row: number; hidden: boolean; cells: string[] }[];
  suggestedHeader: number;
  suggestedMapping: Mapping;
}
const clean = (v: string) => v.replace(/[\s\n\r（()）]/g, '').trim();
function displayNumber(value: number, cell: ExcelJS.Cell): string | number {
  return Number.isInteger(value) && value >= 0 && /^0{2,30}$/.test(cell.numFmt)
    ? String(value).padStart(cell.numFmt.length, '0')
    : value;
}
export function cellValue(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return displayNumber(v, cell);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return String(v);
  if ('result' in v) {
    const result = v.result;
    if (typeof result === 'number') return displayNumber(result, cell);
    if (typeof result === 'string') return result;
    return null;
  }
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('text' in v) return v.text;
  return null;
}
const str = (s: ExcelJS.Worksheet, row: number, col: number) =>
  String(cellValue(s.getCell(row, col)) ?? '');
const numeric = (s: ExcelJS.Worksheet, row: number, col: number, fallback = '') => {
  const value = cellValue(s.getCell(row, col));
  return value == null || value === '' ? fallback : String(value).replace(/,/g, '').trim();
};
const numericText = (v: string) =>
  /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.replace(/,/g, '').trim()) ? v.replace(/,/g, '').trim() : '';
export async function loadExcel(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  if (
    wb.worksheets.length > 50 ||
    wb.worksheets.some((s) => s.rowCount > 10000 || s.columnCount > 200)
  )
    throw new Error(
      '工作簿超出本版处理范围（50 个工作表、每表 10000 行、200 列）。请按柜型拆分后导入。',
    );
  return wb;
}
const synonyms: Record<keyof Mapping, RegExp> = {
  name: /^(物料名称|元件名称|名称|品名|产品名称|材料名称|设备名称)$/,
  model: /^(规格型号|型号|规格|订货号|物料编码|产品型号)$/,
  brand: /^(品牌|厂家|制造商|生产厂家)$/,
  quantity: /^(数量|用量|需求数量|需求数|单台数量|单台用量|整单数量)$/,
  unit: /^(单位|计量单位)$/,
  unitPrice: /^(单价.*|采购价.*|成本价.*|价格)$/,
  remark: /^(备注|说明|技术要求|物料备注)$/,
  leadTime: /^(交期|交货期|交货日期|预计交期)$/,
  cabinet: /^(柜型|柜名|柜名称|箱柜名称|所属柜型|所属柜)$/,
};
export function previewSheets(wb: ExcelJS.Workbook): SheetPreview[] {
  return wb.worksheets.map((s) => {
    const rows: SheetPreview['rows'] = [];
    s.eachRow({ includeEmpty: false }, (row, n) =>
      rows.push({
        row: n,
        hidden: row.hidden,
        cells: Array.from({ length: Math.min(s.columnCount, 200) }, (_, i) => str(s, n, i + 1)),
      }),
    );
    const candidates = rows
      .slice(0, 40)
      .map((r) => ({
        ...r,
        score: r.cells.filter((t) => Object.values(synonyms).some((re) => re.test(clean(t))))
          .length,
      }));
    const header = candidates.sort((a, b) => b.score - a.score)[0];
    const mapping = Object.fromEntries(
      Object.entries(synonyms).map(([key, re]) => [
        key,
        header?.cells.findIndex((t) => re.test(clean(t))) ?? -1,
      ]),
    ) as Mapping;
    return {
      name: s.name,
      hidden: s.state !== 'visible',
      signature: createHash('sha256')
        .update(JSON.stringify(header?.cells.map(clean) ?? []))
        .digest('hex'),
      rows,
      suggestedHeader: header?.row ?? 1,
      suggestedMapping: mapping,
    };
  });
}
export function parseTemplate(
  wb: ExcelJS.Workbook,
  filename: string,
  fileId: string,
): QuoteDocument | null {
  const sheet = wb.getWorksheet('电控柜主材明细');
  if (!sheet) return null;
  const subtotalRows: number[] = [];
  sheet.eachRow((row, n) => {
    if (str(sheet, n, 1).trim() === '元器件小计') subtotalRows.push(n);
  });
  if (!subtotalRows.length) return null;
  const quote = newQuote();
  quote.cabinets = [];
  const summary = wb.getWorksheet('总清单');
  quote.projectName = summary ? str(summary, 10, 1) : filename.replace(/\.xlsx$/i, '');
  if (summary && str(summary, 4, 1) === '客户') {
    quote.customerName = str(summary, 4, 2);
    quote.projectName = str(summary, 5, 2);
    quote.contactName = str(summary, 6, 2);
    quote.contactPhone = str(summary, 6, 4);
    quote.deliveryRequirement = str(summary, 7, 2);
    quote.remark = str(summary, 8, 2);
    const date = str(summary, 3, 7);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) quote.quotationDate = date;
  }
  let sectionStart = 1;
  for (const sub of subtotalRows) {
    const start = sub + 1;
    if (str(sheet, start + 5, 2) !== '成套费' || str(sheet, start + 9, 2) !== '管理费') return null;
    const c = newCabinet(str(sheet, sectionStart, 1));
    c.specification = str(sheet, start, 3);
    if (summary)
      summary.eachRow((_row, n) => {
        if (str(summary, n, 2) === c.name) c.quantity = numeric(summary, n, 4, '1');
      });
    for (let r = sectionStart + 2; r < sub; r++) {
      if (!str(sheet, r, 2).trim() && !str(sheet, r, 3).trim()) continue;
      const m = newMaterial();
      m.name = str(sheet, r, 2);
      m.model = str(sheet, r, 3);
      m.quantity = numeric(sheet, r, 4);
      m.unit = str(sheet, r, 5);
      m.unitPrice = numeric(sheet, r, 6) || null;
      m.brand = str(sheet, r, 8);
      m.remark = str(sheet, r, 9);
      m.priceStatus =
        m.unitPrice == null
          ? 'pending'
          : /客户.*供|敏实提供|甲供/.test(m.remark)
            ? 'supplied'
            : 'confirmed';
      const storedStatus = str(sheet, r, 10);
      const status = Object.entries(PRICE_STATUSES).find(([, label]) => label === storedStatus);
      if (status) m.priceStatus = status[0] as Material['priceStatus'];
      m.leadTime = str(sheet, r, 11);
      m.internalNote = str(sheet, r, 12);
      m.priceSource = '原报价 Excel';
      m.source = {
        fileId,
        filename,
        sheet: sheet.name,
        row: r,
        original: {
          名称: m.name,
          型号: m.model,
          数量: m.quantity,
          单价: m.unitPrice ?? '',
          备注: m.remark,
        },
      };
      c.materials.push(m);
    }
    FEE_KEYS.forEach((key, i) => {
      c.fees[key] = {
        quantity: numeric(sheet, start + i, 4, '0'),
        unitPrice: numeric(sheet, start + i, 6, '0'),
        note: str(sheet, start + i, 9),
      };
    });
    c.managementRate = decimal(numeric(sheet, start + 9, 4, '0'))
      .mul(100)
      .toFixed();
    c.taxFeeRate = decimal(numeric(sheet, start + 10, 4, '0'))
      .mul(100)
      .toFixed();
    c.profitRate =
      numeric(sheet, start + 11, 4) === ''
        ? ''
        : decimal(numeric(sheet, start + 11, 4))
            .mul(100)
            .toFixed();
    c.laborNote = str(sheet, start + 5, 9);
    quote.cabinets.push(c);
    sectionStart = start + 15;
  }
  return quote;
}
export function mapImport(
  sheets: SheetPreview[],
  configs: ImportConfig[],
  filename: string,
  fileId: string,
): Cabinet[] {
  const cabinets: Cabinet[] = [];
  for (const cfg of configs) {
    const s = sheets.find((s) => s.name === cfg.sheet);
    if (!s) throw new Error('导入工作表不存在');
    if (
      !Number.isInteger(cfg.mapping.name) ||
      cfg.mapping.name < 0 ||
      !Number.isInteger(cfg.mapping.quantity) ||
      cfg.mapping.quantity < 0
    )
      throw new Error(`${s.name}：请对应物料名称和数量列`);
    const groups = new Map<string, Cabinet>();
    let currentGroup = cfg.cabinetName || s.name;
    for (const row of s.rows) {
      if (
        row.row < cfg.startRow ||
        row.row > cfg.endRow ||
        row.row <= cfg.headerRow ||
        cfg.excludedRows.includes(row.row) ||
        (row.hidden && !cfg.includeHidden)
      )
        continue;
      const get = (key: keyof Mapping) => row.cells[cfg.mapping[key]] ?? '';
      if (cfg.mapping.cabinet >= 0 && get('cabinet').trim()) currentGroup = get('cabinet').trim();
      const name = get('name');
      if (!isImportMaterialName(name)) continue;
      let c = groups.get(currentGroup);
      if (!c) {
        c = newCabinet(currentGroup);
        c.quantity = cfg.cabinetQuantity;
        c.quantityBasis = cfg.quantityBasis;
        groups.set(currentGroup, c);
      }
      const m = newMaterial();
      m.name = name;
      m.model = get('model');
      m.brand = get('brand');
      m.quantity = numericText(get('quantity'));
      m.unit = get('unit') || '只';
      m.remark = get('remark');
      m.leadTime = get('leadTime');
      const price = numericText(get('unitPrice'));
      m.unitPrice = cfg.usePrices && price !== '' ? price : null;
      m.priceStatus = m.unitPrice == null ? 'pending' : 'review';
      m.priceSource = cfg.usePrices ? '客户清单（待确认口径）' : '待填写';
      m.source = {
        fileId,
        filename,
        sheet: s.name,
        row: row.row,
        original: Object.fromEntries(
          Object.keys(synonyms).map((k) => [k, get(k as keyof Mapping)]),
        ),
      };
      if (!m.quantity) m.internalNote = `数量待确认：原值「${get('quantity')}」`;
      c.materials.push(m);
    }
    cabinets.push(...groups.values());
  }
  if (!cabinets.length) throw new Error('所选范围没有可导入的物料，请检查表头、起止行与列对应。');
  if (cabinets.length > 100 || cabinets.some((c) => c.materials.length > 5000))
    throw new Error('柜型或物料数量超出本版处理范围，请拆分导入。');
  return cabinets;
}

export async function exportQuote(q: QuoteDocument): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '浙江京能';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const summary = wb.addWorksheet('总清单');
  const detail = wb.addWorksheet('电控柜主材明细');
  const calculation = calculateQuote(q);
  const provisional = calculation.pending > 0 || calculation.unassigned > 0;
  summary.columns = [9, 50, 58, 12, 10, 20, 22, 32].map((width) => ({ width }));
  detail.columns = [8, 30, 55, 14, 10, 18, 20, 20, 38, 16, 20, 35].map((width) => ({ width }));
  for (const s of [summary, detail]) {
    s.views = [{ state: 'frozen', ySplit: s === summary ? 11 : 2 }];
    s.pageSetup = {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
    s.properties.defaultRowHeight = 22;
  }
  const formula = (
    s: ExcelJS.Worksheet,
    row: number,
    col: number,
    f: string,
    result: string | number,
  ) => {
    s.getCell(row, col).value = {
      formula: f,
      result: typeof result === 'string' && /^-?[\d.]+$/.test(result) ? Number(result) : result,
    };
  };
  summary.mergeCells('A1:H1');
  summary.getCell('A1').value = provisional ? '报价书（草稿 · 有待确认项目）' : '报价书 Quotation';
  summary.getCell('A3').value = '编号';
  summary.getCell('B3').value = q.quoteNo;
  summary.getCell('F3').value = '报价日期';
  summary.getCell('G3').value = q.quotationDate;
  summary.getCell('A4').value = '客户';
  summary.getCell('B4').value = q.customerName;
  summary.getCell('A5').value = '项目';
  summary.getCell('B5').value = q.projectName;
  summary.getCell('A6').value = '联系人';
  summary.getCell('B6').value = q.contactName;
  summary.getCell('C6').value = '联系电话';
  summary.getCell('D6').value = q.contactPhone;
  summary.getCell('A7').value = '交货要求';
  summary.getCell('B7').value = q.deliveryRequirement;
  summary.getCell('A8').value = '备注';
  summary.getCell('B8').value = q.remark;
  summary.mergeCells('A10:H10');
  summary.getCell('A10').value = q.projectName || '成套成本';
  summary.getRow(11).values = [
    '序号',
    '柜名称',
    '规格型号',
    '数量',
    '单位',
    '单价',
    '总计',
    '备注',
  ];
  let row = 1;
  q.cabinets.forEach((c, index) => {
    const v = calculateCabinet(c);
    const title = row;
    detail.mergeCells(row, 1, row, 9);
    detail.getCell(row, 1).value = c.name;
    row++;
    detail.getRow(row).values = [
      '序号',
      '名称',
      '规格型号',
      '数量',
      '单位',
      '单价',
      '总价',
      '品牌',
      '备注',
      '价格状态',
      '交期',
      '内部备注',
    ];
    row++;
    const begin = row;
    c.materials.forEach((m, i) => {
      detail.getRow(row).values = [
        i + 1,
        m.name,
        m.model,
        Number(v.rows[i].perCabinetQuantity),
        m.unit,
        m.unitPrice == null || m.unitPrice === '' ? null : Number(m.unitPrice),
        null,
        m.brand,
        m.remark,
        PRICE_STATUSES[m.priceStatus],
        m.leadTime,
        m.internalNote,
      ];
      formula(detail, row, 7, `D${row}*F${row}`, v.rows[i].amount);
      row++;
    });
    const subtotal = row;
    detail.mergeCells(row, 1, row, 5);
    detail.getCell(row, 1).value = '元器件小计';
    formula(detail, row, 7, row === begin ? '0' : `SUM(G${begin}:G${row - 1})`, v.material);
    row++;
    const costStart = row;
    FEE_KEYS.forEach((key, i) => {
      const fee = c.fees[key];
      detail.getRow(row).values = [
        i + 1,
        FEE_LABELS[key],
        key === 'cabinet'
          ? c.specification
          : key === 'auxiliary'
            ? '包含电线、线槽、导轨、扎带、绕管等'
            : '',
        Number(fee.quantity || 0),
        LABOR_KEYS.includes(key) ? '时' : key === 'cabinet' ? '台' : '套',
        Number(fee.unitPrice || 0),
        null,
        '',
        LABOR_KEYS.includes(key) ? '' : fee.note,
      ];
      formula(detail, row, 7, `D${row}*F${row}`, v.fees[key]);
      row++;
    });
    detail.mergeCells(costStart + 5, 9, costStart + 6, 9);
    detail.getCell(costStart + 5, 9).value = c.laborNote;
    const costSubtotal = row;
    detail.mergeCells(row, 1, row, 5);
    detail.getCell(row, 1).value = '小计';
    formula(detail, row, 7, `SUM(G${costStart}:G${row - 1})`, v.feeSubtotal);
    row++;
    const management = row;
    detail.getCell(row, 2).value = '管理费';
    detail.getCell(row, 4).value = Number(decimal(c.managementRate).div(100));
    detail.getCell(row, 4).numFmt = '0.00%';
    formula(detail, row, 7, `D${row}*(G${costSubtotal}+G${subtotal}-G${costStart})`, v.management);
    row++;
    const tax = row;
    detail.getCell(row, 2).value = '税费';
    detail.getCell(row, 4).value = Number(decimal(c.taxFeeRate).div(100));
    detail.getCell(row, 4).numFmt = '0.00%';
    formula(detail, row, 7, `D${row}*(G${costSubtotal}-G${costStart})`, v.taxFee);
    row++;
    const profit = row;
    detail.getCell(row, 2).value = '利润';
    detail.getCell(row, 4).value =
      c.profitRate === '' ? null : Number(decimal(c.profitRate).div(100));
    detail.getCell(row, 4).numFmt = '0.00%';
    formula(detail, row, 7, `D${row}*(G${costSubtotal}+G${subtotal}-G${costStart})`, v.profit);
    row++;
    const total = row;
    detail.getCell(row, 2).value = '总计';
    formula(
      detail,
      row,
      7,
      `G${subtotal}+G${costSubtotal}+G${management}+G${tax}+G${profit}`,
      v.total,
    );
    row++;
    detail.getCell(row, 2).value = '不含税价';
    formula(detail, row, 7, `G${total}/1.13`, v.net);
    row++;
    detail.getCell(row, 2).value = '最终优惠价';
    formula(detail, row, 7, `G${total}`, v.total);
    const sr = 12 + index;
    summary.getRow(sr).values = [
      index + 1,
      null,
      c.specification,
      Number(c.quantity),
      '台',
      null,
      null,
      v.unassigned ? '数量口径未确认' : v.pending ? `${v.pending} 项待确认` : '',
    ];
    formula(summary, sr, 2, `'电控柜主材明细'!A${title}`, c.name);
    formula(summary, sr, 6, `'电控柜主材明细'!G${row}`, v.total);
    formula(summary, sr, 7, `D${sr}*F${sr}`, v.orderTotal);
    row++;
  });
  const totalRow = 12 + q.cabinets.length;
  summary.getCell(totalRow, 2).value = '总计';
  formula(
    summary,
    totalRow,
    7,
    q.cabinets.length ? `SUM(G12:G${totalRow - 1})` : '0',
    calculation.total,
  );
  summary.getCell(totalRow + 2, 2).value =
    `成套＋检验＋调试：${calculation.hours} 小时，人工费 ${calculation.labor} 元`;
  summary.getCell(totalRow + 3, 2).value =
    `计算规则：${CALCULATION_VERSION}；版本 ${q.revision}。${provisional ? '当前含待确认项目。' : ''}`;
  for (const s of [summary, detail]) {
    s.eachRow((r) => {
      r.eachCell((cell) => {
        cell.font = { name: '微软雅黑', size: 10 };
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (Number(cell.col) === 6 || Number(cell.col) === 7) cell.numFmt = '#,##0.00';
      });
      if (!r.height || r.height < 22) r.height = 22;
    });
    s.pageSetup.printArea = `A1:${s === summary ? 'H' : 'L'}${s.rowCount}`;
  }
  // Give multiline cabinet specifications enough height in both worksheets.
  summary.eachRow((r, n) => {
    if (n >= 12 && n < totalRow)
      r.height = Math.max(42, String(cellValue(r.getCell(3)) ?? '').split('\n').length * 17);
  });
  detail.eachRow((r) => {
    if (cellValue(r.getCell(2)) === '柜体')
      r.height = Math.max(30, String(cellValue(r.getCell(3)) ?? '').split('\n').length * 17);
  });
  const band = (s: ExcelJS.Worksheet, r: number) => {
    s.getRow(r).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0F8' } };
      cell.font = { name: '微软雅黑', size: 10, bold: true, color: { argb: 'FF264367' } };
    });
  };
  band(summary, 11);
  band(summary, totalRow);
  summary.getCell('A1').font = { name: '微软雅黑', size: 18, bold: true };
  detail.eachRow((r, n) => {
    if (
      str(detail, n, 2) === '名称' ||
      ['元器件小计', '小计'].includes(str(detail, n, 1)) ||
      ['总计', '最终优惠价'].includes(str(detail, n, 2))
    )
      band(detail, n);
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
