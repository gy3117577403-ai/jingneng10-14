import { useState } from 'react';
import {
  money,
  isImportMaterialName,
  type Cabinet,
  type QuoteDocument,
} from '@jingneng/quote-core';
import {
  workbenchApi,
  type ImportPreview,
  type ImportConfig,
  type Mapping,
  type SheetPreview,
} from './api';
import { WorkbenchModal } from './Modal';
const labels: Record<keyof Mapping, string> = {
  name: '物料名称 *',
  model: '规格型号',
  brand: '品牌',
  quantity: '数量 *',
  unit: '单位',
  unitPrice: '单价',
  remark: '备注',
  leadTime: '交期',
  cabinet: '所属柜型',
};
const columnName = (i: number) =>
  i < 26
    ? String.fromCharCode(65 + i)
    : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
function initialConfig(s: SheetPreview): ImportConfig {
  return {
    sheet: s.name,
    headerRow: s.suggestedHeader,
    startRow: s.suggestedHeader + 1,
    endRow: s.rows.at(-1)?.row ?? 1,
    mapping: s.savedMapping ?? s.suggestedMapping,
    excludedRows: [],
    includeHidden: false,
    cabinetName: s.name,
    cabinetQuantity: '1',
    quantityBasis: 'unassigned',
    usePrices: false,
  };
}
export function ImportDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (cabinets: Cabinet[], mode: 'append' | 'replace', quote?: QuoteDocument) => void;
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null),
    [configs, setConfigs] = useState<ImportConfig[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [active, setActive] = useState(''),
    [mode, setMode] = useState<'template' | 'custom'>('custom'),
    [target, setTarget] = useState<'append' | 'replace'>('append'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [page, setPage] = useState(0);
  const s = preview?.sheets.find((s) => s.name === active),
    cfg = configs.find((c) => c.sheet === active);
  const update = (patch: Partial<ImportConfig>) =>
    setConfigs((items) => items.map((c) => (c.sheet === active ? { ...c, ...patch } : c)));
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const p = await workbenchApi.upload(file);
      setPreview(p);
      setConfigs(p.sheets.map(initialConfig));
      setActive(p.sheets[0]?.name ?? '');
      setSelected(p.sheets[0] ? [p.sheets[0].name] : []);
      setMode(p.template ? 'template' : 'custom');
      setPage(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const r = await workbenchApi.apply(
        preview.fileId,
        mode,
        configs.filter((c) => selected.includes(c.sheet)),
      );
      onImport(r.cabinets, target, r.quote);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <WorkbenchModal
      title="导入 Excel 清单"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <div className="wb-upload">
        <div>
          <strong>{preview ? preview.filename : '选择客户清单或原报价文件'}</strong>
          <p>支持 .xlsx，最多 12 MB。先预览、对应列，再确认导入。</p>
        </div>
        <label className="wb-button">
          {busy ? '正在读取…' : preview ? '更换文件' : '选择 Excel'}
          <input
            aria-label="选择 Excel 文件"
            type="file"
            accept=".xlsx"
            disabled={busy}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
      </div>
      {error && (
        <div role="alert" className="wb-error">
          {error}
        </div>
      )}
      {preview && (
        <>
          {preview.template && (
            <div className="wb-import-template">
              <div>
                <strong>已识别原报价模板</strong>
                <p>
                  {preview.template.cabinetNames.join(' / ')} · {preview.template.materialCount}{' '}
                  行物料 · {preview.template.calculation.hours} 小时 · ¥{' '}
                  {money(preview.template.calculation.total)}
                </p>
                <p>按模板恢复费用、费率和工时，{preview.template.calculation.pending} 项待确认。</p>
              </div>
              <select
                aria-label="导入识别方式"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="template">恢复原报价模板</option>
                <option value="custom">按普通清单对应列</option>
              </select>
            </div>
          )}
          {mode === 'custom' && (
            <>
              <div className="wb-sheet-tabs">
                {preview.sheets.map((sheet) => (
                  <div className={active === sheet.name ? 'active' : ''} key={sheet.name}>
                    <input
                      type="checkbox"
                      aria-label={`导入工作表 ${sheet.name}`}
                      checked={selected.includes(sheet.name)}
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked ? [...v, sheet.name] : v.filter((n) => n !== sheet.name),
                        )
                      }
                    />
                    <button
                      onClick={() => {
                        setActive(sheet.name);
                        setPage(0);
                      }}
                    >
                      {sheet.name}
                      {sheet.hidden ? '（隐藏）' : ''}
                    </button>
                  </div>
                ))}
              </div>
              {cfg && s && (
                <>
                  <div className="wb-import-controls">
                    <label>
                      表头行
                      <input
                        type="number"
                        min="1"
                        value={cfg.headerRow}
                        onChange={(e) => update({ headerRow: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      数据起始行
                      <input
                        type="number"
                        min="1"
                        value={cfg.startRow}
                        onChange={(e) => update({ startRow: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      数据结束行
                      <input
                        type="number"
                        min="1"
                        value={cfg.endRow}
                        onChange={(e) => update({ endRow: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      默认柜型名称
                      <input
                        value={cfg.cabinetName}
                        onChange={(e) => update({ cabinetName: e.target.value })}
                      />
                    </label>
                    <label>
                      柜型数量
                      <input
                        inputMode="decimal"
                        value={cfg.cabinetQuantity}
                        onChange={(e) => update({ cabinetQuantity: e.target.value })}
                      />
                    </label>
                    <label>
                      清单数量口径
                      <select
                        value={cfg.quantityBasis}
                        onChange={(e) =>
                          update({ quantityBasis: e.target.value as Cabinet['quantityBasis'] })
                        }
                      >
                        <option value="unassigned">暂未确认（草稿）</option>
                        <option value="perCabinet">每台柜的用量</option>
                        <option value="project">此柜型整单用量</option>
                      </select>
                    </label>
                  </div>
                  <div className="wb-mapping">
                    {(Object.keys(labels) as (keyof Mapping)[]).map((key) => (
                      <label key={key}>
                        {labels[key]}
                        <select
                          aria-label={`对应${labels[key]}`}
                          value={cfg.mapping[key]}
                          onChange={(e) =>
                            update({ mapping: { ...cfg.mapping, [key]: Number(e.target.value) } })
                          }
                        >
                          <option value={-1}>不导入</option>
                          {Array.from(
                            {
                              length: Math.max(
                                ...s.rows.slice(0, 100).map((r) => r.cells.length),
                                1,
                              ),
                            },
                            (_, i) => (
                              <option key={i} value={i}>
                                {columnName(i)} ·{' '}
                                {s.rows.find((r) => r.row === cfg.headerRow)?.cells[i] || '空列名'}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="wb-import-options">
                    <label>
                      <input
                        type="checkbox"
                        checked={cfg.usePrices}
                        onChange={(e) => update({ usePrices: e.target.checked })}
                      />
                      使用清单单价（导入后标为“待确认”）
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={cfg.includeHidden}
                        onChange={(e) => update({ includeHidden: e.target.checked })}
                      />
                      包含隐藏行
                    </label>
                    <span>{cfg.excludedRows.length} 行已手动排除</span>
                  </div>
                  <p className="wb-muted">
                    取消行前勾选可排除标题、说明或小计。名称为空、常见合计行会自动跳过；单价公式仅读取文件中已保存的结果。
                  </p>
                  <div className="wb-import-preview">
                    <table>
                      <thead>
                        <tr>
                          <th>导入</th>
                          <th>原行</th>
                          {(Object.keys(labels) as (keyof Mapping)[])
                            .filter((k) => cfg.mapping[k] >= 0)
                            .map((k) => (
                              <th key={k}>{labels[k]}</th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.slice(page * 30, page * 30 + 30).map((row) => {
                          const inRange =
                            row.row >= cfg.startRow &&
                            row.row <= cfg.endRow &&
                            row.row > cfg.headerRow &&
                            (!row.hidden || cfg.includeHidden) &&
                            isImportMaterialName(row.cells[cfg.mapping.name] ?? '');
                          return (
                            <tr key={row.row} className={inRange ? '' : 'excluded'}>
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={`导入第 ${row.row} 行`}
                                  checked={inRange && !cfg.excludedRows.includes(row.row)}
                                  disabled={!inRange}
                                  onChange={(e) =>
                                    update({
                                      excludedRows: e.target.checked
                                        ? cfg.excludedRows.filter((n) => n !== row.row)
                                        : [...cfg.excludedRows, row.row],
                                    })
                                  }
                                />
                              </td>
                              <td>
                                {row.row}
                                {row.hidden ? ' 隐藏' : ''}
                              </td>
                              {(Object.keys(labels) as (keyof Mapping)[])
                                .filter((k) => cfg.mapping[k] >= 0)
                                .map((k) => (
                                  <td key={k}>{row.cells[cfg.mapping[k]]}</td>
                                ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="wb-pagination">
                    <span>
                      原表 {s.rows.length} 行 · 第 {page + 1} /{' '}
                      {Math.max(1, Math.ceil(s.rows.length / 30))} 页
                    </span>
                    <button
                      className="wb-button small"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      上一页
                    </button>
                    <button
                      className="wb-button small"
                      disabled={(page + 1) * 30 >= s.rows.length}
                      onClick={() => setPage(page + 1)}
                    >
                      下一页
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          <div className="wb-import-destination">
            <strong>导入到当前报价</strong>
            <label>
              <input
                type="radio"
                name="destination"
                checked={target === 'append'}
                onChange={() => setTarget('append')}
              />
              添加为新柜型
            </label>
            <label>
              <input
                type="radio"
                name="destination"
                checked={target === 'replace'}
                onChange={() => setTarget('replace')}
              />
              替换全部柜型及费用（可撤销）
            </label>
          </div>
          <div className="wb-modal-actions">
            <button className="wb-button" disabled={busy} onClick={onClose}>
              取消
            </button>
            <button
              className="wb-button primary"
              disabled={busy || (mode === 'custom' && !selected.length)}
              onClick={() => void apply()}
            >
              {busy ? '正在导入…' : '确认导入'}
            </button>
          </div>
        </>
      )}
    </WorkbenchModal>
  );
}
