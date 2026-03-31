import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Navbar() {
  const { user, balance, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav className="navbar">
      <NavLink to="/" className="nav-logo">📈 Inveso</NavLink>

      <div className="nav-links">
        <NavLink to="/"          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} end>Dashboard</NavLink>
        <NavLink to="/trade"     className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Trade</NavLink>
        <NavLink to="/options"   className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Options</NavLink>
        <NavLink to="/portfolio" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Portfolio</NavLink>
        <NavLink to="/analytics" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Analytics</NavLink>
      </div>

      <div className="nav-right">
        <span className="nav-balance">{fmt(balance)}</span>
        <span style={{ color: 'var(--txt2)', fontSize: 13 }}>{user?.fullName?.split(' ')[0]}</span>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
