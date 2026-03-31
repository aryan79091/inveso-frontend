import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt    = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtNum = n => Number(n || 0).toLocaleString('en-IN');

const INSTRUMENTS = [
  { label: 'NIFTY',    value: 'NIFTY'       },
  { label: 'BANKNIFTY',value: 'BANKNIFTY'   },
  { label: 'FINNIFTY', value: 'FINNIFTY'    },
  { label: 'RELIANCE', value: 'RELIANCE.NS' },
  { label: 'TCS',      value: 'TCS.NS'      },
  { label: 'INFY',     value: 'INFY.NS'     },
  { label: 'HDFCBANK', value: 'HDFCBANK.NS' },
];

export default function OptionsPage() {
  const { refreshBalance, balance } = useAuth();
  const [instrument, setInstrument] = useState('NIFTY');
  const [expiries, setExpiries]     = useState([]);
  const [expiry, setExpiry]         = useState('');
  const [chain, setChain]           = useState(null);
  const [chainLoading, setCL]       = useState(false);
  const [order, setOrder]           = useState(null); // { strike, type }
  const [form, setForm]             = useState({ qty: 1, price: '' });
  const [orderLoading, setOL]       = useState(false);
  const [toast, setToast]           = useState('');
  const [error, setError]           = useState('');
  const [positions, setPositions]   = useState([]);
  const [tab, setTab]               = useState('chain'); // 'chain' | 'positions' | 'orders'
  const [optOrders, setOptOrders]   = useState([]);

  useEffect(() => {
    api.get(`/stocks/options-expiry/${instrument}`).then(r => {
      const dates = r.data.data || [];
      setExpiries(dates);
      setExpiry(dates[0] || '');
    });
  }, [instrument]);

  useEffect(() => {
    if (!expiry) return;
    setCL(true); setChain(null);
    api.get(`/stocks/options-chain/${instrument}?expiry=${expiry}`)
      .then(r => setChain(r.data.data))
      .catch(() => setChain(null))
      .finally(() => setCL(false));
  }, [instrument, expiry]);

  useEffect(() => {
    api.get('/trading/options/portfolio').then(r => setPositions(r.data.data || []));
    api.get('/trading/options/orders').then(r => setOptOrders((r.data.data || []).slice(0, 30)));
  }, []);

  const openOrder = (strike, type, price) => {
    setOrder({ strike, type, price });
    setForm({ qty: 1, price: price.toFixed(2) });
    setError('');
  };

  const placeOrder = async txType => {
    setError(''); setOL(true);
    try {
      await api.post('/trading/options/order', {
        symbol: instrument,
        optionType: order.type,
        strikePrice: order.strike,
        expiryDate: expiry,
        lotSize: chain?.lotSize || 1,
        transactionType: txType,
        quantity: form.qty,
        price: parseFloat(form.price)
      });
      await refreshBalance();
      const [pos, ord] = await Promise.all([
        api.get('/trading/options/portfolio'),
        api.get('/trading/options/orders')
      ]);
      setPositions(pos.data.data || []);
      setOptOrders((ord.data.data || []).slice(0, 30));
      setToast(`${txType} ${form.qty} lot(s) of ${instrument} ${order.strike} ${order.type}`);
      setTimeout(() => setToast(''), 3500);
      setOrder(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Order failed');
    } finally { setOL(false); }
  };

  const daysToExpiry = expiry ? Math.ceil((new Date(expiry) - Date.now()) / 86400000) : 0;

  return (
    <div className="page">
      <div className="page-title"><h1>Options Trading</h1></div>

      {toast && <div className="success-msg" style={{ marginBottom: 16 }}>✅ {toast}</div>}

      {/* Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div className="form-label">Instrument</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {INSTRUMENTS.map(i => (
                <button key={i.value} className={`btn btn-sm ${instrument === i.value ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setInstrument(i.value)}>{i.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div className="form-label">Expiry</div>
            <select className="select" style={{ width: 160 }} value={expiry} onChange={e => setExpiry(e.target.value)}>
              {expiries.map(d => <option key={d} value={d}>{d} ({Math.ceil((new Date(d)-Date.now())/86400000)}d)</option>)}
            </select>
          </div>
        </div>
        {chain && (
          <div style={{ marginTop: 12, display: 'flex', gap: 16, color: 'var(--txt2)', fontSize: 12 }}>
            <span>Spot: <strong style={{ color: 'var(--txt)', fontFamily: 'var(--font-mono)' }}>{fmt(chain.spotPrice)}</strong></span>
            <span>Lot Size: <strong style={{ color: 'var(--txt)' }}>{chain.lotSize}</strong></span>
            <span>DTE: <strong style={{ color: daysToExpiry < 7 ? 'var(--red)' : 'var(--txt)' }}>{daysToExpiry}</strong></span>
          </div>
        )}
      </div>

      <div className="grid-options">
        {/* Options chain */}
        <div>
          <div className="tabs">
            {['chain','positions','orders'].map(t => (
              <div key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
                {t === 'chain' ? 'Options Chain' : t === 'positions' ? `Positions (${positions.length})` : `Orders (${optOrders.length})`}
              </div>
            ))}
          </div>

          {tab === 'chain' && (
            <div className="card">
              {chainLoading ? (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                </div>
              ) : !chain ? (
                <div className="empty">Failed to load options chain</div>
              ) : (
                <div className="table-wrap">
                  <table className="chain-table">
                    <thead>
                      <tr>
                        <th style={{ color: 'var(--green)' }}>CE OI</th>
                        <th style={{ color: 'var(--green)' }}>CE Vol</th>
                        <th style={{ color: 'var(--green)' }}>CE IV</th>
                        <th style={{ color: 'var(--green)' }}>CE Price</th>
                        <th style={{ textAlign: 'center', color: 'var(--blue)' }}>Strike</th>
                        <th style={{ color: 'var(--red)' }}>PE Price</th>
                        <th style={{ color: 'var(--red)' }}>PE IV</th>
                        <th style={{ color: 'var(--red)' }}>PE Vol</th>
                        <th style={{ color: 'var(--red)' }}>PE OI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chain.strikes.map(s => (
                        <tr key={s.strike} className={s.isATM ? 'chain-atm' : ''}>
                          <td style={{ color: 'var(--txt2)' }}>{fmtNum(s.CE.OI)}</td>
                          <td style={{ color: 'var(--txt2)' }}>{fmtNum(s.CE.volume)}</td>
                          <td style={{ color: 'var(--txt2)' }}>{s.CE.IV}%</td>
                          <td className="chain-click" style={{ color: 'var(--green)', fontWeight: 600 }}
                            onClick={() => openOrder(s.strike, 'CE', s.CE.price)}>
                            {fmt(s.CE.price)}
                            <span className="chain-label">{s.CE.change > 0 ? '▲' : '▼'}{Math.abs(s.CE.change)}%</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: s.isATM ? 'var(--blue)' : 'var(--txt)' }}>
                            {s.strike.toLocaleString('en-IN')}
                            {s.isATM && <span style={{ display: 'block', fontSize: 9, color: 'var(--blue)' }}>ATM</span>}
                          </td>
                          <td className="chain-click" style={{ color: 'var(--red)', fontWeight: 600 }}
                            onClick={() => openOrder(s.strike, 'PE', s.PE.price)}>
                            {fmt(s.PE.price)}
                            <span className="chain-label">{s.PE.change > 0 ? '▲' : '▼'}{Math.abs(s.PE.change)}%</span>
                          </td>
                          <td style={{ color: 'var(--txt2)' }}>{s.PE.IV}%</td>
                          <td style={{ color: 'var(--txt2)' }}>{fmtNum(s.PE.volume)}</td>
                          <td style={{ color: 'var(--txt2)' }}>{fmtNum(s.PE.OI)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'positions' && (
            <div className="card">
              {positions.length === 0 ? (
                <div className="empty"><div className="empty-icon">📂</div>No open options positions</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Symbol</th><th>Type</th><th>Strike</th><th>Expiry</th><th>Lots</th><th>Avg Price</th><th>Value</th></tr></thead>
                    <tbody>
                      {positions.map(p => (
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

          {tab === 'orders' && (
            <div className="card">
              {optOrders.length === 0 ? (
                <div className="empty"><div className="empty-icon">📋</div>No options orders yet</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Symbol</th><th>Type</th><th>Strike</th><th>Tx</th><th>Lots</th><th>Price</th><th>Total</th><th>Time</th></tr></thead>
                    <tbody>
                      {optOrders.map(o => (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 600 }}>{o.symbol}</td>
                          <td><span className={o.option_type==='CE'?'ce-tag':'pe-tag'}>{o.option_type}</span></td>
                          <td className="mono">{Number(o.strike_price).toLocaleString('en-IN')}</td>
                          <td><span className={`badge ${o.transaction_type==='BUY'?'badge-green':'badge-red'}`}>{o.transaction_type}</span></td>
                          <td className="mono">{o.quantity}</td>
                          <td className="mono">{fmt(o.price)}</td>
                          <td className="mono">{fmt(o.total_value)}</td>
                          <td style={{ color: 'var(--txt2)', fontSize: 11 }}>{new Date(o.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order panel */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ marginBottom: 16 }}>Place Options Order</h3>
          {!order ? (
            <div className="empty" style={{ padding: '30px 10px' }}>
              <div className="empty-icon">👆</div>
              Click any CE / PE price in the chain to open an order
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--txt2)' }}>Instrument</span>
                  <strong>{instrument}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--txt2)' }}>Strike / Type</span>
                  <strong>{Number(order.strike).toLocaleString('en-IN')} <span className={order.type==='CE'?'ce-tag':'pe-tag'}>{order.type}</span></strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--txt2)' }}>Expiry</span>
                  <strong>{expiry}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--txt2)' }}>Lot Size</span>
                  <strong>{chain?.lotSize || 1}</strong>
                </div>
              </div>

              {error && <div className="error-msg">{error}</div>}

              <div className="form-group">
                <label className="form-label">Price (₹ per unit)</label>
                <input className="input" type="number" step="0.05" min="0.05"
                  value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Lots</label>
                <input className="input" type="number" min="1"
                  value={form.qty} onChange={e => setForm(f => ({ ...f, qty: parseInt(e.target.value) }))} />
              </div>

              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--txt2)', fontSize: 13 }}>Total (approx)</span>
                <strong className="mono">{fmt(form.qty * (chain?.lotSize || 1) * parseFloat(form.price || 0))}</strong>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button className="btn btn-green" style={{ flex: 1 }} disabled={orderLoading} onClick={() => placeOrder('BUY')}>
                  {orderLoading ? <span className="spinner" /> : '▲ BUY'}
                </button>
                <button className="btn btn-red" style={{ flex: 1 }} disabled={orderLoading} onClick={() => placeOrder('SELL')}>
                  {orderLoading ? <span className="spinner" /> : '▼ SELL'}
                </button>
              </div>
              <button className="btn btn-ghost btn-block btn-sm" onClick={() => setOrder(null)}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
