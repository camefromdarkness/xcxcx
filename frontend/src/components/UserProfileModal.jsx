import { useEffect, useState } from 'react';
import './UserProfileModal.css';

const API_USERS = 'http://localhost:3000/api/users';

const UserProfileModal = ({ userId, onClose, onStartChat }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`${API_USERS}/${userId}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Не удалось загрузить профиль');
        setProfile(data.user);
      } catch (e) {
        setError(e.message || 'Ошибка');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (!userId) return null;

  return (
    <div className="upm-backdrop" onClick={onClose}>
      <div className="upm-card" onClick={(e) => e.stopPropagation()}>
        <div className="upm-header">
          <div className="upm-title">Профиль</div>
          <button className="upm-close" onClick={onClose}>×</button>
        </div>

        {error ? <div className="error-message">{error}</div> : null}
        {loading ? (
          <div className="upm-body">Загрузка...</div>
        ) : (
          <div className="upm-body">
            <div className="upm-row"><strong>Ник:</strong> {profile?.nickname || '—'}</div>
            <div className="upm-row"><strong>Email:</strong> {profile?.email || '—'}</div>
            <div className="upm-row"><strong>Тип:</strong> {profile?.userType || 'user'}</div>
            <div className="upm-row"><strong>О себе:</strong> {profile?.bio || '—'}</div>
            <div className="upm-row"><strong>ID:</strong> {profile?.id || userId}</div>

            {onStartChat ? (
              <button
                className="upm-action"
                onClick={() => {
                  onStartChat(userId);
                  onClose();
                }}
              >
                Написать сообщение
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;

