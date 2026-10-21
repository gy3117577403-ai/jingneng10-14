import { useState } from 'react';
import {
  newMaterial,
  PRICE_STATUSES,
  money,
  uid,
  calculateCabinet,
  type Cabinet,
  type Material,
  type PriceStatus,
} from '@jingneng/quote-core';
import { WorkbenchModal } from './Modal';

export function MaterialsTable({
  cabinet,
  onChange,
}: {
  cabinet: Cabinet;
  onChange: (recipe: (c: Cabinet) => void) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [detailId, setDetailId] = useState<string | null>(null),
    [paste, setPaste] = useState<string | null>(null),
    [batchStatus, setBatchStatus] = useState<PriceStatus>('confirmed'),
    [batchPrice, setBatchPrice] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false),
    [page, setPage] = useState(0);
  const calc = calculateCabinet(cabinet),
    detail = cabinet.materials.find((m) => m.id === detailId);
  const filtered = cabinet.materials.filter(
    (m) =>
      [m.name, m.model, m.brand, m.remark].some((s) =>
        s.toLowerCase().includes(search.toLowerCase()),
      ) &&
      (filter === 'all' ||
        (filter === 'pending'
          ? m.unitPrice == null || !['confirmed', 'supplied', 'excluded'].includes(m.priceStatus)
          : m.priceStatus === filter)),
  );
  const maxPage = Math.max(0, Math.ceil(filtered.length / 100) - 1),
    currentPage = Math.min(page, maxPage),
    visible = filtered.slice(currentPage * 100, currentPage * 100 + 100);
  const edit = (id: string, key: keyof Material, value: string | null) =>
    onChange((c) => {
      const m = c.materials.find((m) => m.id === id)!;
      Object.assign(m, { [key]: value });
      if (key === 'unitPrice') {
        m.priceStatus = value == null || value === '' ? 'pending' : 'review';
        m.priceSource = '手工录入';
      }
    });
  const add = () => {
    onChange((c) => c.materials.push(newMaterial()));
    setPage(Math.floor(cabinet.materials.length / 100));
    setSearch('');
    setFilter('all');
  };
  const pasteRows = (paste ?? '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t'));
  return (
    <section className="wb-panel wb-materials">
      <div className="wb-panel-heading">
        <h2>
          物料明细 <span className="wb-muted">{cabinet.materials.length} 行</span>
        </h2>
        <div className="wb-actions">
          <button className="wb-button" onClick={() => setPaste('')}>
            批量粘贴
          </button>
          <button className="wb-button" onClick={add}>
            ＋ 添加物料
          </button>
        </div>
      </div>
      <div className="wb-table-toolbar">
        <input
          aria-label="搜索物料"
          placeholder="搜索名称、型号、品牌、备注"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="筛选物料状态"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">全部状态</option>
          <option value="pending">所有待处理项</option>
          {Object.entries(PRICE_STATUSES)
            .filter(([key]) => key !== 'pending')
            .map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
        </select>
        <span className="wb-muted">
          数量：
          {cabinet.quantityBasis === 'project'
            ? '此柜型整单用量'
            : cabinet.quantityBasis === 'unassigned'
              ? '口径待确认'
              : '每台柜用量'}{' '}
          · 金额按单台柜显示
        </span>
      </div>
      {selected.length > 0 && (
        <div className="wb-batch">
          <strong>已选 {selected.length} 行</strong>
          <select
            aria-label="批量价格状态"
            value={batchStatus}
            onChange={(e) => setBatchStatus(e.target.value as PriceStatus)}
          >
            {Object.entries(PRICE_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            className="wb-button small"
            onClick={() =>
              onChange((c) =>
                c.materials.forEach((m) => {
                  if (selected.includes(m.id)) {
                    m.priceStatus = batchStatus;
                    if (['supplied', 'excluded'].includes(batchStatus)) m.unitPrice = '0';
                  }
                }),
              )
            }
          >
            应用状态
          </button>
          <input
            aria-label="批量单价"
            inputMode="decimal"
            placeholder="统一单价"
            value={batchPrice}
            onChange={(e) => setBatchPrice(e.target.value)}
          />
          <button
            className="wb-button small"
            disabled={!/^-?\d+(\.\d+)?$/.test(batchPrice)}
            onClick={() =>
              onChange((c) =>
                c.materials.forEach((m) => {
                  if (selected.includes(m.id)) {
                    m.unitPrice = batchPrice;
                    m.priceStatus = 'review';
                    m.priceSource = '批量录入';
                  }
                }),
              )
            }
          >
            应用单价
          </button>
          <button
            className="wb-button small"
            onClick={() => {
              onChange((c) =>
                c.materials.push(
                  ...c.materials
                    .filter((m) => selected.includes(m.id))
                    .map((m) => ({ ...structuredClone(m), id: uid() })),
                ),
              );
              setSelected([]);
            }}
          >
            复制行
          </button>
          <button className="wb-button danger small" onClick={() => setConfirmDelete(true)}>
            删除所选
          </button>
          <button className="wb-button quiet small" onClick={() => setSelected([])}>
            取消选择
          </button>
        </div>
      )}
      <div className="wb-table-scroll wb-grid-scroll">
        <table className="wb-grid">
          <thead>
            <tr>
              <th className="check">
                <input
                  aria-label="选择当前页全部物料"
                  type="checkbox"
                  checked={!!visible.length && visible.every((m) => selected.includes(m.id))}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? Array.from(new Set([...selected, ...visible.map((m) => m.id)]))
                        : selected.filter((id) => !visible.some((m) => m.id === id)),
                    )
                  }
                />
              </th>
              <th className="seq">序号</th>
              <th className="name">物料名称</th>
              <th className="model">规格型号</th>
              <th className="brand-col">品牌</th>
              <th className="qty">数量</th>
              <th className="unit">单位</th>
              <th className="price">单价（元）</th>
              <th className="amount">单台金额</th>
              <th className="status-col">价格状态</th>
              <th className="lead">交期</th>
              <th className="remark">备注</th>
              <th>来源 / 更多</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => {
              const index = cabinet.materials.findIndex((row) => row.id === m.id);
              return (
                <tr key={m.id} className={selected.includes(m.id) ? 'selected' : ''}>
                  <td className="check">
                    <input
                      type="checkbox"
                      aria-label={`选择第 ${index + 1} 行`}
                      checked={selected.includes(m.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, m.id]
                            : selected.filter((id) => id !== m.id),
                        )
                      }
                    />
                  </td>
                  <td className="seq">{index + 1}</td>
                  {(['name', 'model', 'brand', 'quantity', 'unit', 'unitPrice'] as const).map(
                    (key) => (
                      <td
                        key={key}
                        className={key === 'name' ? 'name' : key === 'model' ? 'model' : ''}
                      >
                        <input
                          aria-label={`第 ${index + 1} 行 ${{ name: '名称', model: '型号', brand: '品牌', quantity: '数量', unit: '单位', unitPrice: '单价' }[key]}`}
                          className={['quantity', 'unitPrice'].includes(key) ? 'number' : ''}
                          inputMode={
                            ['quantity', 'unitPrice'].includes(key) ? 'decimal' : undefined
                          }
                          value={m[key] ?? ''}
                          placeholder={
                            key === 'unitPrice' ? '待定价' : key === 'name' ? '填写物料名称' : ''
                          }
                          title={String(m[key] ?? '')}
                          onChange={(e) =>
                            edit(
                              m.id,
                              key,
                              key === 'unitPrice' && e.target.value === '' ? null : e.target.value,
                            )
                          }
                        />
                      </td>
                    ),
                  )}
                  <td className="wb-money" title={calc.rows[index].amount}>
                    {money(calc.rows[index].amount)}
                  </td>
                  <td>
                    <select
                      className={`wb-cell-status ${m.priceStatus}`}
                      aria-label={`第 ${index + 1} 行 价格状态`}
                      value={m.priceStatus}
                      onChange={(e) => {
                        const status = e.target.value as PriceStatus;
                        onChange((c) => {
                          const item = c.materials.find((row) => row.id === m.id)!;
                          item.priceStatus = status;
                          if (['supplied', 'excluded'].includes(status)) item.unitPrice = '0';
                        });
                      }}
                    >
                      {Object.entries(PRICE_STATUSES).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`第 ${index + 1} 行 交期`}
                      value={m.leadTime}
                      onChange={(e) => edit(m.id, 'leadTime', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`第 ${index + 1} 行 备注`}
                      value={m.remark}
                      title={m.remark}
                      onChange={(e) => edit(m.id, 'remark', e.target.value)}
                    />
                  </td>
                  <td>
                    <button className="wb-row-more" onClick={() => setDetailId(m.id)}>
                      {m.source ? `原表第 ${m.source.row} 行` : '手工录入'} ↗
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="wb-empty compact">
            <p>
              {cabinet.materials.length
                ? '没有匹配的物料'
                : '还没有物料，导入客户清单或添加物料开始报价。'}
            </p>
            <button className="wb-button" onClick={add}>
              ＋ 添加物料
            </button>
          </div>
        )}
      </div>
      <div className="wb-table-footer">
        <span>
          可直接编辑单元格，按 Tab 切换。客户供料 / 不计价设为 0 元，原始单价仍保留在来源中。
        </span>
        <strong>
          单台材料小计 <span title={calc.material}>¥ {money(calc.material)}</span>
        </strong>
      </div>
      {filtered.length > 100 && (
        <div className="wb-pagination">
          <span>
            每页 100 行 · 第 {currentPage + 1} / {maxPage + 1} 页
          </span>
          <button
            className="wb-button small"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            上一页
          </button>
          <button
            className="wb-button small"
            disabled={currentPage >= maxPage}
            onClick={() => setPage(currentPage + 1)}
          >
            下一页
          </button>
        </div>
      )}
      {detail && (
        <WorkbenchModal
          title={`${detail.name || '物料'} · 来源与备注`}
          onClose={() => setDetailId(null)}
        >
          <div className="wb-form-grid">
            <label>
              价格来源
              <input
                value={detail.priceSource}
                onChange={(e) => edit(detail.id, 'priceSource', e.target.value)}
              />
            </label>
            <label>
              价格口径
              <select
                value={detail.priceType}
                onChange={(e) => edit(detail.id, 'priceType', e.target.value)}
              >
                {['未知', '含税采购价', '未税采购价', '客户参考价'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              价格日期
              <input
                type="date"
                value={detail.priceDate}
                onChange={(e) => edit(detail.id, 'priceDate', e.target.value)}
              />
            </label>
            <label>
              内部备注
              <textarea
                value={detail.internalNote}
                onChange={(e) => edit(detail.id, 'internalNote', e.target.value)}
              />
            </label>
          </div>
          <p className="wb-muted">
            价格口径用于记录。系统使用当前单价直接计算，不自动进行税价换算。
          </p>
          {detail.source ? (
            <div className="wb-source">
              <strong>{detail.source.filename}</strong>
              <p>
                {detail.source.sheet} · 第 {detail.source.row} 行
              </p>
              <dl>
                {Object.entries(detail.source.original).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value || '（空白）'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="wb-muted">此物料为手工添加。</p>
          )}
        </WorkbenchModal>
      )}
      {paste != null && (
        <WorkbenchModal title="从 Excel 批量粘贴物料" onClose={() => setPaste(null)} wide>
          <p>按下面顺序复制数据行，可一次粘贴多行（不含表头）：</p>
          <p>
            <strong>名称 → 型号 → 品牌 → 数量 → 单位 → 单价 → 备注 → 交期</strong>
          </p>
          <textarea
            className="wb-paste"
            aria-label="粘贴物料数据"
            placeholder="将 Excel 单元格复制后粘贴到这里"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <p className="wb-muted">
            将新增 {pasteRows.length} 行；有单价的行标为待确认，空白单价保留待定价。
          </p>
          <div className="wb-modal-actions">
            <button className="wb-button" onClick={() => setPaste(null)}>
              取消
            </button>
            <button
              className="wb-button primary"
              disabled={!pasteRows.length || pasteRows.length > 5000}
              onClick={() => {
                onChange((c) => {
                  for (const cells of pasteRows) {
                    const m = newMaterial();
                    [m.name, m.model, m.brand, m.quantity, m.unit] = [
                      cells[0] ?? '',
                      cells[1] ?? '',
                      cells[2] ?? '',
                      cells[3]?.replaceAll(',', '') ?? '',
                      cells[4] || '只',
                    ];
                    m.unitPrice = cells[5]?.replaceAll(',', '') || null;
                    m.priceStatus = m.unitPrice == null ? 'pending' : 'review';
                    m.remark = cells[6] ?? '';
                    m.leadTime = cells[7] ?? '';
                    c.materials.push(m);
                  }
                });
                setPaste(null);
              }}
            >
              加入物料明细
            </button>
          </div>
        </WorkbenchModal>
      )}
      {confirmDelete && (
        <WorkbenchModal
          title={`删除所选 ${selected.length} 行物料？`}
          onClose={() => setConfirmDelete(false)}
        >
          <p>删除后费用会立即重算；可以通过工具栏“撤销”恢复。</p>
          <div className="wb-modal-actions">
            <button className="wb-button" onClick={() => setConfirmDelete(false)}>
              取消
            </button>
            <button
              className="wb-button danger"
              onClick={() => {
                onChange((c) => {
                  c.materials = c.materials.filter((m) => !selected.includes(m.id));
                });
                setSelected([]);
                setConfirmDelete(false);
              }}
            >
              确认删除物料
            </button>
          </div>
        </WorkbenchModal>
      )}
    </section>
  );
}
