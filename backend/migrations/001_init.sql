CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  google_id VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  code CHAR(8) UNIQUE NOT NULL,
  privacy VARCHAR(10) NOT NULL CHECK (privacy IN ('PUBLIC', 'PRIVATE')),
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_circles_created_by ON circles(created_by);

CREATE TABLE IF NOT EXISTS memberships (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('ADMIN', 'MODERATOR', 'MEMBER')),
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REMOVED')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user_circle ON memberships(user_id, circle_id);

CREATE TABLE IF NOT EXISTS join_requests (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_join_requests_circle_status ON join_requests(circle_id, status);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  status VARCHAR(16) NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED')),
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  due_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_circle_id ON tasks(circle_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id BIGINT REFERENCES circles(id) ON DELETE CASCADE,
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  type VARCHAR(24) NOT NULL CHECK (type IN ('NEW_TASK', 'DUE_TODAY', 'DUE_TOMORROW', 'OVERDUE')),
  message TEXT NOT NULL,
  reminder_date DATE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_reminders
  ON notifications(user_id, task_id, type, reminder_date)
  WHERE type IN ('DUE_TODAY', 'DUE_TOMORROW', 'OVERDUE') AND reminder_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  due_today_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  due_tomorrow_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  overdue_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
