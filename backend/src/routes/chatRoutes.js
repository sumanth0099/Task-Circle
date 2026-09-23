import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidation } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

const router = Router();

// Strict rate limit for chatbot: 20 requests per 15 minutes per user
const chatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `chat:${req.user?.id}`,
  standardHeaders: 'draft-8',
  message: { success: false, message: 'Too many chat requests, please wait a moment.' }
});

// Build a context string about the user's current TaskCircle data
async function buildUserContext(userId) {
  const [circlesRes, tasksRes] = await Promise.all([
    pool.query(
      `SELECT c.name, c.privacy, m.role
       FROM circles c
       JOIN memberships m ON m.circle_id = c.id
       WHERE m.user_id = $1 AND m.status = 'ACTIVE'
       ORDER BY c.name`,
      [userId]
    ),
    pool.query(
      `SELECT t.title, t.status, t.priority, t.due_date, c.name AS circle_name
       FROM tasks t
       JOIN circles c ON c.id = t.circle_id
       WHERE t.assigned_to = $1
       ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
       LIMIT 50`,
      [userId]
    )
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const circles = circlesRes.rows;
  const tasks = tasksRes.rows;

  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date).toISOString().slice(0, 10) < today && t.status !== 'COMPLETED');
  const dueToday = tasks.filter(t => t.due_date && new Date(t.due_date).toISOString().slice(0, 10) === today && t.status !== 'COMPLETED');
  const dueTomorrow = tasks.filter(t => t.due_date && new Date(t.due_date).toISOString().slice(0, 10) === tomorrow && t.status !== 'COMPLETED');
  const completed = tasks.filter(t => t.status === 'COMPLETED');
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS');
  const todo = tasks.filter(t => t.status === 'TODO');

  return `
You are TaskCircle Assistant, a helpful AI assistant embedded in the TaskCircle task management application.
Answer questions about the user's circles and tasks using the REAL data provided below.
Do NOT invent tasks, circles, members, dates, or any data not present below.
If the user asks about something not in the data, say so honestly.
Keep responses concise, friendly, and actionable.
Today's date: ${today}

USER'S CIRCLES (${circles.length} total):
${circles.length ? circles.map(c => `- ${c.name} (${c.privacy}, role: ${c.role})`).join('\n') : '  No circles yet.'}

USER'S ASSIGNED TASKS (${tasks.length} total):
- TODO: ${todo.length} task(s)
- IN PROGRESS: ${inProgress.length} task(s)
- COMPLETED: ${completed.length} task(s)
- OVERDUE: ${overdue.length} task(s)
- DUE TODAY: ${dueToday.length} task(s)
- DUE TOMORROW: ${dueTomorrow.length} task(s)

TASK DETAILS:
${tasks.length ? tasks.map(t => {
  const due = t.due_date ? new Date(t.due_date).toISOString().slice(0, 10) : 'no due date';
  return `- [${t.status}] "${t.title}" | Priority: ${t.priority} | Circle: ${t.circle_name} | Due: ${due}`;
}).join('\n') : '  No tasks assigned.'}
`.trim();
}

// POST /api/chat — Groq-powered chatbot
router.post(
  '/',
  requireAuth,
  chatRateLimit,
  body('message')
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be 1-1000 characters'),
  handleValidation,
  asyncHandler(async (req, res) => {
    if (!env.groqApiKey) {
      throw new AppError('AI chatbot is not configured. Please contact the administrator.', 503);
    }

    const userMessage = req.body.message.trim();

    // Build context from real user data
    const systemPrompt = await buildUserContext(req.user.id);

    // Call Groq API
    let groqResponse;
    const modelToUse = env.groqModel;
    console.log(`[CHAT] User ${req.user.id} sending message. Model: ${modelToUse}`);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 512,
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(15000) // 15s timeout
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg = errBody?.error?.message || `Groq API error: ${response.status}`;
        console.error(`[CHAT] Groq API error (${response.status}):`, JSON.stringify(errBody));
        throw new AppError(errMsg, 502);
      }

      groqResponse = await response.json();
      console.log(`[CHAT] Groq responded successfully for user ${req.user.id}`);
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new AppError('AI response timed out. Please try again.', 504);
      }
      throw new AppError('Failed to reach AI service. Please try again later.', 502);
    }

    const reply = groqResponse?.choices?.[0]?.message?.content;
    if (!reply) throw new AppError('Unexpected AI response format.', 502);

    sendSuccess(res, { reply });
  })
);

export default router;
