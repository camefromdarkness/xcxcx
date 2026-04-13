import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Forum from './Forum';
import Chat from './Chat';

const API_URL = 'http://localhost:3000/api/auth';

const Dashboard = () => {
  const { user, logout, refreshMe } = useAuth();
  const [currentView, setCurrentView] = useState('forum');
  const [startDmUserId, setStartDmUserId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [actionSessionId, setActionSessionId] = useState('');
  const [logoutOthersLoading, setLogoutOthersLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    nickname: '',
    bio: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    setProfileForm({
      nickname: user?.nickname || '',
      bio: user?.bio || ''
    });
  }, [user]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    setSessionsError('');

    try {
      const response = await fetch(`${API_URL}/sessions`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Не удалось загрузить сессии');
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Session fetch error:', error);
      setSessionsError(error.message || 'Не удалось загрузить сессии');
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'profile' && user) {
      loadSessions();
    }
  }, [currentView, user]);

  const updateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    try {
      const response = await fetch(`${API_URL}/me`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nickname: profileForm.nickname,
          bio: profileForm.bio
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось обновить профиль');
      await refreshMe();
    } catch (error) {
      setProfileError(error.message || 'Ошибка');
    } finally {
      setProfileSaving(false);
    }
  };

  const disableSession = async (sessionId) => {
    setActionSessionId(sessionId);
    setSessionsError('');

    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось отключить сессию');
      }

      if (data.deletedCurrentSession) {
        await logout();
        return;
      }

      setSessions(prev => prev.filter(session => session.id !== sessionId));
    } catch (error) {
      console.error('Disable session error:', error);
      setSessionsError(error.message || 'Не удалось отключить сессию');
    } finally {
      setActionSessionId('');
    }
  };

  const disableOtherSessions = async () => {
    setLogoutOthersLoading(true);
    setSessionsError('');

    try {
      const response = await fetch(`${API_URL}/sessions/logout-other`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось отключить другие сессии');
      }

      await loadSessions();
    } catch (error) {
      console.error('Disable other sessions error:', error);
      setSessionsError(error.message || 'Не удалось отключить другие сессии');
    } finally {
      setLogoutOthersLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="navbar">
        <h1 className="logo">Форум</h1>
        <div className="nav-links">
          <button
            onClick={() => setCurrentView('forum')}
            className={currentView === 'forum' ? 'nav-btn active' : 'nav-btn'}
          >
            Форум
          </button>
          <button
            onClick={() => setCurrentView('chat')}
            className={currentView === 'chat' ? 'nav-btn active' : 'nav-btn'}
          >
            Сообщения
          </button>
          <button
            onClick={() => setCurrentView('profile')}
            className={currentView === 'profile' ? 'nav-btn active' : 'nav-btn'}
          >
            Профиль
          </button>
          <button onClick={logout} className="logout-button">
            Выйти
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {currentView === 'forum' ? (
          <Forum
            onStartChat={(otherUserId) => {
              setStartDmUserId(otherUserId);
              setCurrentView('chat');
            }}
          />
        ) : currentView === 'chat' ? (
          <Chat
            startDmUserId={startDmUserId}
            onDmStarted={() => setStartDmUserId('')}
          />
        ) : (
          <div className="profile-section">
            <h2>Мой профиль</h2>
            <div className="user-info">
              <p><strong>Ник:</strong> {user?.nickname || '—'}</p>
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>ID:</strong> {user?.id}</p>
            </div>

            <div className="sessions-section" style={{ marginBottom: '1rem' }}>
              <div className="sessions-header">
                <h3>Редактировать профиль</h3>
              </div>
              {profileError && <div className="error-message">{profileError}</div>}
              <form onSubmit={updateProfile}>
                <div className="form-group">
                  <label>Никнейм</label>
                  <input
                    value={profileForm.nickname}
                    onChange={(e) => setProfileForm((p) => ({ ...p, nickname: e.target.value }))}
                    placeholder="nickname"
                  />
                </div>
                <div className="form-group">
                  <label>О себе</label>
                  <input
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                    placeholder="bio"
                  />
                </div>
                <button type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </form>
            </div>

            <div className="sessions-section">
              <div className="sessions-header">
                <h3>Активные сессии</h3>
                <div className="sessions-actions">
                  <button onClick={loadSessions} className="nav-btn" disabled={sessionsLoading}>
                    Обновить
                  </button>
                  <button
                    onClick={disableOtherSessions}
                    className="logout-button"
                    disabled={logoutOthersLoading || sessionsLoading}
                  >
                    {logoutOthersLoading ? 'Отключаем...' : 'Отключить остальные'}
                  </button>
                </div>
              </div>

              {sessionsError && <div className="error-message">{sessionsError}</div>}

              {sessionsLoading ? (
                <p className="session-loading">Загрузка сессий...</p>
              ) : sessions.length === 0 ? (
                <p className="session-loading">Активные сессии не найдены</p>
              ) : (
                <div className="sessions-list">
                  {sessions.map((session) => (
                    <div key={session.id} className="session-card">
                      <div className="session-main">
                        <p>
                          <strong>Устройство:</strong> {session.userAgent || 'Неизвестно'}
                        </p>
                        <p>
                          <strong>IP:</strong> {session.ipAddress || 'Неизвестно'}
                        </p>
                        <p>
                          <strong>Последняя активность:</strong>{' '}
                          {new Date(session.lastActivityAt).toLocaleString('ru-RU')}
                        </p>
                        {session.isCurrentSession && (
                          <span className="current-badge">Текущая сессия</span>
                        )}
                      </div>

                      <button
                        className="logout-button session-disable-btn"
                        onClick={() => disableSession(session.id)}
                        disabled={actionSessionId === session.id}
                      >
                        {actionSessionId === session.id ? 'Отключаем...' : 'Отключить'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
