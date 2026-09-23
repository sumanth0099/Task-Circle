import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import StatusBlock from '../components/StatusBlock';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/my-tasks');
      setTasks(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (taskId, status) => {
    await apiRequest(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    load();
  };

  const getPriorityBadge = (priority) => {
    if (priority === 'HIGH') return <span className="badge badge-red">High Priority</span>;
    if (priority === 'MEDIUM') return <span className="badge badge-amber">Medium</span>;
    return <span className="badge badge-cyan">Low</span>;
  };

  return (
    <div className="stack">
      <div className="section-heading">
        <span className="card-title-icon">✓</span> My Assigned Tasks
      </div>
      
      <article className="card">
        <StatusBlock loading={loading} error={error} hasData={tasks.length > 0} emptyMessage="You have no assigned tasks. Go relax! ☕">
          <div className="list">
            {tasks.map((task) => (
              <div key={task.id} className="task-item">
                <div className={`task-status-dot ${task.status.toLowerCase()}`}></div>
                <div className="task-body">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    {getPriorityBadge(task.priority)}
                    <span className="badge badge-purple">{task.circle_name}</span>
                  </div>
                </div>
                <select 
                  className="task-select" 
                  value={task.status} 
                  onChange={(e) => updateStatus(task.id, e.target.value)}
                >
                  <option value="TODO">TODO</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>
            ))}
          </div>
        </StatusBlock>
      </article>
    </div>
  );
}
