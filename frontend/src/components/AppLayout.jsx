import { useState, useEffect } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile sidebar whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const logout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    navigate('/login');
  };

  const initials = (name) =>
    name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const currentPage = NAV_ITEMS.find((n) => isActive(n.to, n.exact));

  const sidebarContent = (
    <>
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

        {/* AI Chat nav item */}
        <button
          type="button"
          className={`sidebar-nav-btn${chatOpen ? ' active' : ''}`}
          onClick={() => setChatOpen(prev => !prev)}
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
    </>
  );

  return (
    <div className="shell">
      {/* ---- Desktop Sidebar ---- */}
      <nav className="sidebar sidebar--desktop">
        {sidebarContent}
      </nav>

      {/* ---- Mobile Sidebar Drawer ---- */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav className={`sidebar sidebar--mobile${sidebarOpen ? ' sidebar--mobile-open' : ''}`}>
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>
        {sidebarContent}
      </nav>

      {/* ---- Main Content ---- */}
      <main className="content">
        <header className="topbar">
          <div className="topbar-left">
            {/* Hamburger — only visible on mobile */}
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              type="button"
            >
              <span /><span /><span />
            </button>
            <div>
              <h1>{currentPage?.label ?? 'TaskCircle'}</h1>
              <p>Welcome back, {user?.name?.split(' ')[0]}!</p>
            </div>
          </div>
          <div className="topbar-right">
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

      {/* Floating AI Chatbot */}
      <Chatbot externalOpen={chatOpen} onExternalClose={() => setChatOpen(false)} />
    </div>
  );
}
