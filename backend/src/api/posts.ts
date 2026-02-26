import express from "express";
import Post from "../models/Post";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = express.Router();

// Получить все посты
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).populate("author", "email");
    return res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Получить пост по ID
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("author", "email");
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(200).json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    return res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Создать новый пост (защищённый роут)
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const user = req.user;
    const newPost = new Post({
      title,
      content,
      author: user.userId,
      authorEmail: user.email,
    });

    await newPost.save();
    return res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);
    return res.status(500).json({ error: "Failed to create post" });
  }
});

// Обновить пост (только автор)
router.put("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { title, content } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Проверяем, что пост редактирует его автор
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: "You can only edit your own posts" });
    }

    if (title) post.title = title;
    if (content) post.content = content;

    await post.save();
    return res.status(200).json(post);
  } catch (error) {
    console.error("Error updating post:", error);
    return res.status(500).json({ error: "Failed to update post" });
  }
});

// Удалить пост (только автор)
router.delete("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Проверяем, что пост удаляет его автор
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }

    await Post.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    return res.status(500).json({ error: "Failed to delete post" });
  }
});

export default router;
