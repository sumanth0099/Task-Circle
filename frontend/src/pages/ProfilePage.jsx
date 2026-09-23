import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export default function ProfilePage({ user, onRefresh }) {
  const [name, setName] = useState(user?.name || '');
  const [prefs, setPrefs] = useState({ due_today_enabled: true, due_tomorrow_enabled: true, overdue_enabled: true });
  const [loadedPrefs, setLoadedPrefs] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    apiRequest('/api/profile/notification-preferences')
      .then((data) => setPrefs(data))
      .finally(() => setLoadedPrefs(true));
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    await apiRequest('/api/profile', { method: 'PATCH', body: JSON.stringify({ name }) });
    onRefresh();
    setTimeout(() => setSavingProfile(false), 500);
  };

  const savePrefs = async (event) => {
    event.preventDefault();
    setSavingPrefs(true);
    await apiRequest('/api/profile/notification-preferences', { method: 'PATCH', body: JSON.stringify(prefs) });
    setTimeout(() => setSavingPrefs(false), 500);
  };

  return (
    <div className="stack">
      <div className="section-heading">
        <span className="card-title-icon">◉</span> Profile & Settings
      </div>

      <section className="grid">
        <article className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">👤</span> Account Info</h3>
          </div>
          <form className="stack" onSubmit={saveProfile}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address (Read-only)</label>
              <input value={user?.email || ''} readOnly style={{ opacity: 0.7 }} />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
              {savingProfile ? 'Saved!' : 'Save Profile'}
            </button>
          </form>
        </article>

        <article className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">⚙️</span> Notification Preferences</h3>
          </div>
          <form className="stack" onSubmit={savePrefs}>
            {!loadedPrefs ? (
              <div className="spinner" style={{ margin: '1rem auto' }}></div>
            ) : (
              <>
                <label className="toggle-label">
                  <div>
                    <div className="toggle-text">Due Today</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Get notified for tasks due today</div>
                  </div>
                  <div className="toggle-switch">
                    <input type="checkbox" checked={prefs.due_today_enabled} onChange={(e) => setPrefs({ ...prefs, due_today_enabled: e.target.checked })} />
                    <div className="toggle-slider"></div>
                  </div>
                </label>
                
                <label className="toggle-label">
                  <div>
                    <div className="toggle-text">Due Tomorrow</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Get notified for tasks due tomorrow</div>
                  </div>
                  <div className="toggle-switch">
                    <input type="checkbox" checked={prefs.due_tomorrow_enabled} onChange={(e) => setPrefs({ ...prefs, due_tomorrow_enabled: e.target.checked })} />
                    <div className="toggle-slider"></div>
                  </div>
                </label>
                
                <label className="toggle-label">
                  <div>
                    <div className="toggle-text">Overdue</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Get notified when tasks are overdue</div>
                  </div>
                  <div className="toggle-switch">
                    <input type="checkbox" checked={prefs.overdue_enabled} onChange={(e) => setPrefs({ ...prefs, overdue_enabled: e.target.checked })} />
                    <div className="toggle-slider"></div>
                  </div>
                </label>

                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
                  {savingPrefs ? 'Saved!' : 'Save Preferences'}
                </button>
              </>
            )}
          </form>
        </article>
      </section>
    </div>
  );
}
