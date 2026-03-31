import { useState, useEffect } from 'react';
import api from '../api';
import StockSearch from '../components/StockSearch';
import StockChart from '../components/StockChart';
import OrderModal from '../components/OrderModal';
import { useAuth } from '../context/AuthContext';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const pct = n => (n >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%';
const clr = n => n >= 0 ? 'up' : 'down';

export default function TradingPage() {
  const { refreshBalance } = useAuth();
  const [selected, setSelected] = useState(null);
  const [quote, setQuote]       = useState(null);
  const [quoteLoading, setQL]   = useState(false);
  const [modal, setModal]       = useState(null); // 'BUY' | 'SELL'
  const [toast, setToast]       = useState('');
  const [watchlist, setWatchlist] = useState([]);
  const [wlQuotes, setWlQuotes] = useState({});
  const [orders, setOrders]     = useState([]);

  // Load watchlist + orders on mount
  useEffect(() => {
    api.get('/stocks/watchlist').then(r => setWatchlist(r.data.data || []));
    api.get('/trading/orders').then(r => setOrders((r.data.data || []).slice(0, 20)));
  }, []);

  // Fetch watchlist quotes
  useEffect(() => {
    if (!watchlist.length) return;
    Promise.all(watchlist.map(w => api.get(`/stocks/quote/${w.symbol}`).catch(() => null)))
      .then(results => {
        const q = {};
        results.forEach((r, i) => { if (r) q[watchlist[i].symbol] = r.data.data; });
        setWlQuotes(q);
      });
  }, [watchlist]);

  const selectStock = async stock => {
    setSelected(stock); setQuote(null); setQL(true);
    try {
      const r = await api.get(`/stocks/quote/${stock.symbol}`);
      setQuote(r.data.data);
    } catch {}
    finally { setQL(false); }
  };

  const addWatch = async () => {
    if (!selected) return;
    await api.post('/stocks/watchlist', { symbol: selected.symbol, companyName: selected.name, exchange: selected.exchange });
    const r = await api.get('/stocks/watchlist');
    setWatchlist(r.data.data || []);
  };

  const removeWatch = async sym => {
    await api.delete(`/stocks/watchlist/${sym}`);
    setWatchlist(wl => wl.filter(w => w.symbol !== sym));
  };

  const onOrderSuccess = async msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
    refreshBalance();
    const r = await api.get('/trading/orders');
    setOrders((r.data.data || []).slice(0, 20));
    if (selected) {
      const q = await api.get(`/stocks/quote/${selected.symbol}`);
      setQuote(q.data.data);
    }
  };

  const inWatchlist = selected && watchlist.some(w => w.symbol === selected.symbol);

  return (
    <div className="page">
      <div className="page-title"><h1>Trade Stocks</h1></div>

      {toast && (
        <div className="success-msg" style={{ marginBottom: 16 }}>✅ {toast}</div>
      )}

      <div className="grid-trading">
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Search */}
          <div className="card">
            <StockSearch onSelect={selectStock} />
          </div>

          {/* Quote + Chart */}
          {selected && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h2 style={{ marginBottom: 2 }}>{selected.symbol.replace('.NS','').replace('.BO','')}</h2>
                  <div style={{ color: 'var(--txt2)', fontSize: 13 }}>{selected.name}</div>
                  <span className="badge badge-blue" style={{ marginTop: 4 }}>{selected.exchange}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {quoteLoading ? <span className="spinner" /> : quote && (
                    <>
                      <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt(quote.price)}</div>
                      <div className={clr(quote.changePercent)}>{fmt(quote.change)} ({pct(quote.changePercent)})</div>
                    </>
                  )}
                </div>
              </div>

              {quote && (
                <div className="grid-4" style={{ marginBottom: 16 }}>
                  {[['Open', quote.open], ['High', quote.high], ['Low', quote.low], ['Prev Close', quote.prevClose]].map(([l,v]) => (
                    <div key={l} style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--txt2)' }}>{l}</div>
                      <div className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{fmt(v)}</div>
                    </div>
                  ))}
                </div>
              )}

              <StockChart symbol={selected.symbol} />

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn btn-green" style={{ flex: 1 }} onClick={() => setModal('BUY')}>▲ BUY</button>
                <button className="btn btn-red"   style={{ flex: 1 }} onClick={() => setModal('SELL')}>▼ SELL</button>
                <button className={`btn ${inWatchlist ? 'btn-ghost' : 'btn-ghost'}`} onClick={inWatchlist ? () => removeWatch(selected.symbol) : addWatch}>
                  {inWatchlist ? '★ Watching' : '☆ Watch'}
                </button>
              </div>
            </div>
          )}

          {/* Recent Orders */}
          <div className="card">
            <div className="card-header"><span className="card-title">Recent Orders</span></div>
            {orders.length === 0 ? (
              <div className="empty"><div className="empty-icon">📋</div>No orders yet</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th><th>Total</th><th>Time</th></tr></thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.order_id}>
                        <td style={{ fontWeight: 600 }}>{o.symbol.replace('.NS','')}</td>
                        <td><span className={`badge ${o.transaction_type === 'BUY' ? 'badge-green' : 'badge-red'}`}>{o.transaction_type}</span></td>
                        <td className="mono">{o.quantity}</td>
                        <td className="mono">{fmt(o.price)}</td>
                        <td className="mono">{fmt(o.total_value)}</td>
                        <td style={{ color: 'var(--txt2)', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT – Watchlist */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header"><span className="card-title">Watchlist</span></div>
          {watchlist.length === 0 ? (
            <div className="empty"><div className="empty-icon">👀</div>Search and add stocks to watch</div>
          ) : (
            watchlist.map(w => {
              const q = wlQuotes[w.symbol];
              return (
                <div key={w.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => selectStock({ symbol: w.symbol, name: w.company_name, exchange: w.exchange })}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{w.symbol.replace('.NS','').replace('.BO','')}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt2)' }}>{w.company_name}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    {q ? (
                      <>
                        <div className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{fmt(q.price)}</div>
                        <div className={clr(q.changePercent)} style={{ fontSize: 11 }}>{pct(q.changePercent)}</div>
                      </>
                    ) : <span className="spinner" />}
                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 10, marginTop: 2 }}
                      onClick={e => { e.stopPropagation(); removeWatch(w.symbol); }}>✕</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {modal && selected && (
        <OrderModal stock={selected} quote={quote} side={modal}
          onClose={() => setModal(null)} onSuccess={onOrderSuccess} />
      )}
    </div>
  );
}
