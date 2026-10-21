import test from 'node:test';
import assert from 'node:assert/strict';
import { newQuote, newMaterial, uid } from '@jingneng/quote-core';
const enabled = process.env.RUN_DB_TESTS === '1';
test(
  '实际数据库：保存、重读、幂等重试、版本冲突、版本恢复、导出与删除',
  { skip: !enabled },
  async () => {
    const base = 'http://127.0.0.1:5271/api/workbench';
    const health = await (await fetch(base + '/health')).json();
    assert.equal(health.service, 'jingneng-quote-workbench');
    const call = (url: string, method = 'GET', body?: unknown) =>
      fetch(base + url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    let q = newQuote();
    q.customerName = '自动验收临时数据';
    q.cabinets[0].materials = [
      {
        ...newMaterial(),
        name: '验收物料',
        quantity: '3',
        unitPrice: '1.237',
        priceStatus: 'confirmed',
      },
    ];
    const initial = structuredClone(q),
      mutationId = uid();
    let revision = 0;
    try {
      let r = await call('/quotes', 'POST', { quote: q, mutationId });
      assert.equal(r.status, 200);
      q = await r.json();
      revision = q.revision;
      assert.equal(revision, 1);
      assert.ok(q.quoteNo.startsWith('JN'));
      const retried = await (await call('/quotes', 'POST', { quote: initial, mutationId })).json();
      assert.equal(retried.revision, 1);
      const read = await (await call(`/quotes/${q.id}`)).json();
      assert.equal(read.cabinets[0].materials[0].unitPrice, '1.237');
      assert.equal(read.revision, 1);
      q.cabinets[0].fees.assembly.quantity = '7';
      r = await call('/quotes', 'POST', { quote: q, mutationId: uid() });
      assert.equal(r.status, 200);
      q = await r.json();
      revision = q.revision;
      assert.equal(revision, 2);
      r = await call('/quotes', 'POST', { quote: initial, mutationId: uid() });
      assert.equal(r.status, 409);
      const invalid = structuredClone(q);
      invalid.cabinets[0].quantity = 'abc';
      r = await call('/quotes', 'POST', { quote: invalid, mutationId: uid() });
      assert.equal(r.status, 400);
      assert.equal((await (await call(`/quotes/${q.id}`)).json()).revision, 2);
      const versions = await (await call(`/quotes/${q.id}/versions`)).json();
      assert.deepEqual(
        versions.map((v: { revision: number }) => v.revision),
        [2, 1],
      );
      const first = await (await call(`/quotes/${q.id}/versions/1`)).json();
      assert.equal(first.cabinets[0].fees.assembly.quantity, '0');
      r = await call(`/quotes/${q.id}/export?revision=1`);
      assert.equal(r.status, 409);
      r = await call(`/quotes/${q.id}/export?revision=2`);
      assert.equal(r.status, 200);
      assert.ok((await r.arrayBuffer()).byteLength > 5000);
      first.revision = 2;
      r = await call('/quotes', 'POST', { quote: first, mutationId: uid() });
      q = await r.json();
      revision = q.revision;
      assert.equal(revision, 3);
      assert.equal(q.cabinets[0].fees.assembly.quantity, '0');
      r = await call(`/quotes/${q.id}?revision=1`, 'DELETE');
      assert.equal(r.status, 409);
    } finally {
      if (revision) {
        const r = await call(`/quotes/${q.id}?revision=${revision}`, 'DELETE');
        assert.equal(r.status, 200);
        assert.equal((await call(`/quotes/${q.id}`)).status, 404);
      }
    }
  },
);
