import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import StatusBlock from '../components/StatusBlock';

export default function TaskDetailPage({ user }) {
  const { circleId, taskId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [task, setTask] = useState(null);

  const loadTask = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/tasks/${taskId}`);
      setTask(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const updateMemberStatus = async (targetTaskId, newStatus) => {
    try {
      await apiRequest(`/api/tasks/${targetTaskId}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ status: newStatus }) 
      });
      loadTask();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <StatusBlock loading={true} />;
  }

  if (error || !task) {
    return <StatusBlock error={error || 'Task not found'} />;
  }

  const { group_progress } = task;
  const isGroupTask = Boolean(group_progress);

  const getPriorityBadge = (priority) => {
    if (priority === 'HIGH') return <span className="badge badge-red">High</span>;
    if (priority === 'MEDIUM') return <span className="badge badge-amber">Medium</span>;
    return <span className="badge badge-cyan">Low</span>;
  };

  const getStatusBadge = (status) => {
    if (status === 'COMPLETED') return <span className="badge badge-green">Completed</span>;
    if (status === 'IN_PROGRESS') return <span className="badge badge-purple">In Progress</span>;
    return <span className="badge badge-gray">Todo</span>;
  };

  const initials = (name) => name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  return (
    <div className="stack">
      <Link to={`/app/circles/${circleId}`} className="btn-secondary" style={{ width: 'fit-content' }}>
        ← Back to Circle
      </Link>

      <article className="card">
        <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{task.title}</h2>
            {isGroupTask && <span className="badge badge-purple">Assigned to All</span>}
          </div>
          <div className="row" style={{ gap: '0.5rem' }}>
            {getPriorityBadge(task.priority)}
            <span className="badge badge-gray">Created by {task.creator_name}</span>
            {task.due_date && <span className="badge badge-amber">Due: {new Date(task.due_date).toLocaleDateString()}</span>}
          </div>
        </div>
        
        {task.description && (
          <div className="task-description" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
            {task.description}
          </div>
        )}
      </article>

      {isGroupTask ? (
        <article className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">📊</span> Team Progress</h3>
          </div>
          
          <div style={{ marginBottom: '2rem' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>{group_progress.completed} of {group_progress.total} completed</span>
              <strong>{group_progress.percentage}%</strong>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  background: 'var(--primary)', 
                  width: `${group_progress.percentage}%`,
                  transition: 'width 0.3s ease'
                }} 
              />
            </div>
          </div>

          <div className="list">
            {group_progress.members.map(member => (
              <div key={member.id} className="member-item" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <div className="member-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                    {initials(member.assignee_name)}
                  </div>
                  <div className="member-name">{member.assignee_name}</div>
                </div>
                
                <div className="row">
                  {getStatusBadge(member.status)}
                  {member.assigned_to === user.id && (
                    <select 
                      className="task-select" 
                      value={member.status}
                      onChange={(e) => updateMemberStatus(member.id, e.target.value)}
                      style={{ marginLeft: '1rem' }}
                    >
                      <option value="TODO">TODO</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : (
        <article className="card">
          <div className="card-header">
            <h3 className="card-title"><span className="card-title-icon">👤</span> Assignee</h3>
          </div>
          <div className="row">
            <div className="member-avatar">{initials(task.assignee_name)}</div>
            <div className="stack" style={{ gap: '0' }}>
              <strong>{task.assignee_name || 'Unassigned'}</strong>
              <div style={{ marginTop: '0.5rem' }}>{getStatusBadge(task.status)}</div>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
