import express from "express";
import mongoose from "mongoose";
import Post from "../models/Post";
import Comment from "../models/Comment";
import User from "../models/User";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { SessionService } from "../services/SessionService";

const router = express.Router();

// GET /api/posts - получить все посты
router.get("/", async (req, res) => {
    try {
        const posts = await Post.find({ deletedAt: null })
            .populate("author", "email nickname userType")
            .populate("likes", "email nickname")
            .sort({ createdAt: -1 });
        
        // Добавляем количество комментариев к каждому посту
        const postsWithComments = await Promise.all(
            posts.map(async (post) => {
                const commentsCount = await Comment.countDocuments({ post: post._id, deletedAt: null });
                return {
                    ...post.toObject(),
                    commentsCount
                };
            })
        );
        
        return res.status(200).json({ posts: postsWithComments });
    } catch (error) {
        console.error("Get posts error:", error);
        return res.status(500).json({ error: "Failed to get posts" });
    }
});

// GET /api/posts/:id - получить один пост
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findOne({ _id: id, deletedAt: null }).populate("author", "email nickname userType");
        
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }
        
        return res.status(200).json({ post });
    } catch (error) {
        console.error("Get post error:", error);
        return res.status(500).json({ error: "Failed to get post" });
    }
});

// POST /api/posts - создать новый пост
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { title, content } = req.body;
        const userId = req.user!.userId;
        const userEmail = req.user!.email;

        if (!title || !content) {
            return res.status(400).json({ error: "Title and content are required" });
        }

        // Обновляем активность сессии
        await SessionService.updateSessionActivity(req.user!.sessionId);

        const newPost = new Post({
            title,
            content,
            author: userId,
            authorEmail: userEmail
        });

        await newPost.save();

        // Загружаем информацию об авторе
        const populatedPost = await newPost.populate("author", "email nickname userType");

        console.log("Post created by:", userEmail);
        return res.status(201).json({
            message: "Post created successfully",
            post: populatedPost
        });
    } catch (error) {
        console.error("Create post error:", error);
        return res.status(500).json({ error: "Failed to create post" });
    }
});

// PUT /api/posts/:id - редактировать пост
router.put("/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;
        const userId = req.user!.userId;

        if (!title || !content) {
            return res.status(400).json({ error: "Title and content are required" });
        }

        const post = await Post.findOne({ _id: id, deletedAt: null });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Проверяем, что пост редактирует его автор
        if (post.author.toString() !== userId) {
            return res.status(403).json({ error: "You can only edit your own posts" });
        }

        // Обновляем активность сессии
        await SessionService.updateSessionActivity(req.user!.sessionId);

        post.title = title;
        post.content = content;
        await post.save();

        const updatedPost = await post.populate("author", "email nickname userType");

        console.log("Post updated by:", req.user!.email);
        return res.status(200).json({
            message: "Post updated successfully",
            post: updatedPost
        });
    } catch (error) {
        console.error("Update post error:", error);
        return res.status(500).json({ error: "Failed to update post" });
    }
});

// DELETE /api/posts/:id - удалить пост
router.delete("/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const post = await Post.findOne({ _id: id, deletedAt: null });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Проверяем, что пост удаляет его автор
        if (post.author.toString() !== userId) {
            return res.status(403).json({ error: "You can only delete your own posts" });
        }

        // Обновляем активность сессии
        await SessionService.updateSessionActivity(req.user!.sessionId);

        post.deletedAt = new Date();
        await post.save();

        console.log("Post deleted by:", req.user!.email);
        return res.status(200).json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error("Delete post error:", error);
        return res.status(500).json({ error: "Failed to delete post" });
    }
});

// GET /api/posts/user/:userId - получить все посты пользователя
router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const posts = await Post.find({ author: userId, deletedAt: null })
            .populate("author", "email nickname userType")
            .sort({ createdAt: -1 });

        return res.status(200).json({ posts });
    } catch (error) {
        console.error("Get user posts error:", error);
        return res.status(500).json({ error: "Failed to get user posts" });
    }
});

// POST /api/posts/:id/like - лайкнуть пост
router.post("/:id/like", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const post = await Post.findOne({ _id: id, deletedAt: null });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Проверяем, не лайкнул ли уже пользователь
        if (post.likes.some(like => like.toString() === userId)) {
            return res.status(400).json({ error: "Post already liked" });
        }

        // Обновляем активность сессии
        await SessionService.updateSessionActivity(req.user!.sessionId);

        post.likes.push(new mongoose.Types.ObjectId(userId));
        await post.save();

        const updatedPost = await Post.findById(id)
            .populate("author", "email nickname userType")
            .populate("likes", "email nickname");

        console.log("Post liked by:", req.user!.email);
        return res.status(200).json({
            message: "Post liked successfully",
            post: updatedPost
        });
    } catch (error) {
        console.error("Like post error:", error);
        return res.status(500).json({ error: "Failed to like post" });
    }
});

// DELETE /api/posts/:id/like - убрать лайк с поста
router.delete("/:id/like", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const post = await Post.findOne({ _id: id, deletedAt: null });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Проверяем, лайкнул ли пользователь
        const likeIndex = post.likes.findIndex(like => like.toString() === userId);
        if (likeIndex === -1) {
            return res.status(400).json({ error: "Post not liked" });
        }

        // Обновляем активность сессии
        await SessionService.updateSessionActivity(req.user!.sessionId);

        post.likes.splice(likeIndex, 1);
        await post.save();

        const updatedPost = await Post.findById(id)
            .populate("author", "email nickname userType")
            .populate("likes", "email nickname");

        console.log("Post unliked by:", req.user!.email);
        return res.status(200).json({
            message: "Post unliked successfully",
            post: updatedPost
        });
    } catch (error) {
        console.error("Unlike post error:", error);
        return res.status(500).json({ error: "Failed to unlike post" });
    }
});

// GET /api/posts/:id/comments - получить комментарии к посту
router.get("/:id/comments", async (req, res) => {
    try {
        const { id } = req.params;

        const post = await Post.findOne({ _id: id, deletedAt: null });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        const comments = await Comment.find({ post: new mongoose.Types.ObjectId(id), deletedAt: null })
            .populate("author", "email nickname userType")
            .sort({ createdAt: 1 });

        return res.status(200).json({ comments });
    } catch (error) {
        console.error("Get comments error:", error);
        return res.status(500).json({ error: "Failed to get comments" });
    }
});

// POST /api/posts/:id/comments - добавить комментарий к посту
router.post("/:id/comments", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user!.userId;
        const userEmail = req.user!.email;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Comment content is required" });
        }

        const post = await Post.findOne({ _id: id, deletedAt: null });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Обновляем активность сессии
        await SessionService.updateSessionActivity(req.user!.sessionId);

        const newComment = new Comment({
            content: content.trim(),
            author: new mongoose.Types.ObjectId(userId as string),
            authorEmail: userEmail,
            post: new mongoose.Types.ObjectId(id as string)
        });

        await newComment.save();

        const populatedComment = await newComment.populate("author", "email nickname userType");

        console.log("Comment added by:", userEmail);
        return res.status(201).json({
            message: "Comment added successfully",
            comment: populatedComment
        });
    } catch (error) {
        console.error("Add comment error:", error);
        return res.status(500).json({ error: "Failed to add comment" });
    }
});

// PUT /api/posts/:postId/comments/:commentId - редактировать комментарий
router.put("/:postId/comments/:commentId", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { postId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user!.userId;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Comment content is required" });
        }

        const comment = await Comment.findOne({ _id: commentId, post: new mongoose.Types.ObjectId(postId as string), deletedAt: null });
        if (!comment) {
            return res.status(404).json({ error: "Comment not found" });
        }

        // Проверяем, что комментарий редактирует его автор
        if (comment.author.toString() !== userId) {
            return res.status(403).json({ error: "You can only edit your own comments" });
        }

        // Обновляем активность сессии
        await SessionService.updateSessionActivity(req.user!.sessionId);

        comment.content = content.trim();
        await comment.save();

        const updatedComment = await comment.populate("author", "email nickname userType");

        console.log("Comment updated by:", req.user!.email);
        return res.status(200).json({
            message: "Comment updated successfully",
            comment: updatedComment
        });
    } catch (error) {
        console.error("Update comment error:", error);
        return res.status(500).json({ error: "Failed to update comment" });
    }
});

// DELETE /api/posts/:postId/comments/:commentId - удалить комментарий
router.delete("/:postId/comments/:commentId", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user!.userId;

        const comment = await Comment.findOne({ _id: commentId, post: new mongoose.Types.ObjectId(postId as string), deletedAt: null });
        if (!comment) {
            return res.status(404).json({ error: "Comment not found" });
        }

        // Проверяем, что комментарий удаляет его автор
        if (comment.author.toString() !== userId) {
            return res.status(403).json({ error: "You can only delete your own comments" });
        }

        // Обновляем активность сессии
        await SessionService.updateSessionActivity(req.user!.sessionId);

        comment.deletedAt = new Date();
        await comment.save();

        console.log("Comment deleted by:", req.user!.email);
        return res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
        console.error("Delete comment error:", error);
        return res.status(500).json({ error: "Failed to delete comment" });
    }
});

export default router;
