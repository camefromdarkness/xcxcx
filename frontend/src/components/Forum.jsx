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
  const [comments, setComments] = useState({});
  const [newComments, setNewComments] = useState({});
  const [showComments, setShowComments] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentData, setEditingCommentData] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { postId, commentId }

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

  const handleLikePost = async (postId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(posts.map(p => p._id === postId ? data.post : p));
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при лайке поста');
      }
    } catch (error) {
      console.error('Error liking post:', error);
      setError('Ошибка при лайке поста');
    }
  };

  const handleUnlikePost = async (postId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/posts/${postId}/like`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(posts.map(p => p._id === postId ? data.post : p));
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при снятии лайка');
      }
    } catch (error) {
      console.error('Error unliking post:', error);
      setError('Ошибка при снятии лайка');
    }
  };

  const loadComments = async (postId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/posts/${postId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(prev => ({ ...prev, [postId]: data.comments }));
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async (postId) => {
    const content = newComments[postId]?.trim();
    if (!content) return;

    try {
      const response = await fetch(`http://localhost:3000/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data.comment]
        }));
        setNewComments(prev => ({ ...prev, [postId]: '' }));
        // Обновляем счетчик комментариев
        setPosts(posts.map(p => 
          p._id === postId 
            ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
            : p
        ));
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при добавлении комментария');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Ошибка при добавлении комментария');
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    setDeleteConfirm({ postId, commentId });
  };

  const confirmDeleteComment = async () => {
    if (!deleteConfirm) return;

    const { postId, commentId } = deleteConfirm;

    try {
      const response = await fetch(`http://localhost:3000/api/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setComments(prev => ({
          ...prev,
          [postId]: prev[postId].filter(c => c._id !== commentId)
        }));
        // Обновляем счетчик комментариев
        setPosts(posts.map(p => 
          p._id === postId 
            ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) - 1) }
            : p
        ));
        setError('');
        setDeleteConfirm(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при удалении комментария');
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Ошибка при удалении комментария');
      setDeleteConfirm(null);
    }
  };

  const cancelDeleteComment = () => {
    setDeleteConfirm(null);
  };

  const handleEditComment = async (postId, commentId) => {
    if (!editingCommentData.trim()) {
      setError('Комментарий не может быть пустым');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/posts/${postId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: editingCommentData.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => ({
          ...prev,
          [postId]: prev[postId].map(c => c._id === commentId ? data.comment : c)
        }));
        setEditingCommentId(null);
        setEditingCommentData('');
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при редактировании комментария');
      }
    } catch (error) {
      console.error('Error editing comment:', error);
      setError('Ошибка при редактировании комментария');
    }
  };

  const startEditingComment = (commentId, content) => {
    setEditingCommentId(commentId);
    setEditingCommentData(content);
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentData('');
  };

  const toggleComments = (postId) => {
    const isShown = showComments[postId];
    setShowComments(prev => ({ ...prev, [postId]: !isShown }));
    if (!isShown && !comments[postId]) {
      loadComments(postId);
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
                  
                  <div className="post-stats">
                    <div className="likes-section">
                      {user && post.likes && (
                        <>
                          <button
                            onClick={() => post.likes.some(like => like._id.toString() === user.id || like.email === user.email) 
                              ? handleUnlikePost(post._id) 
                              : handleLikePost(post._id)}
                            className={`like-btn ${post.likes.some(like => like._id.toString() === user.id || like.email === user.email) ? 'liked' : ''}`}
                          >
                            <i className="fas fa-heart"></i> {post.likes.length}
                          </button>
                        </>
                      )}
                      {!user && post.likes && (
                        <span className="likes-count">
                          <i className="fas fa-heart"></i> {post.likes.length}
                        </span>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => toggleComments(post._id)}
                      className="comments-btn"
                    >
                      <i className="fas fa-comment"></i> {post.commentsCount || 0}
                    </button>
                  </div>

                  {showComments[post._id] && (
                    <div className="comments-section">
                      {user && (
                        <div className="add-comment">
                          <textarea
                            placeholder="Написать комментарий..."
                            value={newComments[post._id] || ''}
                            onChange={(e) => setNewComments(prev => ({ ...prev, [post._id]: e.target.value }))}
                            className="comment-input"
                            rows="2"
                          />
                          <button 
                            onClick={() => handleAddComment(post._id)}
                            className="btn-comment"
                            disabled={!newComments[post._id]?.trim()}
                          >
                            Отправить
                          </button>
                        </div>
                      )}
                      
                      <div className="comments-list">
                        {comments[post._id]?.length > 0 ? (
                          comments[post._id].map(comment => (
                            <div key={comment._id} className="comment-item">
                              <div className="comment-header">
                                <strong
                                  style={{ cursor: comment.author?._id ? 'pointer' : 'default', textDecoration: 'underline' }}
                                  onClick={() => {
                                    if (comment.author?._id) setOpenProfileUserId(comment.author._id);
                                  }}
                                  title={comment.author?._id ? 'Открыть профиль' : ''}
                                >
                                  {comment.author?.nickname || comment.author?.email || comment.authorEmail}
                                </strong>
                                <div className="comment-actions">
                                  <span className="comment-date">
                                    {new Date(comment.createdAt).toLocaleString('ru-RU')}
                                  </span>
                                  {user && (comment.author?._id ? user.id === comment.author._id : user.email === comment.authorEmail) && (
                                    <>
                                      <button
                                        onClick={() => startEditingComment(comment._id, comment.content)}
                                        className="btn-edit-comment"
                                        title="Редактировать комментарий"
                                      >
                                        <i className="fas fa-edit"></i>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteComment(post._id, comment._id)}
                                        className="btn-delete-comment"
                                        title="Удалить комментарий"
                                      >
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {editingCommentId === comment._id ? (
                                <div className="comment-edit-form">
                                  <textarea
                                    value={editingCommentData}
                                    onChange={(e) => setEditingCommentData(e.target.value)}
                                    className="comment-edit-input"
                                    rows="3"
                                  />
                                  <div className="comment-edit-buttons">
                                    <button
                                      onClick={() => handleEditComment(post._id, comment._id)}
                                      className="btn-save-comment"
                                      disabled={!editingCommentData.trim()}
                                    >
                                      Сохранить
                                    </button>
                                    <button
                                      onClick={cancelEditingComment}
                                      className="btn-cancel-comment"
                                    >
                                      Отмена
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="comment-content">{comment.content}</p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="no-comments">Нет комментариев</p>
                        )}
                      </div>
                    </div>
                  )}

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

      {/* Модальное окно подтверждения удаления комментария */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={cancelDeleteComment}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Удалить комментарий</h3>
            </div>
            <div className="modal-body">
              <p>Вы уверены, что хотите удалить этот комментарий? Это действие нельзя отменить.</p>
            </div>
            <div className="modal-footer">
              <button
                onClick={cancelDeleteComment}
                className="btn-cancel"
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteComment}
                className="btn-delete-confirm"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Forum;
