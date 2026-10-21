import {
  calculateCabinet,
  FEE_KEYS,
  FEE_LABELS,
  LABOR_KEYS,
  money,
  type Cabinet,
} from '@jingneng/quote-core';
export function FeesPanel({
  cabinet: c,
  onChange,
}: {
  cabinet: Cabinet;
  onChange: (recipe: (c: Cabinet) => void) => void;
}) {
  const v = calculateCabinet(c);
  return (
    <div className="wb-cost-layout">
      <section className="wb-panel">
        <div className="wb-panel-heading">
          <h2>工时与费用</h2>
          <span className="wb-muted">以下均为每台柜的费用</span>
        </div>
        <div className="wb-table-scroll">
          <table className="wb-fees">
            <thead>
              <tr>
                <th>费用项目</th>
                <th>数量 / 工时</th>
                <th>单价 / 时薪（元）</th>
                <th>金额（元）</th>
              </tr>
            </thead>
            <tbody>
              {FEE_KEYS.map((key) => (
                <tr key={key} className={LABOR_KEYS.includes(key) ? 'labor' : ''}>
                  <td>
                    <strong>{FEE_LABELS[key]}</strong>
                    {LABOR_KEYS.includes(key) && <span className="wb-muted"> · 人工</span>}
                  </td>
                  <td>
                    <div className="wb-input-suffix">
                      <input
                        aria-label={`${FEE_LABELS[key]}数量${LABOR_KEYS.includes(key) ? '工时' : ''}`}
                        inputMode="decimal"
                        value={c.fees[key].quantity}
                        onChange={(e) =>
                          onChange((c) => {
                            c.fees[key].quantity = e.target.value;
                          })
                        }
                      />
                      <span>
                        {LABOR_KEYS.includes(key) ? '小时' : key === 'cabinet' ? '台' : '套'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <input
                      aria-label={`${FEE_LABELS[key]}单价`}
                      inputMode="decimal"
                      value={c.fees[key].unitPrice}
                      onChange={(e) =>
                        onChange((c) => {
                          c.fees[key].unitPrice = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td className="wb-money" title={v.fees[key]}>
                    {money(v.fees[key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="wb-labor-note">
          <label>
            工时说明
            <textarea
              aria-label="工时说明"
              placeholder="例如：8+30+11=49；仅作说明，不重复计入工时"
              value={c.laborNote}
              onChange={(e) =>
                onChange((c) => {
                  c.laborNote = e.target.value;
                })
              }
            />
          </label>
          <div>
            <span>每台人工</span>
            <strong>
              {v.hours} <small>小时</small>
            </strong>
            <span>¥ {money(v.labor)}</span>
          </div>
        </div>
      </section>
      <section className="wb-panel wb-calculation">
        <div className="wb-panel-heading">
          <h2>单台计价</h2>
          <span className="wb-tag">原表规则</span>
        </div>
        <div className="wb-breakdown">
          <div>
            <span>材料费</span>
            <strong title={v.material}>¥ {money(v.material)}</strong>
          </div>
          <div>
            <span>柜体费</span>
            <strong>¥ {money(v.fees.cabinet)}</strong>
          </div>
          <div>
            <span>
              其他费用 <small>含人工，不含柜体</small>
            </span>
            <strong>¥ {money(v.other)}</strong>
          </div>
        </div>
        <div className="wb-rates">
          {(
            [
              {
                key: 'managementRate',
                name: '管理费',
                amount: v.management,
                base: '（材料费＋其他费用）× 费率',
              },
              { key: 'taxFeeRate', name: '税费', amount: v.taxFee, base: '其他费用 × 费率' },
              {
                key: 'profitRate',
                name: '利润',
                amount: v.profit,
                base: '（材料费＋其他费用）× 费率',
              },
            ] as const
          ).map((r) => (
            <div key={r.key}>
              <div>
                <label>
                  {r.name}
                  <span className="wb-rate-input">
                    <input
                      aria-label={`${r.name}费率`}
                      inputMode="decimal"
                      value={c[r.key]}
                      placeholder="0"
                      onChange={(e) =>
                        onChange((c) => {
                          c[r.key] = e.target.value;
                        })
                      }
                    />
                    %
                  </span>
                </label>
                <strong title={r.amount}>¥ {money(r.amount)}</strong>
              </div>
              <p>{r.base}</p>
            </div>
          ))}
        </div>
        <div className="wb-total-line">
          <span>单台报价</span>
          <strong title={`完整精度：${v.total}`}>¥ {money(v.total)}</strong>
        </div>
        <div className="wb-net-line">
          <span>
            不含税价 <small>单台报价 ÷ 1.13</small>
          </span>
          <span title={v.net}>¥ {money(v.net)}</span>
        </div>
        <p className="wb-calculation-note">
          按完整精度计算，金额展示保留 2 位小数。税费沿用原表的费用口径，不另加整单 13% 税额。
        </p>
      </section>
    </div>
  );
}
