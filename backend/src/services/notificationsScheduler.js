import cron from 'node-cron';
import { pool } from '../db/pool.js';

const insertReminderNotifications = async () => {
  const query = `
    WITH task_data AS (
      SELECT
        t.id AS task_id,
        t.title,
        t.due_date,
        t.assigned_to,
        CASE
          WHEN t.due_date::date = CURRENT_DATE THEN 'DUE_TODAY'
          WHEN t.due_date::date = CURRENT_DATE + INTERVAL '1 day' THEN 'DUE_TOMORROW'
          WHEN t.due_date::date < CURRENT_DATE AND t.status != 'COMPLETED' THEN 'OVERDUE'
        END AS notification_type
      FROM tasks t
      WHERE t.assigned_to IS NOT NULL
        AND t.due_date IS NOT NULL
        AND t.status != 'COMPLETED'
    )
    INSERT INTO notifications (user_id, task_id, type, message, reminder_date)
    SELECT
      td.assigned_to,
      td.task_id,
      td.notification_type,
      CASE td.notification_type
        WHEN 'DUE_TODAY' THEN CONCAT('Task due today: ', td.title)
        WHEN 'DUE_TOMORROW' THEN CONCAT('Task due tomorrow: ', td.title)
        ELSE CONCAT('Task overdue: ', td.title)
      END,
      CURRENT_DATE
    FROM task_data td
    JOIN notification_preferences np ON np.user_id = td.assigned_to
    WHERE td.notification_type IS NOT NULL
      AND (
        (td.notification_type = 'DUE_TODAY' AND np.due_today_enabled = TRUE)
        OR (td.notification_type = 'DUE_TOMORROW' AND np.due_tomorrow_enabled = TRUE)
        OR (td.notification_type = 'OVERDUE' AND np.overdue_enabled = TRUE)
      )
    ON CONFLICT DO NOTHING;
  `;

  await pool.query(query);
};

export const startNotificationScheduler = () => {
  cron.schedule('0 9,17 * * *', async () => {
    try {
      await insertReminderNotifications();
      console.log('Reminder notifications generated.');
    } catch (error) {
      console.error('Scheduler failed:', error);
    }
  }, { timezone: 'Asia/Kolkata' });
};
