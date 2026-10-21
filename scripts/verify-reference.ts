import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadExcel, parseTemplate, exportQuote, cellValue } from '../backend/src/excel.js';
import { calculateQuote, decimal, FEE_KEYS } from '@jingneng/quote-core';

const source = process.argv[2];
if (!source) throw new Error('请传入原始报价 Excel 路径');
const buffer = await readFile(source),
  hash = createHash('sha256').update(buffer).digest('hex');
const wb = await loadExcel(buffer);
const q = parseTemplate(wb, path.basename(source), 'reference-audit')!;
assert.ok(q, '必须识别为原报价模板');
const calc = calculateQuote(q),
  detail = wb.getWorksheet('电控柜主材明细')!,
  summary = wb.getWorksheet('总清单')!;
let checked = 0;
const compare = (sheet: typeof detail, row: number, col: number, value: string) => {
  const actual = String(cellValue(sheet.getCell(row, col)) ?? '0');
  assert.ok(
    decimal(actual).minus(value).abs().lt('0.000000001'),
    `${sheet.name}!${sheet.getCell(row, col).address}：原表 ${actual} ≠ 软件 ${value}`,
  );
  checked++;
};
for (let i = 0; i < q.cabinets.length; i++) {
  const c = q.cabinets[i],
    v = calc.cabinets[i];
  c.materials.forEach((m, n) => compare(detail, m.source!.row, 7, v.rows[n].amount));
  const sub = c.materials.at(-1)!.source!.row + 1,
    start = sub + 1;
  compare(detail, sub, 7, v.material);
  FEE_KEYS.forEach((key, n) => compare(detail, start + n, 7, v.fees[key]));
  [v.feeSubtotal, v.management, v.taxFee, v.profit, v.total, v.net, v.total].forEach((value, n) =>
    compare(detail, start + 8 + n, 7, value),
  );
  compare(summary, 12 + i, 6, v.total);
  compare(summary, 12 + i, 7, v.orderTotal);
  assert.equal(cellValue(summary.getCell(12 + i, 2)), c.name);
  checked++;
  assert.equal(cellValue(summary.getCell(12 + i, 3)), c.specification);
  checked++;
}
for (let row = 12; row <= 16; row++) {
  compare(summary, row, 1, String(row - 11));
}
compare(summary, 12 + q.cabinets.length, 7, calc.total);
const exported = await exportQuote(q),
  back = parseTemplate(await loadExcel(exported), 'export.xlsx', 'roundtrip')!;
assert.equal(calculateQuote(back).total, calc.total);
assert.equal(calculateQuote(back).hours, calc.hours);
assert.equal(calculateQuote(back).pending, calc.pending);
const target = '.local/workbench';
await mkdir(target, { recursive: true });
await writeFile(path.join(target, 'reference-export.xlsx'), exported);
assert.equal(
  createHash('sha256')
    .update(await readFile(source))
    .digest('hex'),
  hash,
);
const report = {
  sourceSha256: hash,
  sourceUnchanged: true,
  checkedCells: checked,
  cabinets: q.cabinets.map((c, i) => ({
    name: c.name,
    quantity: c.quantity,
    materials: c.materials.length,
    unitTotal: calc.cabinets[i].total,
  })),
  total: calc.total,
  hours: calc.hours,
  labor: calc.labor,
  pending: calc.pending,
  exportRoundTrip: 'passed',
  checkedAt: new Date().toISOString(),
};
await writeFile(path.join(target, 'reference-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
