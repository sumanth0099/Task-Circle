import { useState, useRef, useEffect } from 'react';
import { apiRequest } from '../api/client';

const SUGGESTIONS = [
  'What tasks do I have today?',
  'Which tasks are overdue?',
  'How many tasks have I completed?',
  'What circles am I in?',
];

export default function Chatbot({ externalOpen, onExternalClose }) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both internal toggle (floating button) and external open (sidebar nav click)
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (val) => {
    setInternalOpen(val);
    if (!val && onExternalClose) onExternalClose();
  };

  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 Hi! I\'m your TaskCircle Assistant. Ask me about your tasks, circles, or deadlines!' }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const sendMessage = async (text) => {
    const message = (text || input).trim();
    if (!message || sending) return;

    setInput('');
    setError('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    try {
      const data = await apiRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message || 'Failed to get response. Try again.');
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message || 'Something went wrong.'}` }]);
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: '👋 Hi! I\'m your TaskCircle Assistant. Ask me about your tasks, circles, or deadlines!' }]);
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        className="chatbot-toggle"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Toggle AI assistant"
        title="TaskCircle AI Assistant"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">🤖</div>
              <div>
                <div className="chatbot-title">TaskCircle Assistant</div>
                <div className="chatbot-subtitle">Powered by Groq · Llama 3.1</div>
              </div>
            </div>
            <button className="chatbot-clear btn-secondary btn-sm" onClick={clearChat} title="Clear chat">
              Clear
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-message ${msg.role}`}>
                <div className="chatbot-bubble">{msg.content}</div>
              </div>
            ))}

            {sending && (
              <div className="chatbot-message assistant">
                <div className="chatbot-bubble chatbot-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions (only show when just the welcome message is there) */}
          {messages.length === 1 && !sending && (
            <div className="chatbot-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="chatbot-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="chatbot-input-area">
            <input
              ref={inputRef}
              className="chatbot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your tasks..."
              disabled={sending}
              maxLength={1000}
            />
            <button
              className="chatbot-send"
              onClick={() => sendMessage()}
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              {sending ? '...' : '↑'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
