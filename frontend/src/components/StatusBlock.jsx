export default function StatusBlock({ loading, error, emptyMessage, hasData, children }) {
  if (loading) {
    return (
      <div className="state">
        <div className="spinner" />
        <span className="state-text">Loading...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="state">
        <div className="state-icon">⚠️</div>
        <span className="state-text error-text">{error}</span>
      </div>
    );
  }
  if (!hasData) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">◯</div>
        <p className="empty-state-title">{emptyMessage}</p>
        <p className="empty-state-desc">Nothing to show here yet.</p>
      </div>
    );
  }
  return children;
}
