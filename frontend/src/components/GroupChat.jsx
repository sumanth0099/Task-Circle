import { useState, useRef, useEffect, useCallback } from 'react';
import { apiUrl } from '../api/client';

function initials(name) {
  return name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '??';
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function GroupChat({ circleId, circleName, currentUserId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState([]); // [{userId, userName}]

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Connect WebSocket
  useEffect(() => {
    // In production the frontend & backend share the same origin, so apiUrl may be
    // empty or relative. Fall back to window.location to build the correct ws(s):// URL.
    const getWsBase = () => {
      if (apiUrl && apiUrl.startsWith('http')) {
        return apiUrl.replace(/^http/, 'ws');
      }
      // Same-origin: use the page's own host
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://${window.location.host}`;
    };

    const ws = new WebSocket(`${getWsBase()}/ws/circles/${circleId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      setError('');
    };

    ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.type === 'history') {
        setMessages(data.messages.map((m) => ({ ...m, type: 'message' })));
      } else if (data.type === 'message') {
        setMessages((prev) => [...prev, data]);
      } else if (data.type === 'typing') {
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.userId !== data.userId);
          if (data.isTyping) return [...filtered, { userId: data.userId, userName: data.userName }];
          return filtered;
        });
      } else if (data.type === 'presence') {
        // Clear typing indicator when user leaves
        if (data.event === 'left') {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
        }
      }
    };

    ws.onerror = () => {
      setError('Connection error. Please refresh.');
      setConnecting(false);
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
    };

    return () => {
      ws.close();
    };
  }, [circleId]);

  const sendTyping = useCallback((isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', isTyping }));
    }
  }, []);

  const handleInput = (e) => {
    setInput(e.target.value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(true);
    }

    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(false);
    }, 1500);
  };

  const sendMessage = () => {
    const content = input.trim();
    if (!content || !connected) return;

    wsRef.current.send(JSON.stringify({ type: 'message', content }));
    setInput('');

    // Stop typing indicator immediately after send
    clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    sendTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Focus input on mount
  useEffect(() => {
    if (connected) inputRef.current?.focus();
  }, [connected]);

  return (
    <div className="group-chat-panel" role="dialog" aria-label={`${circleName} group chat`}>
      {/* Header */}
      <div className="group-chat-header">
        <div className="group-chat-header-info">
          <div className="group-chat-avatar">💬</div>
          <div>
            <div className="group-chat-title">{circleName}</div>
            <div className="group-chat-subtitle">
              {connecting ? 'Connecting…' : connected ? '● Live chat' : '○ Disconnected'}
            </div>
          </div>
        </div>
        <button className="group-chat-close" onClick={onClose} aria-label="Close chat" title="Close">✕</button>
      </div>

      {/* Messages */}
      <div className="group-chat-messages">
        {connecting && (
          <div className="group-chat-status">Connecting to group chat…</div>
        )}
        {error && (
          <div className="group-chat-status group-chat-error">{error}</div>
        )}
        {!connecting && !error && messages.length === 0 && (
          <div className="group-chat-status">No messages yet. Say hello! 👋</div>
        )}

        {messages.map((msg, i) => {
          const isMine = Number(msg.user_id) === Number(currentUserId);
          const showAvatar = i === 0 || messages[i - 1]?.user_id !== msg.user_id;
          return (
            <div key={msg.id ?? i} className={`gc-msg ${isMine ? 'gc-msg--mine' : 'gc-msg--theirs'}`}>
              {!isMine && showAvatar && (
                <div className="gc-avatar" title={msg.user_name}>
                  {msg.avatar_url
                    ? <img src={msg.avatar_url} alt={msg.user_name} />
                    : initials(msg.user_name)
                  }
                </div>
              )}
              {!isMine && !showAvatar && <div className="gc-avatar-gap" />}

              <div className="gc-bubble-wrap">
                {!isMine && showAvatar && (
                  <div className="gc-sender">{msg.user_name}</div>
                )}
                <div className="gc-bubble">
                  <span className="gc-text">{msg.content}</span>
                  <span className="gc-time">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="gc-msg gc-msg--theirs gc-typing-row">
            <div className="gc-avatar gc-avatar--typing">✏️</div>
            <div className="gc-bubble-wrap">
              <div className="gc-bubble gc-bubble--typing">
                <span className="gc-typing-label">
                  {typingUsers.map((u) => u.userName).join(', ')}
                  {typingUsers.length === 1 ? ' is' : ' are'} typing
                </span>
                <span className="gc-dots"><span /><span /><span /></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="group-chat-input-area">
        <input
          ref={inputRef}
          className="group-chat-input"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={connected ? 'Send a message…' : 'Connecting…'}
          disabled={!connected}
          maxLength={2000}
          autoComplete="off"
        />
        <button
          className="group-chat-send"
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
