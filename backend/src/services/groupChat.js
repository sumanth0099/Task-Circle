import { WebSocketServer } from 'ws';
import { pool } from '../db/pool.js';

// Map: circleId (string) -> Set of { ws, userId, userName, avatarUrl }
const circleRooms = new Map();

/**
 * Attach a WebSocket server to the existing HTTP server.
 * Clients connect to: ws://host/ws/circles/:circleId
 * Auth is validated via the session cookie (Passport populates req.user).
 */
export function initGroupChat(httpServer, sessionParser) {
  const wss = new WebSocketServer({ noServer: true });

  // Upgrade only for paths matching /ws/circles/:circleId
  httpServer.on('upgrade', (req, socket, head) => {
    const match = req.url?.match(/^\/ws\/circles\/(\d+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    const circleId = match[1];

    // Run the session parser so req.session / req.user are populated
    sessionParser(req, {}, async () => {
      const user = req.user;
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify active membership in the circle
      try {
        const result = await pool.query(
          `SELECT 1 FROM memberships
           WHERE circle_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
          [circleId, user.id]
        );
        if (!result.rowCount) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
      } catch {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, { circleId, user });
      });
    });
  });

  wss.on('connection', async (ws, _req, { circleId, user }) => {
    // Add to room
    if (!circleRooms.has(circleId)) {
      circleRooms.set(circleId, new Set());
    }
    const room = circleRooms.get(circleId);
    const client = { ws, userId: user.id, userName: user.name, avatarUrl: user.avatar_url };
    room.add(client);

    // Send last 50 messages as history
    try {
      const history = await pool.query(
        `SELECT cm.id, cm.content, cm.created_at,
                u.id AS user_id, u.name AS user_name, u.avatar_url
         FROM circle_messages cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.circle_id = $1
         ORDER BY cm.created_at ASC
         LIMIT 50`,
        [circleId]
      );
      safeSend(ws, { type: 'history', messages: history.rows });
    } catch (err) {
      console.error('[WS] Failed to load history:', err.message);
    }

    // Broadcast "user joined" presence
    broadcastToRoom(room, {
      type: 'presence',
      event: 'joined',
      userId: user.id,
      userName: user.name,
    }, ws);

    ws.on('message', async (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      if (data.type === 'message') {
        const content = (data.content || '').trim();
        if (!content || content.length > 2000) return;

        let saved;
        try {
          const result = await pool.query(
            `INSERT INTO circle_messages (circle_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING id, content, created_at`,
            [circleId, user.id, content]
          );
          saved = result.rows[0];
        } catch (err) {
          console.error('[WS] Failed to save message:', err.message);
          return;
        }

        // Broadcast to all (including sender) so everyone sees it instantly
        broadcastToRoom(room, {
          type: 'message',
          id: saved.id,
          content: saved.content,
          created_at: saved.created_at,
          user_id: user.id,
          user_name: user.name,
          avatar_url: user.avatar_url,
        });
      }

      if (data.type === 'typing') {
        broadcastToRoom(room, {
          type: 'typing',
          userId: user.id,
          userName: user.name,
          isTyping: Boolean(data.isTyping),
        }, ws); // exclude sender
      }
    });

    ws.on('close', () => {
      room.delete(client);
      if (room.size === 0) circleRooms.delete(circleId);

      broadcastToRoom(room, {
        type: 'presence',
        event: 'left',
        userId: user.id,
        userName: user.name,
      });
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for user ${user.id}:`, err.message);
    });
  });

  console.log('[WS] Group chat WebSocket server initialized');
}

function safeSend(ws, data) {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToRoom(room, data, excludeWs = null) {
  const payload = JSON.stringify(data);
  for (const client of room) {
    if (client.ws !== excludeWs && client.ws.readyState === 1) {
      client.ws.send(payload);
    }
  }
}
