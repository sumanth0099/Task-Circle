import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { apiRequest } from './api/client';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CircleDetailPage from './pages/CircleDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import MyTasksPage from './pages/MyTasksPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import CircleDataPage from './pages/CircleDataPage';
import './styles/app.css';

function ProtectedRoutes({ user, unreadCount, circles, circlesLoading, circlesError, refreshCircles, refreshUnread }) {
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route path="/" element={<AppLayout user={user} unreadCount={unreadCount} onRefreshUnread={refreshUnread} />}>
        <Route index element={<DashboardPage circles={circles} loading={circlesLoading} error={circlesError} reload={refreshCircles} />} />
        <Route path="circles/:circleId" element={<CircleDetailPage user={user} refreshUnread={refreshUnread} />} />
        <Route path="circles/:circleId/tasks/:taskId" element={<TaskDetailPage user={user} />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="notifications" element={<NotificationsPage refreshUnread={refreshUnread} />} />
        <Route path="profile" element={<ProfilePage user={user} />} />
        <Route path="circle-data" element={<CircleDataPage circles={circles} loading={circlesLoading} error={circlesError} />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [circles, setCircles] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [circlesLoading, setCirclesLoading] = useState(false);
  const [circlesError, setCirclesError] = useState('');

  // Refresh only the circles list
  const refreshCircles = useCallback(async () => {
    setCirclesLoading(true);
    setCirclesError('');
    try {
      const data = await apiRequest('/api/circles');
      setCircles(data);
    } catch (err) {
      setCirclesError(err.message);
    } finally {
      setCirclesLoading(false);
    }
  }, []);

  // Refresh only the unread notification count
  const refreshUnread = useCallback(async () => {
    try {
      const data = await apiRequest('/api/notifications/unread-count');
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Silently fail — not critical
    }
  }, []);

  // Initial auth check — runs once on mount
  useEffect(() => {
    const init = async () => {
      try {
        const me = await apiRequest('/api/auth/me');
        setUser(me.user || me);
        // Fetch circles and unread count in parallel after auth confirmed
        await Promise.all([refreshCircles(), refreshUnread()]);
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    init();
  }, [refreshCircles, refreshUnread]);

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">⟳</div>
        <p className="loading-text">Loading TaskCircle...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoutes
              user={user}
              unreadCount={unreadCount}
              circles={circles}
              circlesLoading={circlesLoading}
              circlesError={circlesError}
              refreshCircles={refreshCircles}
              refreshUnread={refreshUnread}
            />
          }
        />
        <Route path="*" element={<Navigate to={user ? '/app' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
