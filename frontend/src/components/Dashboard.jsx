import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Forum from './Forum';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState('forum');

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
          <Forum />
        ) : (
          <div className="profile-section">
            <h2>Мой профиль</h2>
            <div className="user-info">
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>ID:</strong> {user?.id}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;