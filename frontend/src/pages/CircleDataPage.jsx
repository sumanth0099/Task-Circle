import { useState } from 'react';
import { apiUrl } from '../api/client';
import StatusBlock from '../components/StatusBlock';

export default function CircleDataPage({ circles, loading, error }) {
  // downloadingIds: Set of circle IDs currently being downloaded
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  // errorMap: { [circleId]: errorMessage }
  const [errorMap, setErrorMap] = useState({});

  const getPrivacyBadge = (privacy) => {
    if (privacy === 'PUBLIC') return <span className="badge badge-green">Public</span>;
    return <span className="badge badge-amber">Private</span>;
  };

  const getRoleBadge = (role) => {
    if (role === 'ADMIN') return <span className="badge badge-cyan">Admin</span>;
    if (role === 'MODERATOR') return <span className="badge badge-purple">Moderator</span>;
    return <span className="badge badge-gray">Member</span>;
  };

  const downloadCsv = async (circle) => {
    const { id: circleId } = circle;

    // Prevent duplicate requests
    if (downloadingIds.has(circleId)) return;

    // Clear previous error for this circle
    setErrorMap((prev) => {
      const next = { ...prev };
      delete next[circleId];
      return next;
    });

    setDownloadingIds((prev) => new Set([...prev, circleId]));

    try {
      const response = await fetch(
        `${apiUrl}/api/circles/${circleId}/data/export`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        let msg = `Download failed (${response.status})`;
        try {
          const json = await response.json();
          if (json?.message) msg = json.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(msg);
      }

      const jsonResponse = await response.json();
      const { circleSummary, memberTaskReport } = jsonResponse.data;

      const triggerDownload = (content, filename) => {
        const blob = new Blob(['\uFEFF' + content], { type: 'text/csv; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      };

      triggerDownload(circleSummary.content, circleSummary.filename);
      
      // Delay second download slightly to prevent browser blocking multiple rapid downloads
      setTimeout(() => {
        triggerDownload(memberTaskReport.content, memberTaskReport.filename);
      }, 300);
    } catch (err) {
      setErrorMap((prev) => ({ ...prev, [circleId]: err.message }));
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(circleId);
        return next;
      });
    }
  };

  return (
    <div className="stack">
      <div className="section-heading">
        <span className="card-title-icon">📊</span> Circle Data
      </div>

      <p className="circle-data-intro">
        Download a CSV report for any circle you belong to. The report includes
        task details, completion statistics, and member-level progress.
      </p>

      <article className="card">
        <div className="card-header">
          <h3 className="card-title">
            <span className="card-title-icon">📂</span> Your Circles
          </h3>
          <span className="badge badge-gray">{circles.length} circle{circles.length !== 1 ? 's' : ''}</span>
        </div>

        <StatusBlock
          loading={loading}
          error={error}
          hasData={circles.length > 0}
          emptyMessage="You haven't joined any circles yet."
        >
          <div className="circle-data-list">
            {circles.map((circle) => {
              const isDownloading = downloadingIds.has(circle.id);
              const dlError = errorMap[circle.id];

              return (
                <div key={circle.id} className="circle-data-row">
                  <div className="circle-data-left">
                    <div className="circle-icon circle-icon--sm">
                      {circle.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="circle-data-info">
                      <div className="circle-data-name">{circle.name}</div>
                      <div className="circle-data-meta">
                        <span className="code-display" data-tooltip="Join Code">
                          {circle.code}
                        </span>
                        {getPrivacyBadge(circle.privacy)}
                        {getRoleBadge(circle.role)}
                      </div>
                      {dlError && (
                        <div className="circle-data-error" role="alert">
                          &#9888; {dlError}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`btn-download-csv${isDownloading ? ' btn-download-csv--loading' : ''}`}
                    onClick={() => downloadCsv(circle)}
                    disabled={isDownloading}
                    aria-label={`Download CSV for ${circle.name}`}
                    id={`download-csv-${circle.id}`}
                  >
                    {isDownloading ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true" />
                        Generating&hellip;
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">&#11015;</span>
                        Download CSV
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </StatusBlock>
      </article>

      <article className="card">
        <div className="card-header">
          <h3 className="card-title">
            <span className="card-title-icon">&#128203;</span> What&apos;s Included in the Report
          </h3>
        </div>
        <div className="circle-data-info-grid">
          <div className="circle-data-info-item">
            <div className="stat-icon stat-icon-purple" style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>&#128221;</div>
            <div>
              <div className="circle-data-info-title">Task Details</div>
              <div className="circle-data-info-desc">
                Title, description, creator, assignee, priority, status, dates
              </div>
            </div>
          </div>
          <div className="circle-data-info-item">
            <div className="stat-icon stat-icon-cyan" style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>&#128200;</div>
            <div>
              <div className="circle-data-info-title">Circle Statistics</div>
              <div className="circle-data-info-desc">
                Total, completed, in-progress, to-do tasks &amp; completion %
              </div>
            </div>
          </div>
          <div className="circle-data-info-item">
            <div className="stat-icon stat-icon-green" style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>&#128101;</div>
            <div>
              <div className="circle-data-info-title">Member Progress</div>
              <div className="circle-data-info-desc">
                Per-member completed, in-progress, and pending task counts
              </div>
            </div>
          </div>
          <div className="circle-data-info-item">
            <div className="stat-icon stat-icon-amber" style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>&#128208;</div>
            <div>
              <div className="circle-data-info-title">CSV Format</div>
              <div className="circle-data-info-desc">
                Opens in Excel, Google Sheets, and all major spreadsheet apps
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
