import { Router } from 'express';
import { body, param } from 'express-validator';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidation } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler, AppError } from '../utils/errors.js';

const router = Router();

// GET /api/tasks/:taskId — get a single task with member progress
// For assign-all tasks (has assignment_group_id), returns all sibling tasks' statuses
router.get(
  '/:taskId',
  requireAuth,
  param('taskId').isInt(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const task = await pool.query(
      `SELECT t.*, u.name AS assignee_name, u.avatar_url AS assignee_avatar,
              cb.name AS creator_name, c.name AS circle_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN users cb ON cb.id = t.created_by
       LEFT JOIN circles c ON c.id = t.circle_id
       WHERE t.id = $1`,
      [req.params.taskId]
    );

    if (!task.rowCount) throw new AppError('Task not found', 404);

    // Verify user is a circle member
    const membership = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND circle_id = $2 AND status = 'ACTIVE'`,
      [req.user.id, task.rows[0].circle_id]
    );
    if (!membership.rowCount) throw new AppError('Circle access denied', 403);

    const taskData = task.rows[0];

    // If this task belongs to an assign-all group, fetch sibling progress
    let groupProgress = null;
    if (taskData.assignment_group_id) {
      const siblings = await pool.query(
        `SELECT t.id, t.status, t.assigned_to, u.name AS assignee_name, u.avatar_url AS assignee_avatar
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.assignment_group_id = $1
         ORDER BY u.name`,
        [taskData.assignment_group_id]
      );

      const total = siblings.rowCount;
      const completed = siblings.rows.filter(r => r.status === 'COMPLETED').length;
      const inProgress = siblings.rows.filter(r => r.status === 'IN_PROGRESS').length;
      const notStarted = siblings.rows.filter(r => r.status === 'TODO').length;

      groupProgress = {
        assignment_group_id: taskData.assignment_group_id,
        total,
        completed,
        in_progress: inProgress,
        not_started: notStarted,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        members: siblings.rows
      };
    }

    sendSuccess(res, { ...taskData, group_progress: groupProgress });
  })
);

// PATCH /api/tasks/:taskId — update a task
// ADMIN/MODERATOR: can update all fields
// MEMBER assigned to this task: can only update status
router.patch(
  '/:taskId',
  requireAuth,
  param('taskId').isInt(),
  body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'COMPLETED']),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
  body('assigned_to').optional({ nullable: true }).isInt(),
  body('due_date').optional({ nullable: true }).isISO8601(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.taskId]);
    if (!task.rowCount) throw new AppError('Task not found', 404);

    const membership = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND circle_id = $2 AND status = 'ACTIVE'`,
      [req.user.id, task.rows[0].circle_id]
    );
    if (!membership.rowCount) throw new AppError('Circle access denied', 403);

    const role = membership.rows[0].role;
    const isAdminOrMod = role === 'ADMIN' || role === 'MODERATOR';
    const isAssignee = task.rows[0].assigned_to === req.user.id;

    if (!isAdminOrMod && !isAssignee) {
      throw new AppError('Insufficient permissions to update this task', 403);
    }

    // Members can ONLY update status (not title, priority, assignee, etc.)
    if (!isAdminOrMod) {
      const allowedKeys = ['status'];
      const attemptedKeys = Object.keys(req.body);
      const forbidden = attemptedKeys.filter(k => !allowedKeys.includes(k));
      if (forbidden.length) {
        throw new AppError(`Members can only update task status, not: ${forbidden.join(', ')}`, 403);
      }
    }

    // Validate new assignee is an active circle member
    const assignedTo = req.body.assigned_to !== undefined ? req.body.assigned_to : task.rows[0].assigned_to;
    if (req.body.assigned_to !== undefined && assignedTo !== null) {
      const assigneeMembership = await pool.query(
        `SELECT 1 FROM memberships WHERE circle_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
        [task.rows[0].circle_id, assignedTo]
      );
      if (!assigneeMembership.rowCount) {
        throw new AppError('Assigned user must be an active circle member', 422);
      }
    }

    const updated = await pool.query(
      `UPDATE tasks
       SET title = $1,
           description = $2,
           status = $3,
           priority = $4,
           assigned_to = $5,
           due_date = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        isAdminOrMod ? (req.body.title || task.rows[0].title) : task.rows[0].title,
        isAdminOrMod ? (req.body.description ?? task.rows[0].description) : task.rows[0].description,
        req.body.status || task.rows[0].status,
        isAdminOrMod ? (req.body.priority || task.rows[0].priority) : task.rows[0].priority,
        isAdminOrMod ? assignedTo : task.rows[0].assigned_to,
        isAdminOrMod ? (req.body.due_date ?? task.rows[0].due_date) : task.rows[0].due_date,
        req.params.taskId
      ]
    );

    sendSuccess(res, updated.rows[0], 'Task updated');
  })
);

// DELETE /api/tasks/:taskId — delete a task (ADMIN/MODERATOR only)
router.delete(
  '/:taskId',
  requireAuth,
  param('taskId').isInt(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.taskId]);
    if (!task.rowCount) throw new AppError('Task not found', 404);

    const membership = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND circle_id = $2 AND status = 'ACTIVE'`,
      [req.user.id, task.rows[0].circle_id]
    );
    if (!membership.rowCount || !['ADMIN', 'MODERATOR'].includes(membership.rows[0].role)) {
      throw new AppError('Insufficient permissions to delete this task', 403);
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.taskId]);
    sendSuccess(res, null, 'Task deleted');
  })
);

export default router;
