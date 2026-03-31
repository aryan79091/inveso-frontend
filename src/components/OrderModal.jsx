import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function OrderModal({ stock, quote, side, onClose, onSuccess }) {
  const { balance, refreshBalance } = useAuth();
  const [form, setForm]   = useState({ qty: 1, orderType: 'MARKET', price: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ltp      = quote?.price || 0;
  const execPrice = form.orderType === 'MARKET' ? ltp : parseFloat(form.price) || 0;
  const total    = form.qty * execPrice;

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  useEffect(() => {
    if (form.orderType === 'LIMIT' && !form.price) setForm(f => ({ ...f, price: ltp.toFixed(2) }));
  }, [form.orderType, ltp]);

  const submit = async () => {
    setError('');
    if (form.qty < 1) return setError('Quantity must be at least 1');
    if (form.orderType === 'LIMIT' && (!form.price || parseFloat(form.price) <= 0)) return setError('Enter a valid limit price');
    setLoading(true);
    try {
      await api.post('/trading/order', {
        symbol: stock.symbol,
        companyName: stock.name,
        transactionType: side,
        orderType: form.orderType,
        quantity: form.qty,
        price: execPrice,
        productType: 'CNC'
      });
      await refreshBalance();
      onSuccess?.(`${side} order placed for ${form.qty} × ${stock.symbol}`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Order failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 style={{ color: side === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
            {side === 'BUY' ? '🟢' : '🔴'} {side} {stock.symbol}
          </h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--txt2)' }}>LTP</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(ltp)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)' }}>Available</div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{fmt(balance)}</div>
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="form-group">
          <label className="form-label">Order Type</label>
          <select name="orderType" className="select" value={form.orderType} onChange={handle}>
            <option value="MARKET">Market</option>
            <option value="LIMIT">Limit</option>
          </select>
        </div>

        {form.orderType === 'LIMIT' && (
          <div className="form-group">
            <label className="form-label">Limit Price (₹)</label>
            <input name="price" type="number" className="input" step="0.05" min="0.05"
              value={form.price} onChange={handle} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Quantity</label>
          <input name="qty" type="number" className="input" min="1"
            value={form.qty} onChange={handle} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, marginBottom: 16 }}>
          <span style={{ color: 'var(--txt2)' }}>Total Value</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(total)}</span>
        </div>

        <button
          className={`btn btn-block ${side === 'BUY' ? 'btn-green' : 'btn-red'}`}
          onClick={submit} disabled={loading}
        >
          {loading ? <span className="spinner" /> : `Confirm ${side}`}
        </button>
      </div>
    </div>
  );
}
