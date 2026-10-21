import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  calculateQuote,
  copyCabinet,
  money,
  newCabinet,
  newQuote,
  quoteSchema,
  validationMessage,
  uid,
  type Cabinet,
  type QuoteDocument,
} from '@jingneng/quote-core';
import { ApiError, downloadQuote, workbenchApi, type Version } from './api';
import { WorkbenchModal } from './Modal';
import { ImportDialog } from './ImportDialog';
import { MaterialsTable } from './MaterialsTable';
import { FeesPanel } from './FeesPanel';
import './workbench.css';
const fingerprint = (q: QuoteDocument) => JSON.stringify({ ...q, revision: 0, quoteNo: '' });
const recoveryKey = (id: string) => `jn-workbench-recovery-${id}`;

export function QuoteWorkbench() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDocument>(() => newQuote()),
    [loading, setLoading] = useState(!!id),
    [active, setActive] = useState(''),
    [baseline, setBaseline] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [saving, setSaving] = useState(false),
    [conflict, setConflict] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [versionList, setVersionList] = useState<Version[] | null>(null),
    [deleteCabinet, setDeleteCabinet] = useState<string | null>(null),
    [recovery, setRecovery] = useState<QuoteDocument | null>(null),
    [undoCount, setUndoCount] = useState(0),
    [exporting, setExporting] = useState(false),
    [tab, setTab] = useState<'materials' | 'costs'>('materials');
  const ref = useRef(quote);
  const saved = useRef('');
  const busy = useRef(false);
  const conflictRef = useRef(false);
  const undo = useRef<QuoteDocument[]>([]);
  const undoTime = useRef(0);
  const loaded = useRef<string | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<{ quote: QuoteDocument; mutationId: string } | null>(null);
  const [openError, setOpenError] = useState('');
  const install = useCallback((q: QuoteDocument) => {
    ref.current = q;
    setQuote(q);
    saved.current = fingerprint(q);
    setBaseline(saved.current);
    setActive(q.cabinets[0]?.id ?? '');
    setLoading(false);
    undo.current = [];
    setUndoCount(0);
    setError('');
    setConflict(false);
    conflictRef.current = false;
    retry.current = null;
  }, []);
  useEffect(() => {
    let cancelled = false;
    const target = id ?? 'new';
    if (!id && loaded.current === target) return;
    if (id === ref.current.id) {
      loaded.current = target;
      return;
    }
    const finish = (q: QuoteDocument) => {
      if (cancelled) return;
      loaded.current = target;
      install(q);
      try {
        const key = id ? recoveryKey(id) : 'jn-workbench-new-recovery';
        const raw = localStorage.getItem(key);
        if (raw) {
          const p = quoteSchema.safeParse(JSON.parse(raw));
          if (p.success && fingerprint(p.data) !== fingerprint(q)) setRecovery(p.data);
        }
      } catch {
        /* Ignore invalid recovery data, server remains authoritative. */
      }
    };
    if (!id) {
      finish(newQuote());
      return;
    }
    // Loading follows an external route ID; editing is suspended until the request completes.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setOpenError('');
    workbenchApi
      .get(id)
      .then(finish)
      .catch((e) => {
        if (!cancelled) {
          setOpenError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, install]);
  const dirty = !!baseline && fingerprint(quote) !== baseline;
  const calculated = useMemo(() => calculateQuote(quote), [quote]);
  const cabinet = quote.cabinets.find((c) => c.id === active) ?? quote.cabinets[0];
  const change = useCallback((recipe: (q: QuoteDocument) => void, discrete = false) => {
    const current = ref.current;
    if (discrete || Date.now() - undoTime.current > 900) {
      undo.current.push(structuredClone(current));
      if (undo.current.length > 30) undo.current.shift();
      undoTime.current = Date.now();
      setUndoCount(undo.current.length);
    }
    const next = structuredClone(current);
    recipe(next);
    ref.current = next;
    setQuote(next);
    setNotice('');
    if (!conflictRef.current) setError('');
  }, []);
  const changeCabinet = (recipe: (c: Cabinet) => void) =>
    change((q) => {
      const c = q.cabinets.find((c) => c.id === cabinet?.id);
      if (c) recipe(c);
    });
  const save = useCallback(async (): Promise<QuoteDocument | null> => {
    if (busy.current || conflictRef.current) return null;
    if (fingerprint(ref.current) === saved.current && ref.current.revision > 0) return ref.current;
    const payload = retry.current ?? { quote: structuredClone(ref.current), mutationId: uid() };
    const valid = quoteSchema.safeParse(payload.quote);
    if (!valid.success) {
      setError(
        `尚未保存：${valid.error.issues
          .slice(0, 2)
          .map(validationMessage)
          .join('；')}`,
      );
      return null;
    }
    busy.current = true;
    setSaving(true);
    setError('');
    retry.current = payload;
    try {
      const result = await workbenchApi.save(valid.data, payload.mutationId);
      retry.current = null;
      saved.current = fingerprint(result);
      setBaseline(saved.current);
      const next = { ...ref.current, revision: result.revision, quoteNo: result.quoteNo };
      ref.current = next;
      setQuote(next);
      if (fingerprint(next) === saved.current) {
        localStorage.removeItem(recoveryKey(result.id));
        localStorage.removeItem('jn-workbench-new-recovery');
      }
      if (!id) {
        loaded.current = result.id;
        navigate(`/quotes/${result.id}`, { replace: true });
      }
      return result;
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
        conflictRef.current = true;
        retry.current = null;
      }
      if (e instanceof ApiError && e.status === 400) retry.current = null;
      return null;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [id, navigate]);
  useEffect(() => {
    if (loading || !dirty) return;
    try {
      localStorage.setItem(
        quote.revision ? recoveryKey(quote.id) : 'jn-workbench-new-recovery',
        JSON.stringify(quote),
      );
    } catch {
      /* Local recovery is optional; database save remains available. */
    }
    if (!conflict) {
      autoTimer.current = setTimeout(() => void save(), 1800);
      return () => {
        if (autoTimer.current) clearTimeout(autoTimer.current);
      };
    }
  }, [quote, dirty, conflict, loading, save]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [save]);
  const applyImport = (
    cabinets: Cabinet[],
    mode: 'append' | 'replace',
    template?: QuoteDocument,
  ) => {
    change((q) => {
      const empty =
        q.cabinets.length === 1 &&
        !q.cabinets[0].materials.length &&
        calculateQuote(q).total === '0';
      q.cabinets = mode === 'replace' || empty ? cabinets : [...q.cabinets, ...cabinets];
      if (template) {
        for (const key of [
          'projectName',
          'customerName',
          'contactName',
          'contactPhone',
          'deliveryRequirement',
          'remark',
        ] as const)
          if (!q[key]) q[key] = template[key];
      }
    }, true);
    setActive(cabinets[0]?.id ?? '');
    setImportOpen(false);
    setNotice(
      `已导入 ${cabinets.length} 个柜型、${cabinets.reduce((n, c) => n + c.materials.length, 0)} 行物料。`,
    );
  };
  const copyQuote = () => {
    const q = structuredClone(ref.current);
    q.id = uid();
    q.revision = 0;
    q.quoteNo = '';
    q.projectName = `${q.projectName || '报价'}（副本）`;
    q.cabinets = q.cabinets.map((c) => ({
      ...c,
      id: uid(),
      materials: c.materials.map((m) => ({ ...m, id: uid() })),
    }));
    retry.current = null;
    conflictRef.current = false;
    setConflict(false);
    setError('');
    saved.current = 'copy';
    setBaseline('copy');
    ref.current = q;
    setQuote(q);
    setActive(q.cabinets[0]?.id ?? '');
    loaded.current = 'new';
    navigate('/quotes/new', { replace: true });
    setNotice('已生成副本，保存后获得新编号。');
  };
  const exportCurrent = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      let q = await save();
      if (q && fingerprint(ref.current) !== saved.current) q = await save();
      if (!q) throw new Error('请先完成保存，再导出 Excel。');
      if (fingerprint(ref.current) !== saved.current)
        throw new Error('导出期间仍在编辑，请保存后重新导出。');
      await downloadQuote(q);
      setNotice('Excel 已导出，包含总清单、全部柜型明细与公式。');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  if (loading) return <div className="wb-empty">正在打开报价…</div>;
  if (openError)
    return (
      <main className="wb-workbench">
        <div role="alert" className="wb-error">
          无法打开报价：{openError}
        </div>
        <Link className="wb-button" to="/quotes">
          返回报价列表
        </Link>
      </main>
    );
  return (
    <main className="wb-workbench">
      <div className="wb-document-bar">
        <div>
          <Link
            to="/quotes"
            onClick={(e) => {
              if (dirty) {
                e.preventDefault();
                void save().then((q) => {
                  if (q && fingerprint(ref.current) === saved.current) navigate('/quotes');
                });
              }
            }}
          >
            ‹ 报价列表
          </Link>
          <h1>{quote.customerName ? `${quote.customerName} · 报价` : '新建报价'}</h1>
          <div className="wb-save-line" aria-live="polite">
            <span className={`wb-save-dot ${error ? 'error' : dirty ? 'pending' : 'saved'}`} />
            {saving
              ? '正在保存到数据库…'
              : error
                ? '保存需要处理'
                : dirty
                  ? '有修改 · 等待保存'
                  : quote.revision
                    ? `已保存 · 版本 ${quote.revision}`
                    : '填写或导入清单后自动保存'}
            <span>{quote.quoteNo || '保存后生成编号'}</span>
          </div>
        </div>
        <div className="wb-actions">
          <button
            className="wb-button"
            disabled={!undoCount || saving}
            onClick={() => {
              const old = undo.current.pop();
              if (old) {
                const next = { ...old, revision: quote.revision, quoteNo: quote.quoteNo };
                ref.current = next;
                setQuote(next);
                setUndoCount(undo.current.length);
                setNotice('已撤销上一步修改。');
              }
            }}
          >
            撤销
          </button>
          <button className="wb-button" onClick={() => setImportOpen(true)}>
            导入 Excel
          </button>
          <button className="wb-button" disabled={saving || conflict} onClick={() => void save()}>
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            className="wb-button primary"
            disabled={saving || exporting || conflict}
            onClick={() => void exportCurrent()}
          >
            {exporting ? '正在导出…' : '导出 Excel'}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="wb-error">
          {error}
          {conflict && (
            <button className="wb-button" onClick={copyQuote}>
              另存为新报价
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="wb-notice" role="status">
          {notice}
        </div>
      )}
      {recovery && (
        <div className="wb-warning">
          <span>发现本机未保存的编辑，数据库中的版本已加载。</span>
          <button
            className="wb-button"
            onClick={() => {
              const data = structuredClone(recovery);
              if (id) {
                data.id = quote.id;
                data.revision = quote.revision;
                data.quoteNo = quote.quoteNo;
              }
              change((q) => Object.assign(q, data), true);
              setRecovery(null);
            }}
          >
            恢复未保存编辑
          </button>
          <button
            className="wb-button quiet"
            onClick={() => {
              localStorage.removeItem(id ? recoveryKey(id) : 'jn-workbench-new-recovery');
              setRecovery(null);
            }}
          >
            忽略
          </button>
        </div>
      )}
      <section className="wb-panel wb-document-fields">
        <div className="wb-form-grid">
          <label>
            客户名称
            <input
              aria-label="客户名称"
              value={quote.customerName}
              placeholder="填写客户名称"
              onChange={(e) =>
                change((q) => {
                  q.customerName = e.target.value;
                })
              }
            />
          </label>
          <label className="wide">
            项目名称
            <input
              aria-label="项目名称"
              value={quote.projectName}
              placeholder="客户项目 / 询价编号"
              onChange={(e) =>
                change((q) => {
                  q.projectName = e.target.value;
                })
              }
            />
          </label>
          <label>
            报价日期
            <input
              aria-label="报价日期"
              type="date"
              value={quote.quotationDate}
              onChange={(e) =>
                change((q) => {
                  q.quotationDate = e.target.value;
                })
              }
            />
          </label>
        </div>
        <details>
          <summary>联系人、交期与报价备注</summary>
          <div className="wb-form-grid">
            <label>
              联系人
              <input
                value={quote.contactName}
                onChange={(e) =>
                  change((q) => {
                    q.contactName = e.target.value;
                  })
                }
              />
            </label>
            <label>
              联系电话
              <input
                value={quote.contactPhone}
                onChange={(e) =>
                  change((q) => {
                    q.contactPhone = e.target.value;
                  })
                }
              />
            </label>
            <label>
              交货要求
              <input
                value={quote.deliveryRequirement}
                onChange={(e) =>
                  change((q) => {
                    q.deliveryRequirement = e.target.value;
                  })
                }
              />
            </label>
            <label className="wide">
              报价备注
              <textarea
                value={quote.remark}
                onChange={(e) =>
                  change((q) => {
                    q.remark = e.target.value;
                  })
                }
              />
            </label>
          </div>
        </details>
      </section>
      <div className="wb-editor-layout">
        <aside className="wb-cabinets">
          <div className="wb-cabinet-heading">
            <h2>
              柜型 <span>{quote.cabinets.length}</span>
            </h2>
            <button
              className="wb-button quiet small"
              aria-label="添加柜型"
              onClick={() => {
                const c = newCabinet(`柜型 ${quote.cabinets.length + 1}`);
                change((q) => q.cabinets.push(c), true);
                setActive(c.id);
              }}
            >
              ＋ 添加
            </button>
          </div>
          {quote.cabinets.map((c) => {
            const v = calculated.cabinets.find((v) => v.id === c.id)!;
            return (
              <button
                key={c.id}
                className={`wb-cabinet-card ${cabinet?.id === c.id ? 'active' : ''}`}
                onClick={() => setActive(c.id)}
              >
                <strong>{c.name || '未命名柜型'}</strong>
                <span>
                  {c.quantity} 台 · {c.materials.length} 行物料
                </span>
                <b title={v.orderTotal}>¥ {money(v.orderTotal)}</b>
                {v.pending > 0 || v.unassigned ? (
                  <em>
                    {v.pending} 项待确认{v.unassigned ? ' · 口径待确认' : ''}
                  </em>
                ) : (
                  <em className="ok">已核价</em>
                )}
              </button>
            );
          })}
          <p>柜型中的费用按每台填写，整单按柜型数量汇总。</p>
        </aside>
        <div className="wb-editor-main">
          {cabinet ? (
            <>
              <section className="wb-panel wb-cabinet-settings">
                <div className="wb-form-grid">
                  <label>
                    柜型名称
                    <input
                      aria-label="柜型名称"
                      value={cabinet.name}
                      onChange={(e) =>
                        changeCabinet((c) => {
                          c.name = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    规格型号
                    <input
                      aria-label="柜体规格"
                      value={cabinet.specification}
                      placeholder="宽 × 高 × 深"
                      onChange={(e) =>
                        changeCabinet((c) => {
                          c.specification = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    柜型数量（台）
                    <input
                      aria-label="柜型数量"
                      inputMode="decimal"
                      value={cabinet.quantity}
                      onChange={(e) =>
                        changeCabinet((c) => {
                          c.quantity = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    物料数量口径
                    <select
                      aria-label="物料数量口径"
                      value={cabinet.quantityBasis}
                      onChange={(e) =>
                        changeCabinet((c) => {
                          c.quantityBasis = e.target.value as Cabinet['quantityBasis'];
                        })
                      }
                    >
                      <option value="perCabinet">每台柜的用量</option>
                      <option value="project">此柜型整单用量</option>
                      <option value="unassigned">暂未确认（草稿）</option>
                    </select>
                  </label>
                </div>
                <div className="wb-cabinet-tools">
                  <p>
                    {cabinet.quantityBasis === 'project'
                      ? `清单数量 ÷ ${cabinet.quantity} 台 = 单台用量，工时及其他费用仍按单台填写。`
                      : cabinet.quantityBasis === 'unassigned'
                        ? '数量口径未确认：暂按每台用量试算，导出标为草稿。'
                        : '物料按每台用量计算；最终金额乘以柜型数量。'}
                  </p>
                  <div className="wb-actions">
                    <button
                      className="wb-button quiet small"
                      onClick={() => {
                        const c = copyCabinet(cabinet);
                        change((q) => q.cabinets.push(c), true);
                        setActive(c.id);
                      }}
                    >
                      复制柜型
                    </button>
                    <button
                      className="wb-button quiet danger small"
                      onClick={() => setDeleteCabinet(cabinet.id)}
                    >
                      删除柜型
                    </button>
                  </div>
                </div>
              </section>
              <div className="wb-editor-tabs">
                <button
                  className={tab === 'materials' ? 'active' : ''}
                  onClick={() => setTab('materials')}
                >
                  物料明细 <span>{cabinet.materials.length}</span>
                </button>
                <button className={tab === 'costs' ? 'active' : ''} onClick={() => setTab('costs')}>
                  工时与费用{' '}
                  <span>{calculated.cabinets.find((c) => c.id === cabinet.id)?.hours} h / 台</span>
                </button>
                <span className="wb-muted">当前柜型：{cabinet.name}</span>
              </div>
              {tab === 'materials' ? (
                <MaterialsTable key={cabinet.id} cabinet={cabinet} onChange={changeCabinet} />
              ) : (
                <FeesPanel cabinet={cabinet} onChange={changeCabinet} />
              )}
            </>
          ) : (
            <section className="wb-panel wb-empty">
              <h2>添加第一个柜型</h2>
              <p>可以导入 Excel 自动建立柜型，或使用左侧“添加”。</p>
              <button className="wb-button primary" onClick={() => setImportOpen(true)}>
                导入 Excel
              </button>
            </section>
          )}
        </div>
      </div>
      <section className="wb-order-summary">
        <div>
          <span>整单柜数</span>
          <strong>
            {calculated.cabinetCount} <small>台</small>
          </strong>
        </div>
        <div>
          <span>整单工时</span>
          <strong>
            {calculated.hours} <small>小时</small>
          </strong>
        </div>
        <div>
          <span>整单人工费</span>
          <strong>¥ {money(calculated.labor)}</strong>
        </div>
        <div className="wb-grand-total">
          <span>
            整单报价{calculated.pending || calculated.unassigned ? <em>含待确认项目</em> : null}
          </span>
          <strong title={`未四舍五入：${calculated.total}`} data-testid="quote-total">
            ¥ {money(calculated.total)}
          </strong>
        </div>
      </section>
      <div className="wb-bottom-tools">
        <span>原表算法 v1 · 历史库 / 店小二 / 采购协同未接入</span>
        <div className="wb-actions">
          <button
            className="wb-button quiet small"
            disabled={!quote.revision || saving}
            onClick={() =>
              workbenchApi
                .versions(quote.id)
                .then(setVersionList)
                .catch((e) => setError(e.message))
            }
          >
            版本记录
          </button>
          <button className="wb-button quiet small" disabled={saving} onClick={copyQuote}>
            另存为新报价
          </button>
        </div>
      </div>
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImport={applyImport} />}
      {deleteCabinet && (
        <WorkbenchModal title="删除这个柜型？" onClose={() => setDeleteCabinet(null)}>
          <p>将删除柜型下的物料、工时和费用，整单金额会重算。可以通过“撤销”恢复。</p>
          <div className="wb-modal-actions">
            <button className="wb-button" onClick={() => setDeleteCabinet(null)}>
              取消
            </button>
            <button
              className="wb-button danger"
              onClick={() => {
                change((q) => {
                  q.cabinets = q.cabinets.filter((c) => c.id !== deleteCabinet);
                }, true);
                setDeleteCabinet(null);
              }}
            >
              确认删除柜型
            </button>
          </div>
        </WorkbenchModal>
      )}
      {versionList && (
        <WorkbenchModal title="报价版本记录" onClose={() => setVersionList(null)}>
          <p className="wb-muted">
            每次成功保存生成一个版本。恢复旧版本会加载到编辑区，再保存为新版本。
          </p>
          <div className="wb-versions">
            {versionList.map((v) => (
              <div key={v.revision}>
                <div>
                  <strong>版本 {v.revision}</strong>
                  <span>{new Date(v.savedAt).toLocaleString('zh-CN')}</span>
                </div>
                <b>¥ {money(v.total)}</b>
                <button
                  className="wb-button small"
                  disabled={v.revision === quote.revision}
                  onClick={async () => {
                    try {
                      const old = await workbenchApi.version(quote.id, v.revision);
                      change(
                        (q) =>
                          Object.assign(q, { ...old, revision: q.revision, quoteNo: q.quoteNo }),
                        true,
                      );
                      setActive(old.cabinets[0]?.id ?? '');
                      setVersionList(null);
                      setNotice(`已恢复版本 ${v.revision} 的内容，将保存为新版本。`);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  恢复内容
                </button>
              </div>
            ))}
          </div>
        </WorkbenchModal>
      )}
    </main>
  );
}
