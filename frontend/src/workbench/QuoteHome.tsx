import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '@jingneng/quote-core';
import { workbenchApi, type QuoteSummary } from './api';
import { WorkbenchModal } from './Modal';
import './workbench.css';

export function QuoteHome() {
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [remove, setRemove] = useState<QuoteSummary | null>(null),
    [busy, setBusy] = useState(false);
  const refresh = () => {
    setLoading(true);
    setError('');
    workbenchApi
      .list()
      .then(setQuotes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    let cancelled = false;
    workbenchApi
      .list()
      .then((items) => {
        if (!cancelled) setQuotes(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const visible = quotes.filter((q) =>
    [q.quoteNo, q.customerName, q.projectName].some((v) =>
      v.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  return (
    <main className="wb-home">
      <div className="wb-page-heading">
        <div>
          <div className="wb-eyebrow">QUOTATION WORKBENCH</div>
          <h1>报价工作台</h1>
          <p>从客户清单到成套报价，每一笔费用都有依据。</p>
        </div>
        <Link className="wb-button primary" to="/quotes/new">
          ＋ 新建报价
        </Link>
      </div>
      <div className="wb-intro">
        <div>
          <strong>原表算法 · 已固化</strong>
          <p>按柜型计算材料、工时与费用，保留完整精度。</p>
        </div>
        <div>
          <strong>Excel 导入与导出</strong>
          <p>支持列对应、多个工作表和原报价模板。</p>
        </div>
        <div>
          <strong>本机数据库保存</strong>
          <p>保存版本可回看，价格暂由人工填写。</p>
        </div>
      </div>
      <section className="wb-panel">
        <div className="wb-panel-heading">
          <h2>
            我的报价 <span className="wb-muted">{quotes.length}</span>
          </h2>
          <div className="wb-actions">
            <input
              className="wb-input"
              aria-label="搜索报价"
              placeholder="搜索客户、项目、编号"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="wb-button" onClick={refresh}>
              刷新
            </button>
          </div>
        </div>
        {error && (
          <div role="alert" className="wb-error">
            {error}{' '}
            <button className="wb-button" onClick={refresh}>
              重新连接
            </button>
          </div>
        )}
        {loading ? (
          <div className="wb-empty">正在读取数据库…</div>
        ) : !visible.length ? (
          <div className="wb-empty">
            <div className="wb-empty-mark">▤</div>
            <h3>{search ? '没有匹配的报价' : '开始第一份报价'}</h3>
            <p>新建报价后导入 Excel，或直接添加柜型与物料。</p>
            <Link className="wb-button primary" to="/quotes/new">
              新建报价
            </Link>
          </div>
        ) : (
          <div className="wb-table-scroll">
            <table className="wb-list-table">
              <thead>
                <tr>
                  <th>客户 / 项目</th>
                  <th>报价编号</th>
                  <th>柜数</th>
                  <th>整单金额</th>
                  <th>确认状态</th>
                  <th>最后保存</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link className="wb-quote-title" to={`/quotes/${q.id}`}>
                        {q.customerName || '未填写客户'}
                      </Link>
                      <div className="wb-muted">{q.projectName || '未填写项目'}</div>
                    </td>
                    <td>
                      <Link to={`/quotes/${q.id}`}>{q.quoteNo}</Link>
                      <div className="wb-muted">版本 {q.revision}</div>
                    </td>
                    <td>{q.cabinetCount}</td>
                    <td className="wb-money">¥ {money(q.total)}</td>
                    <td>
                      <span
                        className={`wb-status ${q.pending || q.unassigned ? 'pending' : 'confirmed'}`}
                      >
                        {q.pending || q.unassigned
                          ? `${q.pending} 项待确认${q.unassigned ? ' · 数量待确认' : ''}`
                          : '已核价'}
                      </span>
                    </td>
                    <td>
                      {new Date(q.updatedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <div className="wb-actions">
                        <Link className="wb-button small" to={`/quotes/${q.id}`}>
                          打开
                        </Link>
                        <button
                          className="wb-button quiet danger small"
                          onClick={() => setRemove(q)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="wb-footnote">
        当前为本机工作台。历史价格库、店小二与采购协同尚未接入；客户备注和询价状态可在报价中保留。
      </p>
      {remove && (
        <WorkbenchModal title="删除这份报价？" onClose={() => setRemove(null)}>
          <p>“{remove.customerName || remove.quoteNo}” 将从列表中移除，数据库仍保留历史版本。</p>
          <div className="wb-modal-actions">
            <button className="wb-button" onClick={() => setRemove(null)}>
              取消
            </button>
            <button
              className="wb-button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await workbenchApi.remove(remove.id, remove.revision);
                  setRemove(null);
                  refresh();
                } catch (e) {
                  setError((e as Error).message);
                  setRemove(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认删除
            </button>
          </div>
        </WorkbenchModal>
      )}
    </main>
  );
}
