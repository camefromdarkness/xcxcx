import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Forum.css';
import UserProfileModal from './UserProfileModal';

const Forum = ({ onStartChat }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({ title: '', content: '' });
  const [error, setError] = useState('');
  const [openProfileUserId, setOpenProfileUserId] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('Ошибка при загрузке постов');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.content.trim()) {
      setError('Заполните название и содержание');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newPost)
      });

      if (response.ok) {
        const data = await response.json();
        const createdPost = data.post;
        if (createdPost) {
          setPosts((prev) => [createdPost, ...prev]);
        }
        setNewPost({ title: '', content: '' });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при создании поста');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      setError('Ошибка при создании поста');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Вы уверены, что хотите удалить пост?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setPosts(posts.filter(p => p._id !== postId));
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при удалении поста');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      setError('Ошибка при удалении поста');
    }
  };

  const handleEditPost = async (postId) => {
    if (!editingData.title.trim() || !editingData.content.trim()) {
      setError('Заполните название и содержание');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editingData)
      });

      if (response.ok) {
        const data = await response.json();
        const updatedPost = data.post;
        if (updatedPost) {
          setPosts((prev) => prev.map(p => p._id === postId ? updatedPost : p));
        }
        setEditingId(null);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при редактировании поста');
      }
    } catch (error) {
      console.error('Error updating post:', error);
      setError('Ошибка при редактировании поста');
    }
  };

  if (loading) {
    return <div className="forum">Загрузка постов...</div>;
  }

  return (
    <div className="forum">
      <h1>Форум</h1>

      <UserProfileModal
        userId={openProfileUserId}
        onClose={() => setOpenProfileUserId('')}
        onStartChat={onStartChat}
      />

      {user && (
        <div className="create-post-section">
          <h2>Создать новый пост</h2>
          <form onSubmit={handleCreatePost}>
            <input
              type="text"
              placeholder="Название поста"
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              className="post-input"
            />
            <textarea
              placeholder="Содержание поста"
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              className="post-textarea"
              rows="5"
            />
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="btn-submit">Опубликовать</button>
          </form>
        </div>
      )}

      <div className="posts-list">
        <h2>Все посты ({posts.length})</h2>
        {posts.length === 0 ? (
          <p className="no-posts">Нет постов. Будьте первым, кто создаст пост!</p>
        ) : (
          posts.map(post => (
            <div key={post._id} className="post-item">
              {editingId === post._id ? (
                <div className="edit-form">
                  <input
                    type="text"
                    value={editingData.title}
                    onChange={(e) => setEditingData({ ...editingData, title: e.target.value })}
                    className="post-input"
                  />
                  <textarea
                    value={editingData.content}
                    onChange={(e) => setEditingData({ ...editingData, content: e.target.value })}
                    className="post-textarea"
                    rows="5"
                  />
                  <div className="edit-buttons">
                    <button onClick={() => handleEditPost(post._id)} className="btn-save">
                      Сохранить
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-cancel">
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="post-title">{post.title}</h3>
                  <p className="post-meta">
                    Автор:{' '}
                    <strong
                      style={{ cursor: post.author?._id ? 'pointer' : 'default', textDecoration: 'underline' }}
                      onClick={() => {
                        if (post.author?._id) setOpenProfileUserId(post.author._id);
                      }}
                      title={post.author?._id ? 'Открыть профиль' : ''}
                    >
                      {post.author?.nickname || post.author?.email || post.authorEmail}
                    </strong>{' '}
                    | {new Date(post.createdAt).toLocaleString('ru-RU')}
                  </p>
                  <p className="post-content">{post.content}</p>
                  {user && (post.author?._id ? user.id === post.author._id : user.email === post.authorEmail) && (
                    <div className="post-actions">
                      <button
                        onClick={() => {
                          setEditingId(post._id);
                          setEditingData({ title: post.title, content: post.content });
                        }}
                        className="btn-edit"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDeletePost(post._id)}
                        className="btn-delete"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Forum;
