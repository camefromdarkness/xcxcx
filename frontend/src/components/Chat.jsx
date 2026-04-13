import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Chat.css';

const API_CHAT = 'http://localhost:3000/api/chat';
const API_USERS = 'http://localhost:3000/api/users';

const Chat = ({ startDmUserId, onDmStarted }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingText, setEditingText] = useState('');
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState('');
  const [openMenuMessageId, setOpenMenuMessageId] = useState('');

  const messagesRef = useRef(null);
  const lastMessagesFingerprintRef = useRef('');
  const lastConversationsFingerprintRef = useRef('');

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const wsRef = useRef(null);
  const wsSubscribedConversationIdRef = useRef('');
  const sendingRef = useRef(false);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  const connectWs = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const ws = new WebSocket(`ws://localhost:3000/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (selectedConversationId) {
          ws.send(JSON.stringify({ type: 'subscribe', conversationId: selectedConversationId }));
          wsSubscribedConversationIdRef.current = selectedConversationId;
        }
      };

      ws.onmessage = (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (!data || typeof data !== 'object') return;

        if (data.type === 'message_created') {
          if (data.conversationId === selectedConversationId && data.message) {
            setMessages((prev) => {
              if (prev.some((m) => m._id === data.message._id)) return prev;
              return [...prev, data.message];
            });
            requestAnimationFrame(() => {
              const node = messagesRef.current;
              if (node) node.scrollTop = node.scrollHeight;
            });
          }
          if (data.conversation) {
            setConversations((prev) =>
              prev.map((c) => (c._id === data.conversation._id ? { ...c, ...data.conversation } : c))
            );
          }
        }

        if (data.type === 'message_updated') {
          if (data.conversationId === selectedConversationId && data.message) {
            setMessages((prev) => prev.map((m) => (m._id === data.message._id ? data.message : m)));
          }
          if (data.conversation) {
            setConversations((prev) =>
              prev.map((c) => (c._id === data.conversation._id ? { ...c, ...data.conversation } : c))
            );
          }
        }

        if (data.type === 'message_deleted') {
          if (data.conversationId === selectedConversationId && data.messageId) {
            setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
          }
          if (data.conversation) {
            setConversations((prev) =>
              prev.map((c) => (c._id === data.conversation._id ? { ...c, ...data.conversation } : c))
            );
          }
        }
      };

      ws.onclose = () => {
        wsSubscribedConversationIdRef.current = '';
        wsRef.current = null;
        setTimeout(() => {
          if (!document.hidden) connectWs();
        }, 1000);
      };

      ws.onerror = () => {
        // fallback остается на polling
      };

      return ws;
    } catch {
      return null;
    }
  };

  const loadConversations = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_CHAT}/conversations`, { headers: authHeaders });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Не удалось загрузить диалоги');
      const list = data.conversations || [];
      const last = list[0];
      const fingerprint = `${list.length}:${last?._id || ''}:${last?.lastMessageAt || ''}:${last?.updatedAt || ''}`;
      if (fingerprint !== lastConversationsFingerprintRef.current) {
        lastConversationsFingerprintRef.current = fingerprint;
        setConversations(list);
      }
      if (!selectedConversationId && list.length > 0) setSelectedConversationId(list[0]._id);
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_CHAT}/conversations/${conversationId}/messages`, { headers: authHeaders });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Не удалось загрузить сообщения');
      const list = data.messages || [];
      const last = list[list.length - 1];
      const fingerprint = `${list.length}:${last?._id || ''}:${last?.updatedAt || last?.createdAt || ''}`;
      if (fingerprint !== lastMessagesFingerprintRef.current) {
        lastMessagesFingerprintRef.current = fingerprint;

        const el = messagesRef.current;
        const shouldStickToBottom =
          el ? (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) : true;

        setMessages(list);

        requestAnimationFrame(() => {
          const node = messagesRef.current;
          if (node && shouldStickToBottom) node.scrollTop = node.scrollHeight;
        });
      }
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const createDm = async (otherUserId) => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_CHAT}/conversations/dm`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ otherUserId })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Не удалось создать диалог');
      const conversation = data.conversation;
      await loadConversations();
      if (conversation?._id) {
        setSelectedConversationId(conversation._id);
        await loadMessages(conversation._id);
      }
      if (onDmStarted) onDmStarted();
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!selectedConversationId) return;
    if (!text.trim()) return;
    if (sendingRef.current) return;
    sendingRef.current = true;

    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_CHAT}/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ text })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Не удалось отправить сообщение');
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
      }
      setText('');
      await loadConversations();
    } catch (e2) {
      setError(e2.message || 'Ошибка');
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  };

  const deleteMessage = async (messageId) => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_CHAT}/messages/${messageId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Не удалось удалить сообщение');
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      await loadConversations();
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const editMessage = async (messageId, nextText) => {
    if (!nextText || typeof nextText !== 'string' || !nextText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_CHAT}/messages/${messageId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ text: nextText })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Не удалось обновить сообщение');
      if (data.message) {
        setMessages((prev) => prev.map((m) => (m._id === messageId ? data.message : m)));
      }
      await loadConversations();
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    const q = searchQ.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const r = await fetch(`${API_USERS}/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Не удалось найти пользователей');
      setSearchResults(data.users || []);
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedConversationId) loadMessages(selectedConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  useEffect(() => {
    if (startDmUserId) createDm(startDmUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDmUserId]);

  useEffect(() => {
    if (!user) return;

    // WebSocket first
    connectWs();

    // polling fallback (если ws не работает)
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (document.hidden) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
      await loadConversations();
      if (selectedConversationId) await loadMessages(selectedConversationId);
    };

    tick();
    const id = setInterval(tick, 4000);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);

    return () => {
      stopped = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedConversationId]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const prev = wsSubscribedConversationIdRef.current;
    if (prev && prev !== selectedConversationId) {
      ws.send(JSON.stringify({ type: 'unsubscribe', conversationId: prev }));
      wsSubscribedConversationIdRef.current = '';
    }
    if (selectedConversationId && prev !== selectedConversationId) {
      ws.send(JSON.stringify({ type: 'subscribe', conversationId: selectedConversationId }));
      wsSubscribedConversationIdRef.current = selectedConversationId;
    }
  }, [selectedConversationId]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenMenuMessageId('');
        setConfirmDeleteMessageId('');
        setEditingMessageId('');
        setEditingText('');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const getConversationTitle = (c) => {
    const other = (c.participants || []).find((p) => (p._id || p.id) !== user?.id);
    const nick = other?.nickname?.trim();
    return nick || other?.email || other?._id || 'Диалог';
  };

  return (
    <div className="chat">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div className="chat-title">Сообщения</div>
          <button className="chat-refresh" onClick={loadConversations} disabled={loading}>
            Обновить
          </button>
        </div>

        <div className="chat-search">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Найти пользователя (ник/email)"
          />
          <button onClick={searchUsers} disabled={searchLoading}>Найти</button>
        </div>
        {searchResults.length > 0 && (
          <div className="chat-search-results">
            {searchResults
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <div key={u.id} className="chat-search-row">
                  <div className="chat-search-name">{(u.nickname || u.email || '').toString()}</div>
                  <button onClick={() => createDm(u.id)} disabled={loading}>Написать</button>
                </div>
              ))}
          </div>
        )}

        <div className="chat-conversations">
          {conversations.map((c) => (
            <button
              key={c._id}
              className={selectedConversationId === c._id ? 'chat-conv active' : 'chat-conv'}
              onClick={() => setSelectedConversationId(c._id)}
            >
              <div className="chat-conv-name">{getConversationTitle(c)}</div>
              {c.lastMessageText ? <div className="chat-conv-last">{c.lastMessageText}</div> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-main">
        {error ? <div className="error-message">{error}</div> : null}

        {!selectedConversationId ? (
          <div className="chat-empty">Выбери диалог или найди пользователя слева.</div>
        ) : (
          <>
            <div className="chat-messages" ref={messagesRef}>
              {messages.map((m) => {
                const sender = m.senderId;
                const senderName = sender?.nickname?.trim() || sender?.email || 'Пользователь';
                const isMine = (sender?._id || sender?.id || m.senderId) === user?.id;
                const isEditing = editingMessageId === m._id;
                const isMenuOpen = openMenuMessageId === m._id;
                return (
                  <div key={m._id} className={isMine ? 'chat-msg mine' : 'chat-msg other'}>
                    <div className="chat-msg-meta">
                      <span className="chat-msg-sender">{senderName}</span>
                      <span className="chat-msg-time">{new Date(m.createdAt).toLocaleString('ru-RU')}</span>
                    </div>
                    {isEditing ? (
                      <div className="chat-msg-edit">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                        />
                        <div className="chat-msg-actions">
                          <button
                            onClick={() => {
                              editMessage(m._id, editingText);
                              setEditingMessageId('');
                              setEditingText('');
                            }}
                            disabled={loading || !editingText.trim()}
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={() => {
                              setEditingMessageId('');
                              setEditingText('');
                            }}
                            disabled={loading}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="chat-msg-text-wrap">
                        <div className="chat-msg-text">{m.text}</div>
                        {isMine ? (
                          <div className="chat-msg-menu">
                            <button
                              className="chat-msg-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuMessageId((prev) => (prev === m._id ? '' : m._id));
                              }}
                              aria-label="Меню сообщения"
                              title="Меню"
                              type="button"
                            >
                              ⋯
                            </button>
                            {isMenuOpen ? (
                              <>
                                <div
                                  className="chat-msg-menu-backdrop"
                                  onClick={() => setOpenMenuMessageId('')}
                                />
                                <div className="chat-msg-menu-pop" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuMessageId('');
                                      setEditingMessageId(m._id);
                                      setEditingText(m.text || '');
                                    }}
                                    disabled={loading}
                                  >
                                    Редактировать
                                  </button>
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => {
                                      setOpenMenuMessageId('');
                                      setConfirmDeleteMessageId(m._id);
                                    }}
                                    disabled={loading}
                                  >
                                    Удалить
                                  </button>
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <form className="chat-send" onSubmit={sendMessage}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Сообщение..."
              />
              <button type="submit" disabled={loading || !text.trim()}>
                Отправить
              </button>
            </form>
          </>
        )}
      </div>

      {confirmDeleteMessageId ? (
        <div className="chat-modal-backdrop" onClick={() => setConfirmDeleteMessageId('')}>
          <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-title">Удалить сообщение?</div>
            <div className="chat-modal-actions">
              <button
                className="chat-modal-danger"
                onClick={async () => {
                  const id = confirmDeleteMessageId;
                  setConfirmDeleteMessageId('');
                  await deleteMessage(id);
                }}
                disabled={loading}
              >
                Удалить
              </button>
              <button onClick={() => setConfirmDeleteMessageId('')} disabled={loading}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Chat;
