import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCabinet,
  calculateQuote,
  newCabinet,
  newMaterial,
  newQuote,
  quoteSchema,
} from '../src/index.js';

test('原表基准：三个柜型、整单工时及报价完整精度一致', () => {
  const q = newQuote();
  q.cabinets = [];
  const fixtures = [
    {
      material: '18414.29',
      qty: '1',
      cabinet: '2400',
      aux: '2300',
      assembly: '44',
      inspection: '5',
      total: '25921.8116',
    },
    {
      material: '0',
      qty: '2',
      cabinet: '260',
      aux: '50',
      assembly: '3',
      inspection: '1',
      total: '538.2',
    },
    {
      material: '2153.33',
      qty: '2',
      cabinet: '550',
      aux: '200',
      assembly: '6',
      inspection: '1',
      total: '3340.5132',
    },
  ];
  for (const f of fixtures) {
    const c = newCabinet();
    c.quantity = f.qty;
    c.materials = [
      { ...newMaterial(), name: '材料汇总基准', unitPrice: f.material, priceStatus: 'confirmed' },
    ];
    c.fees.cabinet.unitPrice = f.cabinet;
    c.fees.auxiliary.unitPrice = f.aux;
    c.fees.freight.unitPrice = '50';
    c.fees.packaging.unitPrice = '20';
    c.fees.assembly.quantity = f.assembly;
    c.fees.inspection.quantity = f.inspection;
    assert.equal(calculateCabinet(c).total, f.total);
    q.cabinets.push(c);
  }
  const v = calculateQuote(q);
  assert.equal(v.total, '33679.238');
  assert.equal(v.hours, '71');
  assert.equal(v.labor, '2485');
  assert.equal(v.cabinetCount, '5');
});
test('柜体不进入管理费、税费和利润基数；税费不含材料', () => {
  const c = newCabinet();
  c.materials = [{ ...newMaterial(), name: '测试', unitPrice: '100' }];
  c.fees.cabinet.unitPrice = '1000';
  c.fees.auxiliary.unitPrice = '50';
  c.profitRate = '10';
  const v = calculateCabinet(c);
  assert.equal(v.management, '6');
  assert.equal(v.taxFee, '1.5');
  assert.equal(v.profit, '15');
  assert.equal(v.total, '1172.5');
  c.fees.cabinet.unitPrice = '2000';
  const next = calculateCabinet(c);
  assert.equal(next.management, v.management);
  assert.equal(next.taxFee, v.taxFee);
  assert.equal(next.profit, v.profit);
  assert.equal(next.total, '2172.5');
});
test('整单材料用量只折算一次；单台工时仍按柜数汇总', () => {
  const c = newCabinet();
  c.quantity = '2';
  c.quantityBasis = 'project';
  c.materials = [{ ...newMaterial(), name: '零件', quantity: '10', unitPrice: '0.015' }];
  c.managementRate = '0';
  c.taxFeeRate = '0';
  c.fees.assembly.quantity = '2';
  const v = calculateCabinet(c);
  assert.equal(v.rows[0].perCabinetQuantity, '5');
  assert.equal(v.material, '0.075');
  assert.equal(v.orderTotal, '140.15');
  assert.equal(v.orderHours, '4');
});
test('不在明细行和柜型单价处提前四舍五入', () => {
  const c = newCabinet();
  c.quantity = '3';
  c.managementRate = '0';
  c.taxFeeRate = '0';
  c.materials = Array.from({ length: 3 }, () => ({
    ...newMaterial(),
    name: '精度',
    quantity: '1',
    unitPrice: '0.004',
  }));
  assert.equal(calculateCabinet(c).orderTotal, '0.036');
});
test('缺价与已确认零元不同，工时备注不参与计算', () => {
  const c = newCabinet();
  c.laborNote = '8+30+11=49';
  c.materials = [
    { ...newMaterial(), name: '缺价' },
    { ...newMaterial(), name: '供料', priceStatus: 'supplied', unitPrice: '0' },
  ];
  assert.equal(calculateCabinet(c).pending, 1);
  assert.equal(calculateCabinet(c).hours, '0');
  c.materials.splice(0, 1);
  assert.equal(calculateCabinet(c).pending, 0);
});
test('保存时拒绝非法数字和零柜数，允许草稿空白价格和空白利润', () => {
  const q = newQuote();
  assert.equal(quoteSchema.safeParse(q).success, true);
  q.cabinets[0].quantity = '0';
  assert.equal(quoteSchema.safeParse(q).success, false);
  q.cabinets[0].quantity = 'abc';
  assert.equal(quoteSchema.safeParse(q).success, false);
  q.cabinets[0].quantity = '1';
  q.cabinets[0].fees.assembly.quantity = 'NaN';
  assert.equal(quoteSchema.safeParse(q).success, false);
});
