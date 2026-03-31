import { useState, useRef, useEffect } from 'react';
import api from '../api';

export default function StockSearch({ onSelect, placeholder = 'Search stocks (e.g. TCS, Reliance)…' }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef            = useRef(null);
  const wrapRef             = useRef(null);

  useEffect(() => {
    const handler = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = val => {
    setQ(val);
    clearTimeout(timerRef.current);
    if (val.length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/stocks/search?q=${encodeURIComponent(val)}`);
        setResults(res.data.data || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  };

  const pick = stock => {
    setQ(stock.name);
    setOpen(false);
    onSelect(stock);
  };

  return (
    <div className="search-box" ref={wrapRef}>
      <span className="search-icon">🔍</span>
      <input
        className="input"
        style={{ paddingLeft: 36 }}
        placeholder={placeholder}
        value={q}
        onChange={e => search(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {loading && <span className="spinner" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }} />}
      {open && results.length > 0 && (
        <div className="search-dropdown">
          {results.map(s => (
            <div key={s.symbol} className="search-item" onClick={() => pick(s)}>
              <div>
                <div className="search-item-name">{s.name}</div>
                <div className="search-item-sym">{s.symbol}</div>
              </div>
              <span className="badge badge-blue">{s.exchange}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
