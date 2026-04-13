import express from "express";
import User from "../models/User";

const router = express.Router();

// GET /api/users/search?q=... - поиск пользователей (публичные поля)
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? "";
    if (!q) return res.status(200).json({ users: [] });

    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");

    const users = await User.find({
      deletedAt: null,
      $or: [{ nickname: rx }, { email: rx }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("email nickname userType bio createdAt");

    return res.status(200).json({
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        nickname: u.nickname,
        userType: u.userType,
        bio: u.bio,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("User search error:", error);
    return res.status(500).json({ error: "Failed to search users" });
  }
});

// GET /api/users/:userId - публичный профиль пользователя
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ _id: userId, deletedAt: null }).select(
      "email nickname userType bio createdAt"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        nickname: user.nickname,
        userType: user.userType,
        bio: user.bio,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    return res.status(500).json({ error: "Failed to get user profile" });
  }
});

export default router;
