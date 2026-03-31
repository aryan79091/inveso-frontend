import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import OrderModal from '../components/OrderModal';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const pct = n => (n >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%';
const clr = n => n >= 0 ? 'up' : 'down';

export default function PortfolioPage() {
  const { refreshBalance } = useAuth();
  const [tab, setTab]             = useState('equity');
  const [holdings, setHoldings]   = useState([]);
  const [optPos, setOptPos]       = useState([]);
  const [orders, setOrders]       = useState([]);
  const [optOrders, setOptOrders] = useState([]);
  const [quotes, setQuotes]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // { stock, quote, side }
  const [toast, setToast]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [port, opts, ord, optOrd] = await Promise.all([
        api.get('/trading/portfolio'),
        api.get('/trading/options/portfolio'),
        api.get('/trading/orders'),
        api.get('/trading/options/orders')
      ]);
      setHoldings(port.data.data  || []);
      setOptPos(opts.data.data    || []);
      setOrders(ord.data.data     || []);
      setOptOrders(optOrd.data.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  // Fetch live quotes for holdings
  useEffect(() => {
    if (!holdings.length) return;
    Promise.all(holdings.map(h => api.get(`/stocks/quote/${h.symbol}`).catch(() => null)))
      .then(results => {
        const q = {};
        results.forEach((r, i) => { if (r) q[holdings[i].symbol] = r.data.data; });
        setQuotes(q);
      });
  }, [holdings]);

  const onOrderSuccess = async msg => {
    setToast(msg); setTimeout(() => setToast(''), 3500);
    await load(); refreshBalance();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span className="spinner" style={{ width: 36, height: 36, borderWidth: 4 }} />
    </div>
  );

  // Equity summary
  let totalInvested = 0, totalCurrent = 0;
  holdings.forEach(h => {
    const q = quotes[h.symbol];
    totalInvested += h.quantity * h.avg_price;
    totalCurrent  += h.quantity * (q?.price || h.avg_price);
  });
  const totalPnl    = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <div className="page">
      <div className="page-title"><h1>Portfolio</h1></div>

      {toast && <div className="success-msg" style={{ marginBottom: 16 }}>✅ {toast}</div>}

      {/* Summary cards */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Invested</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{fmt(totalInvested)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Value</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{fmt(totalCurrent)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unrealised P&amp;L</div>
          <div className={`stat-value ${clr(totalPnl)}`} style={{ fontSize: '1.2rem' }}>{fmt(totalPnl)}</div>
          <div className={`stat-sub ${clr(totalPnlPct)}`}>{pct(totalPnlPct)}</div>
        </div>
      </div>

      <div className="tabs">
        {[
          ['equity',    `Equity Holdings (${holdings.length})`],
          ['options',   `Options Positions (${optPos.length})`],
          ['orders',    `Order History (${orders.length})`],
          ['optorders', `Options Orders (${optOrders.length})`],
        ].map(([key, label]) => (
          <div key={key} className={`tab ${tab===key?'active':''}`} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>

      {/* Equity Holdings */}
      {tab === 'equity' && (
        <div className="card">
          {holdings.length === 0 ? (
            <div className="empty"><div className="empty-icon">📂</div>No equity holdings</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Stock</th><th>Qty</th><th>Avg Buy</th><th>LTP</th><th>Invested</th><th>Current</th><th>P&L</th><th>P&L %</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const q   = quotes[h.symbol];
                    const ltp = q?.price || h.avg_price;
                    const inv = h.quantity * h.avg_price;
                    const cur = h.quantity * ltp;
                    const pl  = cur - inv;
                    const plp = (pl / inv) * 100;
                    return (
                      <tr key={h.portfolio_id}>
                        <td><div style={{ fontWeight: 600 }}>{h.symbol.replace('.NS','').replace('.BO','')}</div><div style={{ fontSize: 11, color: 'var(--txt2)' }}>{h.company_name}</div></td>
                        <td className="mono">{h.quantity}</td>
                        <td className="mono">{fmt(h.avg_price)}</td>
                        <td className="mono">{q ? fmt(ltp) : '—'}</td>
                        <td className="mono">{fmt(inv)}</td>
                        <td className="mono">{fmt(cur)}</td>
                        <td className={`mono ${clr(pl)}`}>{fmt(pl)}</td>
                        <td className={clr(plp)}>{pct(plp)}</td>
                        <td>
                          <button className="btn btn-red btn-sm"
                            onClick={() => setModal({ stock: { symbol: h.symbol, name: h.company_name }, quote: q, side: 'SELL' })}>
                            Sell
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Options Positions */}
      {tab === 'options' && (
        <div className="card">
          {optPos.length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div>No options positions</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Symbol</th><th>Type</th><th>Strike</th><th>Expiry</th><th>Lots</th><th>Avg Price</th><th>Invested</th></tr></thead>
                <tbody>
                  {optPos.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.symbol}</td>
                      <td><span className={p.option_type==='CE'?'ce-tag':'pe-tag'}>{p.option_type}</span></td>
                      <td className="mono">{Number(p.strike_price).toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--txt2)', fontSize: 12 }}>{p.expiry_date}</td>
                      <td className="mono">{p.quantity}</td>
                      <td className="mono">{fmt(p.avg_price)}</td>
                      <td className="mono">{fmt(p.quantity * p.lot_size * p.avg_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Equity Order History */}
      {tab === 'orders' && (
        <div className="card">
          {orders.length === 0 ? (
            <div className="empty"><div className="empty-icon">📋</div>No orders yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Symbol</th><th>Type</th><th>Order</th><th>Qty</th><th>Price</th><th>Total</th><th>Product</th><th>Date</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.order_id}>
                      <td style={{ fontWeight: 600 }}>{o.symbol.replace('.NS','')}</td>
                      <td><span className={`badge ${o.transaction_type==='BUY'?'badge-green':'badge-red'}`}>{o.transaction_type}</span></td>
                      <td><span className="badge badge-blue">{o.order_type}</span></td>
                      <td className="mono">{o.quantity}</td>
                      <td className="mono">{fmt(o.price)}</td>
                      <td className="mono">{fmt(o.total_value)}</td>
                      <td style={{ color: 'var(--txt2)' }}>{o.product_type}</td>
                      <td style={{ color: 'var(--txt2)', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Options Order History */}
      {tab === 'optorders' && (
        <div className="card">
          {optOrders.length === 0 ? (
            <div className="empty"><div className="empty-icon">📋</div>No options orders yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Symbol</th><th>Type</th><th>Strike</th><th>Expiry</th><th>Tx</th><th>Lots</th><th>Price</th><th>Total</th><th>Date</th></tr></thead>
                <tbody>
                  {optOrders.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{o.symbol}</td>
                      <td><span className={o.option_type==='CE'?'ce-tag':'pe-tag'}>{o.option_type}</span></td>
                      <td className="mono">{Number(o.strike_price).toLocaleString('en-IN')}</td>
                      <td style={{ fontSize: 12, color: 'var(--txt2)' }}>{o.expiry_date}</td>
                      <td><span className={`badge ${o.transaction_type==='BUY'?'badge-green':'badge-red'}`}>{o.transaction_type}</span></td>
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
      )}

      {modal && (
        <OrderModal stock={modal.stock} quote={modal.quote} side={modal.side}
          onClose={() => setModal(null)} onSuccess={onOrderSuccess} />
      )}
    </div>
  );
}
