import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { calculateQuote, newQuote, newCabinet, newMaterial, uid } from '@jingneng/quote-core';
import {
  loadExcel,
  previewSheets,
  mapImport,
  exportQuote,
  parseTemplate,
  type ImportConfig,
} from '../src/excel.js';

test('客户清单列识别、隐藏行排除、型号与备注保留；客户价格默认不采用', async () => {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet('客户清单');
  s.addRow(['设备采购清单']);
  s.addRow(['品牌', '规格型号', '物料名称', '数量', '单位', '单价', '备注', '交期']);
  s.addRow(['西门子', '00123-A', '接触器', 2, '只', 15.555, '找采购确认', '2 周']);
  s.addRow(['', '0004', '隐藏件', 1, '只', 20]);
  s.getRow(4).hidden = true;
  s.addRow(['', '', '合计', 3]);
  s.getCell('B4').value = 4;
  s.getCell('B4').numFmt = '0000';
  const parsed = await loadExcel(Buffer.from(await wb.xlsx.writeBuffer()));
  const sheets = previewSheets(parsed);
  assert.equal(sheets[0].suggestedHeader, 2);
  assert.equal(sheets[0].rows.find((r) => r.row === 4)?.cells[1], '0004');
  const cfg: ImportConfig = {
    sheet: s.name,
    headerRow: 2,
    startRow: 3,
    endRow: 5,
    mapping: sheets[0].suggestedMapping,
    excludedRows: [],
    includeHidden: false,
    cabinetName: '主柜',
    cabinetQuantity: '2',
    quantityBasis: 'project',
    usePrices: false,
  };
  const cs = mapImport(sheets, [cfg], 'customer.xlsx', uid());
  assert.equal(cs.length, 1);
  assert.equal(cs[0].materials.length, 1);
  const m = cs[0].materials[0];
  assert.equal(m.model, '00123-A');
  assert.equal(m.remark, '找采购确认');
  assert.equal(m.leadTime, '2 周');
  assert.equal(m.unitPrice, null);
  assert.equal(m.source?.row, 3);
  assert.equal(m.source?.original.unitPrice, '15.555');
  cfg.usePrices = true;
  const withPrice = mapImport(sheets, [cfg], 'customer.xlsx', uid())[0].materials[0];
  assert.equal(withPrice.unitPrice, '15.555');
  assert.equal(withPrice.priceStatus, 'review');
});
test('多个工作表 / 柜型列分组，重复标题跳过，人工排除行有效', () => {
  const wb = new ExcelJS.Workbook();
  for (const name of ['A', 'B']) {
    const s = wb.addWorksheet(name);
    s.addRow(['柜型', '名称', '数量', '单价']);
    s.addRow(['主柜', '开关', 1, 3]);
    s.addRow(['', '按钮', 2, 4]);
    s.addRow(['分柜', '指示灯', 3, 5]);
    s.addRow(['柜型', '名称', '数量', '单价']);
  }
  const sheets = previewSheets(wb);
  const configs = sheets.map((s) => ({
    sheet: s.name,
    headerRow: 1,
    startRow: 2,
    endRow: 5,
    mapping: s.suggestedMapping,
    excludedRows: [3],
    includeHidden: false,
    cabinetName: s.name,
    cabinetQuantity: '1',
    quantityBasis: 'perCabinet' as const,
    usePrices: true,
  }));
  const cs = mapImport(sheets, configs, 'multi.xlsx', uid());
  assert.deepEqual(
    cs.map((c) => c.name),
    ['主柜', '分柜', '主柜', '分柜'],
  );
  assert.equal(
    cs.reduce((n, c) => n + c.materials.length, 0),
    4,
  );
});
test('导出包含全部柜型和动态公式；空柜型不生成无效 SUM 区间', async () => {
  const q = newQuote();
  q.customerName = '导出测试';
  q.projectName = '项目';
  q.cabinets[0].materials = [
    {
      ...newMaterial(),
      name: '=1+1',
      model: '00123',
      unitPrice: '0.004',
      priceStatus: 'confirmed',
    },
    { ...newMaterial(), name: '客户供料', quantity: '2', unitPrice: '0', priceStatus: 'supplied' },
  ];
  q.cabinets[0].quantity = '2';
  q.cabinets.push(newCabinet('空柜型'));
  q.cabinets[1].fees.cabinet.unitPrice = '100';
  const wb = await loadExcel(await exportQuote(q));
  assert.equal(wb.getWorksheet('电控柜主材明细')!.getCell('B3').value, '=1+1');
  const detail = wb.getWorksheet('电控柜主材明细')!;
  assert.equal(detail.pageSetup.printArea, `A1:L${detail.rowCount}`);
  assert.ok(detail.rowCount > 30);
  assert.equal(wb.getWorksheet('总清单')!.getCell('G14').result, Number(calculateQuote(q).total));
  const back = parseTemplate(wb, 'export.xlsx', uid())!;
  assert.equal(calculateQuote(back).total, calculateQuote(q).total);
  assert.equal(back.customerName, q.customerName);
  assert.equal(back.cabinets[0].materials[0].model, '00123');
  assert.equal(back.cabinets[0].materials[1].priceStatus, 'supplied');
  detail.eachRow((r) =>
    r.eachCell((c) => {
      if (c.type === ExcelJS.ValueType.Formula) assert.ok(!String(c.formula).includes('#REF!'));
    }),
  );
});
test('整单用量导出折算为单台，回导不重复乘柜数，缺价保留空白', async () => {
  const q = newQuote();
  const c = q.cabinets[0];
  c.quantity = '2';
  c.quantityBasis = 'project';
  c.materials = [
    {
      ...newMaterial(),
      name: '总用量',
      quantity: '10',
      unitPrice: '3.125',
      priceStatus: 'confirmed',
    },
    { ...newMaterial(), name: '缺价', quantity: '2' },
  ];
  const wb = await loadExcel(await exportQuote(q));
  const back = parseTemplate(wb, 'roundtrip.xlsx', uid())!;
  assert.equal(back.cabinets[0].materials[0].quantity, '5');
  assert.equal(back.cabinets[0].quantity, '2');
  assert.equal(back.cabinets[0].materials[1].unitPrice, null);
  assert.equal(calculateQuote(back).total, calculateQuote(q).total);
  assert.equal(calculateQuote(back).pending, 1);
});
