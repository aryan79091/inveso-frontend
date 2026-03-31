import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api';

const PERIODS = ['1d', '5d', '1mo', '3mo', '1y'];

const fmt = (ts, period) => {
  const d = new Date(ts * 1000);
  if (period === '1d' || period === '5d') return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const fmtPrice = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StockChart({ symbol }) {
  const [period, setPeriod] = useState('1mo');
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.get(`/stocks/history/${symbol}?period=${period}`)
      .then(r => setData(r.data.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  if (!symbol) return null;

  const isUp   = data.length >= 2 && data[data.length - 1].close >= data[0].close;
  const color  = isUp ? '#3fb950' : '#f85149';

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--txt2)' }}>{fmt(d.time, period)}</div>
        <div style={{ color, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{fmtPrice(d.close)}</div>
        <div style={{ color: 'var(--txt2)' }}>Vol: {Number(d.volume).toLocaleString('en-IN')}</div>
      </div>
    );
  };

  return (
    <div className="chart-container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div className="period-btns">
          {PERIODS.map(p => (
            <button key={p} className={`period-btn ${p === period ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        </div>
      ) : data.length === 0 ? (
        <div className="empty" style={{ height: 260 }}>No chart data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="time" tickFormatter={t => fmt(t, period)} tick={{ fill: 'var(--txt2)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--txt2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => '₹' + v.toLocaleString('en-IN')} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
