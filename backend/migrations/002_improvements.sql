-- Migration 002: Add assignment_group_id for 'assign to all' task grouping
-- and additional performance indexes

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignment_group_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assignment_group_id ON tasks(assignment_group_id)
  WHERE assignment_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_tasks_circle_created ON tasks(circle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id)
  WHERE is_read = FALSE;
