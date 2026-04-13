"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Post_1 = __importDefault(require("../models/Post"));
const auth_1 = require("../middleware/auth");
const SessionService_1 = require("../services/SessionService");
const router = express_1.default.Router();
// GET /api/posts - получить все посты
router.get("/", async (req, res) => {
    try {
        const posts = await Post_1.default.find({ deletedAt: null })
            .populate("author", "email nickname userType")
            .sort({ createdAt: -1 });
        return res.status(200).json({ posts });
    }
    catch (error) {
        console.error("Get posts error:", error);
        return res.status(500).json({ error: "Failed to get posts" });
    }
});
// GET /api/posts/:id - получить один пост
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post_1.default.findOne({ _id: id, deletedAt: null }).populate("author", "email nickname userType");
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }
        return res.status(200).json({ post });
    }
    catch (error) {
        console.error("Get post error:", error);
        return res.status(500).json({ error: "Failed to get post" });
    }
});
// POST /api/posts - создать новый пост
router.post("/", auth_1.authenticateToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        const userId = req.user.userId;
        const userEmail = req.user.email;
        if (!title || !content) {
            return res.status(400).json({ error: "Title and content are required" });
        }
        // Обновляем активность сессии
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        const newPost = new Post_1.default({
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
    }
    catch (error) {
        console.error("Create post error:", error);
        return res.status(500).json({ error: "Failed to create post" });
    }
});
// PUT /api/posts/:id - редактировать пост
router.put("/:id", auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;
        const userId = req.user.userId;
        if (!title || !content) {
            return res.status(400).json({ error: "Title and content are required" });
        }
        const post = await Post_1.default.findOne({ _id: id, deletedAt: null });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }
        // Проверяем, что пост редактирует его автор
        if (post.author.toString() !== userId) {
            return res.status(403).json({ error: "You can only edit your own posts" });
        }
        // Обновляем активность сессии
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        post.title = title;
        post.content = content;
        await post.save();
        const updatedPost = await post.populate("author", "email nickname userType");
        console.log("Post updated by:", req.user.email);
        return res.status(200).json({
            message: "Post updated successfully",
            post: updatedPost
        });
    }
    catch (error) {
        console.error("Update post error:", error);
        return res.status(500).json({ error: "Failed to update post" });
    }
});
// DELETE /api/posts/:id - удалить пост
router.delete("/:id", auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const post = await Post_1.default.findOne({ _id: id, deletedAt: null });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }
        // Проверяем, что пост удаляет его автор
        if (post.author.toString() !== userId) {
            return res.status(403).json({ error: "You can only delete your own posts" });
        }
        // Обновляем активность сессии
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        post.deletedAt = new Date();
        await post.save();
        console.log("Post deleted by:", req.user.email);
        return res.status(200).json({ message: "Post deleted successfully" });
    }
    catch (error) {
        console.error("Delete post error:", error);
        return res.status(500).json({ error: "Failed to delete post" });
    }
});
// GET /api/posts/user/:userId - получить все посты пользователя
router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Post_1.default.find({ author: userId, deletedAt: null })
            .populate("author", "email nickname userType")
            .sort({ createdAt: -1 });
        return res.status(200).json({ posts });
    }
    catch (error) {
        console.error("Get user posts error:", error);
        return res.status(500).json({ error: "Failed to get user posts" });
    }
});
exports.default = router;
