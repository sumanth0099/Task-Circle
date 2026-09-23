import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import StatusBlock from '../components/StatusBlock';

export default function DashboardPage({ circles, loading, error, reload }) {
  const [form, setForm] = useState({ name: '', description: '', privacy: 'PUBLIC' });
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const createCircle = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      await apiRequest('/api/circles', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', description: '', privacy: 'PUBLIC' });
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const joinCircle = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      await apiRequest('/api/circles/join', { method: 'POST', body: JSON.stringify({ code: joinCode }) });
      setJoinCode('');
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getPrivacyBadge = (privacy) => {
    if (privacy === 'PUBLIC') return <span className="badge badge-green">Public</span>;
    return <span className="badge badge-amber">Private</span>;
  };

  const getRoleBadge = (role) => {
    if (role === 'OWNER') return <span className="badge badge-purple">Owner</span>;
    if (role === 'ADMIN') return <span className="badge badge-cyan">Admin</span>;
    return <span className="badge badge-gray">Member</span>;
  };

  return (
    <div className="stack">
      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">⊞</div>
          <div>
            <div className="stat-value">{circles.length}</div>
            <div className="stat-label">Active Circles</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-cyan">👤</div>
          <div>
            <div className="stat-value">{circles.filter(c => c.role === 'OWNER').length}</div>
            <div className="stat-label">Owned</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">🤝</div>
          <div>
            <div className="stat-value">{circles.filter(c => c.role !== 'OWNER').length}</div>
            <div className="stat-label">Joined</div>
          </div>
        </div>
      </div>

      {formError && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
          <p style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>
        </div>
      )}

      <section className="grid">
        <article className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">✨</span> Create Circle</h3>
          </div>
          <form onSubmit={createCircle} className="stack">
            <div className="form-group">
              <label className="form-label">Circle Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Engineering Team" required disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this circle for?" disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Privacy</label>
              <select value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value })} disabled={submitting}>
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Circle'}
            </button>
          </form>
        </article>

        <article className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">🔗</span> Join Circle</h3>
          </div>
          <form onSubmit={joinCircle} className="stack">
            <div className="form-group">
              <label className="form-label">Join Code</label>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} minLength={8} maxLength={8} placeholder="8 character code" required disabled={submitting} />
            </div>
            <button type="submit" className="btn-secondary" style={{ marginTop: '0.5rem' }} disabled={submitting}>
              {submitting ? 'Joining...' : 'Join Circle'}
            </button>
          </form>
          
          <div className="divider" style={{ margin: '2rem 0' }}></div>
          
          <div style={{ textAlign: 'center' }}>
            <p className="form-label" style={{ marginBottom: '1rem' }}>Or explore public circles</p>
            <div className="state-icon" style={{ fontSize: '2rem', opacity: 0.5 }}>🌐</div>
          </div>
        </article>

        <article className="card span2">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">📂</span> Your Circles</h3>
          </div>
          <StatusBlock loading={loading} error={error} hasData={circles.length > 0} emptyMessage="You haven't joined any circles yet.">
            <div className="grid">
              {circles.map((circle) => (
                <Link to={`/app/circles/${circle.id}`} key={circle.id} className="circle-card ripple">
                  <div className="circle-icon">{circle.name.charAt(0).toUpperCase()}</div>
                  <div className="circle-info">
                    <div className="circle-name">{circle.name}</div>
                    <div className="circle-meta">
                      {getPrivacyBadge(circle.privacy)}
                      {getRoleBadge(circle.role)}
                      <span className="code-display" data-tooltip="Join Code">{circle.code}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </StatusBlock>
        </article>
      </section>
    </div>
  );
}
