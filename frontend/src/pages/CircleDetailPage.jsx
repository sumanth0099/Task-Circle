import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import StatusBlock from '../components/StatusBlock';

export default function CircleDetailPage() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [circle, setCircle] = useState(null);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', due_date: '', assigned_to: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadCircleData = useCallback(async () => {
    try {
      setLoading(true);
      const [circleData, memberData, requestData] = await Promise.all([
        apiRequest(`/api/circles/${circleId}`),
        apiRequest(`/api/circles/${circleId}/members`),
        apiRequest(`/api/circles/${circleId}/join-requests`).catch(() => [])
      ]);
      setCircle(circleData);
      setMembers(memberData);
      setRequests(requestData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  const loadTasks = useCallback(async () => {
    try {
      const taskData = await apiRequest(`/api/circles/${circleId}/tasks`);
      setTasks(taskData);
    } catch (err) {
      // Ignore
    }
  }, [circleId]);

  useEffect(() => {
    loadCircleData();
    loadTasks();
  }, [loadCircleData, loadTasks]);

  const createTask = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = { ...taskForm };
      if (payload.assigned_to) payload.assigned_to = Number(payload.assigned_to);
      else delete payload.assigned_to;
      await apiRequest(`/api/circles/${circleId}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', due_date: '', assigned_to: '' });
      await loadTasks();
    } finally {
      setSubmitting(false);
    }
  };

  const assignAll = async () => {
    if (submitting || !taskForm.title.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/circles/${circleId}/tasks/assign-all`, { method: 'POST', body: JSON.stringify(taskForm) });
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', due_date: '', assigned_to: '' });
      await loadTasks();
    } finally {
      setSubmitting(false);
    }
  };

  const updateRequest = async (requestId, status) => {
    try {
      await apiRequest(`/api/circles/${circleId}/join-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      // Just reload requests and members
      const [newMembers, newRequests] = await Promise.all([
        apiRequest(`/api/circles/${circleId}/members`),
        apiRequest(`/api/circles/${circleId}/join-requests`).catch(() => [])
      ]);
      setMembers(newMembers);
      setRequests(newRequests);
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (taskId, status) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    try {
      await apiRequest(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } catch (err) {
      // Revert on error
      await loadTasks();
    }
  };

  const leaveCircle = async () => {
    if (!window.confirm('Are you sure you want to leave this circle?')) return;
    try {
      await apiRequest(`/api/circles/${circleId}/members/leave`, { method: 'POST' });
      navigate('/app');
    } catch (err) {
      alert(err.message);
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'ADMIN') return <span className="badge badge-cyan">Admin</span>;
    if (role === 'MODERATOR') return <span className="badge badge-purple">Mod</span>;
    return <span className="badge badge-gray">Member</span>;
  };

  const getPriorityBadge = (priority) => {
    if (priority === 'HIGH') return <span className="badge badge-red">High</span>;
    if (priority === 'MEDIUM') return <span className="badge badge-amber">Medium</span>;
    return <span className="badge badge-cyan">Low</span>;
  };

  const initials = (name) => name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  // Group tasks by assignment_group_id so we don't list 10 duplicate tasks for assign-all
  const groupedTasks = [];
  const processedGroups = new Set();

  tasks.forEach(task => {
    if (task.assignment_group_id) {
      if (!processedGroups.has(task.assignment_group_id)) {
        processedGroups.add(task.assignment_group_id);
        const siblings = tasks.filter(t => t.assignment_group_id === task.assignment_group_id);
        const completed = siblings.filter(t => t.status === 'COMPLETED').length;
        groupedTasks.push({
          ...task,
          isGroup: true,
          siblingCount: siblings.length,
          completedCount: completed,
        });
      }
    } else {
      groupedTasks.push({ ...task, isGroup: false });
    }
  });

  return (
    <div className="stack">
      <StatusBlock loading={loading} error={error} hasData={Boolean(circle)} emptyMessage="Circle not found">
        
        <article className="card" style={{ background: 'var(--grad-sidebar)' }}>
          <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="row" style={{ marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{circle?.name}</h2>
                <span className="badge badge-purple">{circle?.privacy}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)' }}>{circle?.description || 'No description provided.'}</p>
            </div>
            <div className="stack" style={{ alignItems: 'flex-end', gap: '0.5rem' }}>
              <div className="code-display" data-tooltip="Join Code">
                Code: {circle?.code}
              </div>
              <button onClick={leaveCircle} className="btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                Leave Circle
              </button>
            </div>
          </div>
        </article>

        <div className="grid">
          <div className="stack">
            <article className="card">
              <div className="card-header">
                <h3 className="card-title"><span className="card-title-icon">📝</span> Create Task</h3>
              </div>
              <form onSubmit={createTask} className="stack">
                <div className="form-group">
                  <label className="form-label">Task Title</label>
                  <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="What needs to be done?" required disabled={submitting} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Details (optional)" disabled={submitting} />
                </div>
                <div className="row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Priority</label>
                    <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })} disabled={submitting}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Due Date</label>
                    <input type="datetime-local" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} disabled={submitting} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Assign To</label>
                  <select value={taskForm.assigned_to} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })} disabled={submitting}>
                    <option value="">— Unassigned —</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="row" style={{ marginTop: '0.5rem' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={submitting}>Create Task</button>
                  <button type="button" className="btn-secondary" onClick={assignAll} disabled={submitting || !taskForm.title.trim()}>Assign to All</button>
                </div>
              </form>
            </article>

            {requests.length > 0 && (
              <article className="card">
                <div className="card-header">
                  <h3 className="card-title"><span className="card-title-icon">🔔</span> Join Requests</h3>
                </div>
                <div className="list">
                  {requests.map((request) => (
                    <div key={request.id} className="list-item">
                      <div className="list-item-title">{request.name}</div>
                      <div className="list-item-actions">
                        <button className="btn btn-success btn-sm" onClick={() => updateRequest(request.id, 'APPROVED')}>Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => updateRequest(request.id, 'REJECTED')}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}
            
            <article className="card">
              <div className="card-header">
                <h3 className="card-title"><span className="card-title-icon">👥</span> Members</h3>
              </div>
              <div className="list">
                {members.map((member) => (
                  <div key={member.id} className="member-item">
                    <div className="member-avatar">{initials(member.name)}</div>
                    <div>
                      <div className="member-name">{member.name}</div>
                      <div className="member-role">{getRoleBadge(member.role)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="stack">
            <article className="card">
              <div className="card-header">
                <h3 className="card-title"><span className="card-title-icon">📋</span> Tasks</h3>
              </div>
              <StatusBlock loading={false} error={null} hasData={groupedTasks.length > 0} emptyMessage="No tasks yet.">
                <div className="list">
                  {groupedTasks.map((task) => (
                    <div key={task.id} className="task-item">
                      <div className={`task-status-dot ${task.isGroup ? (task.completedCount === task.siblingCount ? 'completed' : 'todo') : task.status.toLowerCase()}`}></div>
                      <div className="task-body">
                        {task.isGroup ? (
                          <Link to={`/app/circles/${circleId}/tasks/${task.id}`} className="task-title" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                            {task.title}
                          </Link>
                        ) : (
                          <div className="task-title">{task.title}</div>
                        )}
                        
                        <div className="task-meta">
                          {getPriorityBadge(task.priority)}
                          
                          {task.isGroup ? (
                            <span className="badge badge-purple">
                              Assigned to All ({task.completedCount}/{task.siblingCount} done)
                            </span>
                          ) : (
                            <span className="badge badge-gray">Assignee: {task.assignee_name || 'None'}</span>
                          )}
                        </div>
                      </div>
                      
                      {!task.isGroup && (
                        <select 
                          className="task-select" 
                          value={task.status} 
                          onChange={(e) => updateStatus(task.id, e.target.value)}
                        >
                          <option value="TODO">TODO</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      )}
                      
                      {task.isGroup && (
                        <Link to={`/app/circles/${circleId}/tasks/${task.id}`} className="btn-secondary btn-sm">
                          View Progress
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </StatusBlock>
            </article>
          </div>
        </div>
      </StatusBlock>
    </div>
  );
}
