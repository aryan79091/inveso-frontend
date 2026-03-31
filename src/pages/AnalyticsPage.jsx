import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api';

const fmt  = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtK = v => '₹' + (v / 1000).toFixed(0) + 'k';
const pct  = n => (n >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%';
const clr  = n => n >= 0 ? 'var(--green)' : 'var(--red)';

const SQL_BADGE = ({ label }) => (
  <span style={{ fontSize: 10, background: 'var(--blue-bg)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
    {label}
  </span>
);

export default function AnalyticsPage() {
  const [loading, setLoading]   = useState(true);
  const [pnl, setPnl]           = useState([]);
  const [topStocks, setTop]     = useState([]);
  const [winRate, setWin]       = useState({ trades: [], summary: {} });
  const [monthly, setMonthly]   = useState([]);
  const [summary, setSummary]   = useState({});
  const [heatmap, setHeatmap]   = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/pnl-timeline'),
      api.get('/analytics/top-stocks'),
      api.get('/analytics/win-rate'),
      api.get('/analytics/monthly-volume'),
      api.get('/analytics/summary'),
      api.get('/analytics/activity-heatmap')
    ]).then(([p, t, w, m, s, h]) => {
      setPnl(p.data.data || []);
      setTop(t.data.data || []);
      setWin(w.data.data || { trades: [], summary: {} });
      setMonthly(m.data.data || []);
      setSummary(s.data.data || {});
      setHeatmap(h.data.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span className="spinner" style={{ width: 36, height: 36, borderWidth: 4 }} />
    </div>
  );

  const noData = (
    <div className="empty" style={{ height: 200 }}>
      <div className="empty-icon">📊</div>
      Place trades to generate analytics data
    </div>
  );

  const PIE_COLORS = ['#3fb950', '#f85149', '#58a6ff', '#d29922', '#a371f7'];

  return (
    <div className="page">
      <div className="page-title">
        <h1>Analytics</h1>
        <span style={{ color: 'var(--txt2)', fontSize: 13 }}>Powered by MySQL • Great for your Data Analyst portfolio 🎯</span>
      </div>

      {/* Summary KPIs */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          ['Total Orders',       summary.totalOrders,         'COUNT(*)'],
          ['Stocks Traded',      summary.uniqueStocksTraded,  'COUNT(DISTINCT)'],
          ['Trading Span',       (summary.tradingDaysSpan||0) + ' days', 'DATEDIFF()'],
          ['Overall P&L',        fmt(summary.overallPnl),     'SUM() window'],
        ].map(([label, value, sql]) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div className="stat-label">{label}</div>
              <SQL_BADGE label={sql} />
            </div>
            <div className="stat-value" style={{ fontSize: '1.3rem', color: label === 'Overall P&L' ? clr(summary.overallPnl) : 'var(--txt)' }}>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Cumulative P&L + Win Rate Pie */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

        {/* 1. Cumulative P&L — Window Function */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Cumulative P&amp;L Over Time</span>
            <SQL_BADGE label="SUM() OVER (ORDER BY date)" />
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt2)' }}>
            SELECT trade_date, daily_pnl,<br />
            &nbsp;&nbsp;SUM(daily_pnl) OVER (ORDER BY trade_date) AS cumulative_pnl<br />
            FROM (SELECT DATE(created_at), SUM(CASE ...) FROM orders GROUP BY 1)
          </div>
          {pnl.length === 0 ? noData : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={pnl}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#58a6ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="trade_date" tick={{ fill: 'var(--txt2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--txt2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                <Tooltip formatter={v => [fmt(v)]} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }} />
                <Area type="monotone" dataKey="cumulative_pnl" stroke="#58a6ff" strokeWidth={2} fill="url(#g1)" dot={false} name="Cumulative P&L" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 2. Win / Loss — CTE */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Win Rate by Stock</span>
            <SQL_BADGE label="WITH CTE (buys, sells)" />
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt2)' }}>
            WITH buys AS (SELECT symbol, AVG(price) FROM orders WHERE type='BUY' ...),<br />
            sells AS (SELECT symbol, AVG(price) FROM orders WHERE type='SELL' ...)<br />
            SELECT b.symbol, IF(sell&gt;buy, 'WIN', 'LOSS') FROM buys b JOIN sells s ...
          </div>

          {winRate.trades?.length === 0 ? noData : (
            <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                {[
                  ['Win Rate', (winRate.summary?.winRate || 0) + '%', 'var(--green)'],
                  ['Wins',     winRate.summary?.wins || 0, 'var(--green)'],
                  ['Losses',   winRate.summary?.losses || 0, 'var(--red)'],
                  ['Total P&L', fmt(winRate.summary?.totalPnl), clr(winRate.summary?.totalPnl)],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--txt2)' }}>{l}</div>
                    <div style={{ fontWeight: 700, color: c, fontFamily: 'var(--font-mono)' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart width={200} height={160}>
                  <Pie data={[{ name: 'Wins', value: winRate.summary?.wins || 0 }, { name: 'Losses', value: winRate.summary?.losses || 0 }]}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    <Cell fill="var(--green)" />
                    <Cell fill="var(--red)" />
                  </Pie>
                  <Legend formatter={v => <span style={{ color: 'var(--txt2)', fontSize: 12 }}>{v}</span>} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }} />
                </PieChart>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Monthly Volume + Top Stocks */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

        {/* 3. Monthly Volume — DATE_FORMAT + GROUP BY */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Monthly Trading Volume</span>
            <SQL_BADGE label="DATE_FORMAT + GROUP BY" />
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt2)' }}>
            SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,<br />
            &nbsp;&nbsp;SUM(total_value) AS volume, COUNT(*) AS orders<br />
            FROM orders WHERE user_id=? GROUP BY month ORDER BY month
          </div>
          {monthly.length === 0 ? noData : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--txt2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--txt2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                <Tooltip formatter={v => [fmt(v)]} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }} />
                <Bar dataKey="buy_volume"  fill="var(--green)" radius={[3,3,0,0]} name="Buy Volume"  />
                <Bar dataKey="sell_volume" fill="var(--red)"   radius={[3,3,0,0]} name="Sell Volume" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 4. Top Stocks — GROUP BY + aggregation */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Most Traded Stocks</span>
            <SQL_BADGE label="GROUP BY + COUNT + SUM" />
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt2)' }}>
            SELECT symbol, COUNT(*) AS trades, SUM(total_value) AS volume,<br />
            &nbsp;&nbsp;COUNT(DISTINCT DATE(created_at)) AS active_days<br />
            FROM orders GROUP BY symbol ORDER BY trades DESC LIMIT 10
          </div>
          {topStocks.length === 0 ? noData : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topStocks} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--txt2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="symbol" tick={{ fill: 'var(--txt2)', fontSize: 10 }} axisLine={false} tickLine={false} width={70}
                  tickFormatter={v => v.replace('.NS','').replace('.BO','')} />
                <Tooltip formatter={v => [v, 'Trades']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }} />
                <Bar dataKey="trade_count" fill="var(--blue)" radius={[0,3,3,0]} name="Trades" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 5. Win/Loss detail table — CTE results */}
      {winRate.trades?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Realised P&amp;L by Stock (CTE Result)</span>
            <SQL_BADGE label="CTE JOIN + CASE expression" />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th><th>Avg Buy</th><th>Avg Sell</th><th>Return %</th><th>Realised P&L</th><th>Result</th>
                </tr>
              </thead>
              <tbody>
                {winRate.trades.map(t => (
                  <tr key={t.symbol}>
                    <td style={{ fontWeight: 600 }}>{t.symbol.replace('.NS','')}</td>
                    <td className="mono">{fmt(t.avg_buy_price)}</td>
                    <td className="mono">{fmt(t.avg_sell_price)}</td>
                    <td className={t.return_pct >= 0 ? 'up mono' : 'down mono'}>{pct(t.return_pct)}</td>
                    <td className={`mono ${t.realised_pnl >= 0 ? 'up' : 'down'}`}>{fmt(t.realised_pnl)}</td>
                    <td><span className={`badge ${t.result==='WIN'?'badge-green':'badge-red'}`}>{t.result}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Heatmap — DAYNAME + HOUR */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Trading Activity Heatmap</span>
          <SQL_BADGE label="DAYNAME + HOUR + GROUP BY" />
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt2)' }}>
          SELECT DAYNAME(created_at) AS day, HOUR(created_at) AS hour, COUNT(*) AS orders<br />
          FROM orders WHERE user_id=? GROUP BY DAYOFWEEK(...), HOUR(...) ORDER BY day_num, hour
        </div>
        {heatmap.length === 0 ? noData : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Day</th><th>Hour</th><th>Orders</th><th>Volume</th><th>Activity</th></tr>
              </thead>
              <tbody>
                {heatmap.map((h, i) => {
                  const maxOrd = Math.max(...heatmap.map(x => x.order_count));
                  const barW   = (h.order_count / maxOrd) * 100;
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--txt2)' }}>{h.day_name}</td>
                      <td className="mono">{String(h.hour).padStart(2,'0')}:00</td>
                      <td className="mono">{h.order_count}</td>
                      <td className="mono">{fmt(h.volume)}</td>
                      <td style={{ width: 140 }}>
                        <div style={{ background: 'var(--bg)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                          <div style={{ background: 'var(--blue)', width: barW + '%', height: '100%', borderRadius: 4 }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
