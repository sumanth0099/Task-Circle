import { Router } from 'express';
import { body, param } from 'express-validator';
import { pool } from '../db/pool.js';
import { requireAuth, requireCircleRole } from '../middleware/auth.js';
import { handleValidation } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { generateUniqueCircleCode } from '../services/groupCode.js';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/circles — list circles the authenticated user belongs to
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const circles = await pool.query(
    `SELECT c.id, c.name, c.description, c.code, c.privacy, c.created_at, m.role
     FROM circles c
     JOIN memberships m ON m.circle_id = c.id
     WHERE m.user_id = $1 AND m.status = 'ACTIVE'
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  sendSuccess(res, circles.rows);
}));

// POST /api/circles — create a new circle; creator becomes ADMIN
router.post(
  '/',
  requireAuth,
  body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('privacy').isIn(['PUBLIC', 'PRIVATE']).withMessage('Privacy must be PUBLIC or PRIVATE'),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  handleValidation,
  asyncHandler(async (req, res) => {
    const code = await generateUniqueCircleCode();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query(
        `INSERT INTO circles (name, description, code, privacy, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.body.name, req.body.description || null, code, req.body.privacy, req.user.id]
      );
      await client.query(
        `INSERT INTO memberships (circle_id, user_id, role, status)
         VALUES ($1, $2, 'ADMIN', 'ACTIVE')`,
        [created.rows[0].id, req.user.id]
      );
      await client.query('COMMIT');
      sendSuccess(res, { ...created.rows[0], role: 'ADMIN' }, 'Circle created', 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

// GET /api/circles/:circleId — get a single circle (must be a member)
router.get(
  '/:circleId',
  requireAuth,
  param('circleId').isInt(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const circle = await pool.query('SELECT * FROM circles WHERE id = $1', [req.params.circleId]);
    if (!circle.rowCount) throw new AppError('Circle not found', 404);

    const membership = await pool.query(
      `SELECT role FROM memberships WHERE circle_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
      [req.params.circleId, req.user.id]
    );
    if (!membership.rowCount) throw new AppError('Access denied', 403);

    sendSuccess(res, { ...circle.rows[0], role: membership.rows[0].role });
  })
);

// POST /api/circles/join — join by code (public: immediate, private: pending request)
router.post(
  '/join',
  requireAuth,
  body('code').isString().trim().isLength({ min: 8, max: 8 }).withMessage('Code must be 8 characters'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const circleResult = await pool.query('SELECT * FROM circles WHERE code = UPPER($1)', [req.body.code]);
    if (!circleResult.rowCount) throw new AppError('Invalid circle code', 404);

    const circle = circleResult.rows[0];

    // Check existing active membership
    const existingMembership = await pool.query(
      `SELECT * FROM memberships WHERE circle_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
      [circle.id, req.user.id]
    );
    if (existingMembership.rowCount) throw new AppError('Already a member of this circle', 409);

    // Check removed membership — allow rejoin
    const removedMembership = await pool.query(
      `SELECT * FROM memberships WHERE circle_id = $1 AND user_id = $2 AND status = 'REMOVED'`,
      [circle.id, req.user.id]
    );

    if (circle.privacy === 'PUBLIC') {
      if (removedMembership.rowCount) {
        await pool.query(
          `UPDATE memberships SET status = 'ACTIVE', role = 'MEMBER', updated_at = NOW()
           WHERE circle_id = $1 AND user_id = $2`,
          [circle.id, req.user.id]
        );
      } else {
        await pool.query(
          `INSERT INTO memberships (circle_id, user_id, role, status) VALUES ($1, $2, 'MEMBER', 'ACTIVE')`,
          [circle.id, req.user.id]
        );
      }
      return sendSuccess(res, { circleId: circle.id, status: 'ACTIVE' }, 'Joined circle');
    }

    // Private circle — create or reset a pending join request
    const existingRequest = await pool.query(
      `SELECT * FROM join_requests WHERE circle_id = $1 AND user_id = $2 AND status = 'PENDING'`,
      [circle.id, req.user.id]
    );
    if (existingRequest.rowCount) throw new AppError('Join request already pending', 409);

    await pool.query(
      `INSERT INTO join_requests (circle_id, user_id, status)
       VALUES ($1, $2, 'PENDING')
       ON CONFLICT (circle_id, user_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()`,
      [circle.id, req.user.id]
    );
    return sendSuccess(res, { circleId: circle.id, status: 'PENDING' }, 'Join request submitted');
  })
);

// GET /api/circles/:circleId/members — list ACTIVE members only
router.get(
  '/:circleId/members',
  requireAuth,
  param('circleId').isInt(),
  handleValidation,
  requireCircleRole(),
  asyncHandler(async (req, res) => {
    const members = await pool.query(
      `SELECT m.id, m.role, m.status, u.id AS user_id, u.name, u.email, u.avatar_url
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.circle_id = $1 AND m.status = 'ACTIVE'
       ORDER BY
         CASE m.role WHEN 'ADMIN' THEN 1 WHEN 'MODERATOR' THEN 2 ELSE 3 END,
         m.created_at`,
      [req.params.circleId]
    );
    sendSuccess(res, members.rows);
  })
);

// POST /api/circles/:circleId/members/leave — leave a circle
router.post(
  '/:circleId/members/leave',
  requireAuth,
  param('circleId').isInt(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const membership = await pool.query(
      `SELECT m.id, m.role FROM memberships m
       WHERE m.circle_id = $1 AND m.user_id = $2 AND m.status = 'ACTIVE'`,
      [req.params.circleId, req.user.id]
    );
    if (!membership.rowCount) throw new AppError('You are not a member of this circle', 404);

    // Prevent the last ADMIN from leaving
    if (membership.rows[0].role === 'ADMIN') {
      const adminCount = await pool.query(
        `SELECT COUNT(*) AS count FROM memberships
         WHERE circle_id = $1 AND role = 'ADMIN' AND status = 'ACTIVE'`,
        [req.params.circleId]
      );
      if (Number(adminCount.rows[0].count) <= 1) {
        throw new AppError('Cannot leave: you are the only admin. Transfer admin role first.', 409);
      }
    }

    await pool.query(
      `UPDATE memberships SET status = 'REMOVED', updated_at = NOW()
       WHERE circle_id = $1 AND user_id = $2`,
      [req.params.circleId, req.user.id]
    );
    sendSuccess(res, null, 'Left circle successfully');
  })
);

// PATCH /api/circles/:circleId/members/:membershipId — update a member's role
router.patch(
  '/:circleId/members/:membershipId',
  requireAuth,
  param('circleId').isInt(),
  param('membershipId').isInt(),
  handleValidation,
  requireCircleRole(['ADMIN', 'MODERATOR']),
  body('role').isIn(['ADMIN', 'MODERATOR', 'MEMBER']).withMessage('Role must be ADMIN, MODERATOR, or MEMBER'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const updated = await pool.query(
      `UPDATE memberships
       SET role = $1, updated_at = NOW()
       WHERE id = $2 AND circle_id = $3
       RETURNING id, role, user_id`,
      [req.body.role, req.params.membershipId, req.params.circleId]
    );
    if (!updated.rowCount) throw new AppError('Membership not found', 404);
    sendSuccess(res, updated.rows[0], 'Member role updated');
  })
);

// DELETE /api/circles/:circleId/members/:membershipId — remove a member
router.delete(
  '/:circleId/members/:membershipId',
  requireAuth,
  param('circleId').isInt(),
  param('membershipId').isInt(),
  handleValidation,
  requireCircleRole(['ADMIN', 'MODERATOR']),
  asyncHandler(async (req, res) => {
    const removed = await pool.query(
      `UPDATE memberships
       SET status = 'REMOVED', updated_at = NOW()
       WHERE id = $1 AND circle_id = $2
       RETURNING id`,
      [req.params.membershipId, req.params.circleId]
    );
    if (!removed.rowCount) throw new AppError('Membership not found', 404);
    sendSuccess(res, null, 'Member removed');
  })
);

// GET /api/circles/:circleId/join-requests — list pending join requests (admin/mod only)
router.get(
  '/:circleId/join-requests',
  requireAuth,
  param('circleId').isInt(),
  handleValidation,
  requireCircleRole(['ADMIN', 'MODERATOR']),
  asyncHandler(async (req, res) => {
    const requests = await pool.query(
      `SELECT jr.id, jr.status, jr.created_at, u.id AS user_id, u.name, u.email, u.avatar_url
       FROM join_requests jr
       JOIN users u ON u.id = jr.user_id
       WHERE jr.circle_id = $1 AND jr.status = 'PENDING'
       ORDER BY jr.created_at`,
      [req.params.circleId]
    );
    sendSuccess(res, requests.rows);
  })
);

// PATCH /api/circles/:circleId/join-requests/:requestId — approve or reject
router.patch(
  '/:circleId/join-requests/:requestId',
  requireAuth,
  param('circleId').isInt(),
  param('requestId').isInt(),
  handleValidation,
  requireCircleRole(['ADMIN', 'MODERATOR']),
  body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const request = await client.query(
        `UPDATE join_requests
         SET status = $1, updated_at = NOW()
         WHERE id = $2 AND circle_id = $3 AND status = 'PENDING'
         RETURNING *`,
        [req.body.status, req.params.requestId, req.params.circleId]
      );
      if (!request.rowCount) throw new AppError('Pending join request not found', 404);

      if (req.body.status === 'APPROVED') {
        await client.query(
          `INSERT INTO memberships (circle_id, user_id, role, status)
           VALUES ($1, $2, 'MEMBER', 'ACTIVE')
           ON CONFLICT (circle_id, user_id)
           DO UPDATE SET status = 'ACTIVE', role = 'MEMBER', updated_at = NOW()`,
          [req.params.circleId, request.rows[0].user_id]
        );
      }

      await client.query('COMMIT');
      sendSuccess(res, request.rows[0], `Join request ${req.body.status.toLowerCase()}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

// GET /api/circles/:circleId/tasks — list all tasks for a circle
router.get(
  '/:circleId/tasks',
  requireAuth,
  param('circleId').isInt(),
  handleValidation,
  requireCircleRole(),
  asyncHandler(async (req, res) => {
    const tasks = await pool.query(
      `SELECT t.id, t.title, t.description, t.priority, t.status,
              t.assigned_to, t.assignment_group_id, t.due_date,
              t.created_by, t.created_at, t.updated_at,
              u.name AS assignee_name, u.avatar_url AS assignee_avatar,
              cb.name AS creator_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN users cb ON cb.id = t.created_by
       WHERE t.circle_id = $1
       ORDER BY t.created_at DESC`,
      [req.params.circleId]
    );
    sendSuccess(res, tasks.rows);
  })
);

// POST /api/circles/:circleId/tasks — create a task assigned to one member
router.post(
  '/:circleId/tasks',
  requireAuth,
  param('circleId').isInt(),
  handleValidation,
  requireCircleRole(['ADMIN', 'MODERATOR']),
  body('title').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Title must be 2-200 characters'),
  body('priority').isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Priority must be LOW, MEDIUM, or HIGH'),
  body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'COMPLETED']),
  body('assigned_to').optional({ nullable: true }).isInt().withMessage('assigned_to must be an integer'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('due_date must be a valid date'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (req.body.assigned_to) {
        const assigneeMembership = await client.query(
          `SELECT 1 FROM memberships
           WHERE circle_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
          [req.params.circleId, req.body.assigned_to]
        );
        if (!assigneeMembership.rowCount) {
          throw new AppError('Assigned user must be an active circle member', 422);
        }
      }

      const created = await client.query(
        `INSERT INTO tasks (circle_id, title, description, priority, status, assigned_to, due_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          req.params.circleId,
          req.body.title,
          req.body.description || null,
          req.body.priority,
          req.body.status || 'TODO',
          req.body.assigned_to || null,
          req.body.due_date || null,
          req.user.id
        ]
      );

      if (req.body.assigned_to) {
        await client.query(
          `INSERT INTO notifications (user_id, task_id, circle_id, type, message)
           VALUES ($1, $2, $3, 'NEW_TASK', $4)`,
          [req.body.assigned_to, created.rows[0].id, req.params.circleId, `New task assigned: ${req.body.title}`]
        );
      }

      await client.query('COMMIT');
      sendSuccess(res, created.rows[0], 'Task created', 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

// POST /api/circles/:circleId/tasks/assign-all — assign a task to all active members
router.post(
  '/:circleId/tasks/assign-all',
  requireAuth,
  param('circleId').isInt(),
  handleValidation,
  requireCircleRole(['ADMIN', 'MODERATOR']),
  body('title').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Title must be 2-200 characters'),
  body('priority').isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Priority must be LOW, MEDIUM, or HIGH'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('due_date must be a valid date'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const members = await client.query(
        `SELECT user_id FROM memberships
         WHERE circle_id = $1 AND status = 'ACTIVE'`,
        [req.params.circleId]
      );

      if (!members.rowCount) {
        throw new AppError('No active members in this circle', 422);
      }

      // Generate a shared group ID so all these tasks can be viewed as a group
      const groupId = randomUUID();
      const createdTasks = [];

      for (const member of members.rows) {
        const task = await client.query(
          `INSERT INTO tasks (circle_id, title, description, priority, status, assigned_to, due_date, created_by, assignment_group_id)
           VALUES ($1, $2, $3, $4, 'TODO', $5, $6, $7, $8)
           RETURNING id, assigned_to, assignment_group_id`,
          [
            req.params.circleId,
            req.body.title,
            req.body.description || null,
            req.body.priority,
            member.user_id,
            req.body.due_date || null,
            req.user.id,
            groupId
          ]
        );
        createdTasks.push(task.rows[0]);

        await client.query(
          `INSERT INTO notifications (user_id, task_id, circle_id, type, message)
           VALUES ($1, $2, $3, 'NEW_TASK', $4)`,
          [member.user_id, task.rows[0].id, req.params.circleId, `New task assigned to all: ${req.body.title}`]
        );
      }

      await client.query('COMMIT');
      sendSuccess(res, { count: createdTasks.length, assignment_group_id: groupId }, 'Tasks assigned to all members', 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

// ─── Helper: escape a CSV cell value safely ───────────────────────────────────
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes if the value contains a comma, double-quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

function formatDate(val) {
  if (!val) return '';
  try {
    return new Date(val).toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return String(val);
  }
}

// GET /api/circles/:circleId/data/export — download a CSV report for a circle
router.get(
  '/:circleId/data/export',
  requireAuth,
  param('circleId').isInt({ min: 1 }).withMessage('circleId must be a positive integer'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const circleId = Number(req.params.circleId);
    const userId = req.user.id;

    // 1. Verify circle exists
    const circleResult = await pool.query(
      'SELECT id, name, code, privacy FROM circles WHERE id = $1',
      [circleId]
    );
    if (!circleResult.rowCount) throw new AppError('Circle not found', 404);
    const circle = circleResult.rows[0];

    // 2. Verify the requesting user is an active member
    const membershipResult = await pool.query(
      `SELECT role FROM memberships WHERE circle_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
      [circleId, userId]
    );
    if (!membershipResult.rowCount) throw new AppError('Access denied', 403);

    // 3. Fetch all tasks for this circle with assignee names
    const tasksResult = await pool.query(
      `SELECT
         t.id,
         t.title,
         t.status,
         ab.name  AS assignee_name,
         ab.id    AS assignee_id
       FROM tasks t
       LEFT JOIN users ab ON ab.id = t.assigned_to
       WHERE t.circle_id = $1
       ORDER BY t.created_at ASC`,
      [circleId]
    );
    const tasks = tasksResult.rows;

    // 4. Fetch all active members
    const membersResult = await pool.query(
      `SELECT u.id, u.name, m.role
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.circle_id = $1 AND m.status = 'ACTIVE'
       ORDER BY
         CASE m.role WHEN 'ADMIN' THEN 1 WHEN 'MODERATOR' THEN 2 ELSE 3 END,
         m.created_at`,
      [circleId]
    );
    const members = membersResult.rows;

    // 5. Calculate circle-level statistics
    const totalMembers = members.length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const todoTasks = tasks.filter(t => t.status === 'TODO').length;

    // 6. Build Circle Summary CSV
    const summaryLines = [];
    summaryLines.push(csvRow(['Circle Name', 'Total Members', 'Total Tasks', 'Completed Tasks', 'In Progress Tasks', 'To Do Tasks']));
    summaryLines.push(csvRow([
      circle.name,
      totalMembers,
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks
    ]));
    const summaryCsv = summaryLines.join('\n');

    // 7. Calculate per-member statistics and build Member Task Report CSV
    const memberLines = [];
    memberLines.push(csvRow([
      'Circle Name',
      'Member Name',
      'Tasks Assigned Count',
      'Tasks Finished Count',
      'Names of Finished Tasks'
    ]));

    for (const member of members) {
      const assigned = tasks.filter(t => t.assignee_id === member.id);
      const finished = assigned.filter(t => t.status === 'COMPLETED');
      const finishedNames = finished.map(t => t.title).join('; ');
      
      memberLines.push(csvRow([
        circle.name,
        member.name,
        assigned.length,
        finished.length,
        finishedNames
      ]));
    }
    const memberCsv = memberLines.join('\n');

    const safeName = circle.name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50);

    sendSuccess(res, {
      circleSummary: {
        filename: `circle_${safeName}_summary.csv`,
        content: summaryCsv
      },
      memberTaskReport: {
        filename: `circle_${safeName}_member_report.csv`,
        content: memberCsv
      }
    });
  })
);

export default router;
