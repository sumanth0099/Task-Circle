import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import Chatbot from './Chatbot';

const NAV_ITEMS = [
  { to: '/app', icon: '⊞', label: 'Dashboard', exact: true },
  { to: '/app/my-tasks', icon: '✓', label: 'My Tasks' },
  { to: '/app/notifications', icon: '🔔', label: 'Notifications', badge: true },
  { to: '/app/profile', icon: '◉', label: 'Profile' },
];

export default function AppLayout({ user, unreadCount, onRefreshUnread }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);

  const logout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    navigate('/login');
  };

  const initials = (name) =>
    name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const currentPage = NAV_ITEMS.find((n) => isActive(n.to, n.exact));

  return (
    <div className="shell">
      {/* ---- Sidebar ---- */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⟳</div>
          <span className="sidebar-logo-text">TaskCircle</span>
        </div>

        <div className="sidebar-nav">
          <span className="sidebar-label">Navigation</span>
          {NAV_ITEMS.map(({ to, icon, label, exact, badge }) => (
            <Link
              key={to}
              to={to}
              className={isActive(to, exact) ? 'active' : ''}
            >
              <span className="nav-icon">{icon}</span>
              {label}
              {badge && unreadCount > 0 && (
                <span className="nav-badge">{unreadCount}</span>
              )}
            </Link>
          ))}

          {/* AI Chat nav item — opens the existing Chatbot component */}
          <button
            type="button"
            className={chatOpen ? 'active' : ''}
            onClick={() => setChatOpen(prev => !prev)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500', transition: 'background 0.15s' }}
          >
            <span className="nav-icon">🤖</span>
            AI Chat
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="sidebar-avatar" style={{ objectFit: 'cover' }} />
            ) : (
              <div className="sidebar-avatar">{initials(user?.name)}</div>
            )}
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
          <button onClick={logout} type="button" className="btn-logout">
            ⎋ Sign out
          </button>
        </div>
      </nav>

      {/* ---- Main Content ---- */}
      <main className="content">
        <header className="topbar">
          <div className="topbar-left">
            <h1>{currentPage?.label ?? 'TaskCircle'}</h1>
            <p>Welcome back, {user?.name?.split(' ')[0]}!</p>
          </div>
          <div className="topbar-right">
            {/* Notification refresh */}
            <button
              onClick={onRefreshUnread}
              type="button"
              className="btn-refresh"
              data-tooltip="Refresh notifications"
            >
              <span className="refresh-icon">↻</span>
            </button>
          </div>
        </header>

        <div className="page-body">
          <Outlet />
        </div>
      </main>

      {/* Floating AI Chatbot — controlled by both its own toggle and the sidebar nav item */}
      <Chatbot externalOpen={chatOpen} onExternalClose={() => setChatOpen(false)} />
    </div>
  );
}
