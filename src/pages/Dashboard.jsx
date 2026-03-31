import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt  = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const pct  = n => (n >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%';
const clr  = n => n >= 0 ? 'up' : 'down';

export default function Dashboard() {
  const { refreshBalance } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary]   = useState(null);
  const [pnlData, setPnlData]   = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes]     = useState({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary'),
      api.get('/analytics/pnl-timeline'),
      api.get('/trading/portfolio'),
      api.get('/stocks/watchlist')
    ]).then(([s, p, port, wl]) => {
      setSummary(s.data.data);
      setPnlData(p.data.data || []);
      setPortfolio((port.data.data || []).slice(0, 5));
      setWatchlist((wl.data.data || []).slice(0, 6));
    }).catch(console.error)
      .finally(() => { setLoading(false); refreshBalance(); });
  }, []);

  useEffect(() => {
    if (!watchlist.length) return;
    Promise.all(watchlist.map(w => api.get(`/stocks/quote/${w.symbol}`).catch(() => null)))
      .then(results => {
        const q = {};
        results.forEach((r, i) => { if (r) q[watchlist[i].symbol] = r.data.data; });
        setQuotes(q);
      });
  }, [watchlist]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span className="spinner" style={{ width: 36, height: 36, borderWidth: 4 }} />
    </div>
  );

  const s = summary || {};
  const pnlColor = (s.overallPnl || 0) >= 0 ? '#3fb950' : '#f85149';

  return (
    <div className="page">
      <div className="page-title">
        <h1>Dashboard</h1>
        <span style={{ color: 'var(--txt2)', fontSize: 13 }}>Welcome back 👋</span>
      </div>

      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total Portfolio Value</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{fmt(s.totalPortfolioValue)}</div>
          <div className={`stat-sub ${clr(s.overallPnl)}`}>{pct(s.overallPnlPct)} overall</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available Cash</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--green)' }}>{fmt(s.availableCash)}</div>
          <div className="stat-sub">Free to invest</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Invested Value</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{fmt(s.investedValue)}</div>
          <div className="stat-sub">{s.holdingCount} stocks · {s.optionsCount} options</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overall P&amp;L</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', color: pnlColor }}>{fmt(s.overallPnl)}</div>
          <div className="stat-sub" style={{ color: 'var(--txt2)' }}>{s.totalOrders || 0} total orders</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* P&L chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Cumulative P&amp;L</span>
            <span style={{ fontSize: 11, color: 'var(--txt2)' }}>SQL Window Function</span>
          </div>
          {pnlData.length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div>Place trades to see your P&L chart</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={pnlData}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={pnlColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={pnlColor} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="trade_date" tick={{ fill: 'var(--txt2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--txt2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => '₹' + (v/1000).toFixed(0) + 'k'} />
                <Tooltip formatter={v => [fmt(v), 'Cumulative P&L']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }} />
                <Area type="monotone" dataKey="cumulative_pnl" stroke={pnlColor} strokeWidth={2} fill="url(#pnlGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Watchlist */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Watchlist</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/trade')}>+ Add</button>
          </div>
          {watchlist.length === 0 ? (
            <div className="empty"><div className="empty-icon">👀</div>Add stocks to your watchlist</div>
          ) : (
            <div>
              {watchlist.map(w => {
                const q = quotes[w.symbol];
                return (
                  <div key={w.symbol} onClick={() => navigate('/trade')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{w.symbol.replace('.NS','').replace('.BO','')}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt2)' }}>{w.company_name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontWeight: 600 }}>{q ? fmt(q.price) : '—'}</div>
                      {q && <div className={clr(q.changePercent)} style={{ fontSize: 11 }}>{pct(q.changePercent)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Holdings table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Holdings</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/portfolio')}>View All</button>
        </div>
        {portfolio.length === 0 ? (
          <div className="empty"><div className="empty-icon">📂</div>No holdings yet. <span style={{ color: 'var(--blue)', cursor: 'pointer' }} onClick={() => navigate('/trade')}>Start trading →</span></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Symbol</th><th>Qty</th><th>Avg Price</th><th>Invested</th></tr>
              </thead>
              <tbody>
                {portfolio.map(h => (
                  <tr key={h.portfolio_id}>
                    <td><div style={{ fontWeight: 600 }}>{h.symbol.replace('.NS','')}</div><div style={{ fontSize: 11, color: 'var(--txt2)' }}>{h.company_name}</div></td>
                    <td className="mono">{h.quantity}</td>
                    <td className="mono">{fmt(h.avg_price)}</td>
                    <td className="mono">{fmt(h.quantity * h.avg_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
