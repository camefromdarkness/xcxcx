"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const TokenService_1 = require("../services/TokenService");
const SessionService_1 = require("../services/SessionService");
const router = express_1.default.Router();
router.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const existingUser = await User_1.default.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists" });
        }
        const defaultNickname = email.split("@")[0] || "";
        const newUser = new User_1.default({ email, password, nickname: defaultNickname });
        await newUser.save();
        const session = await SessionService_1.SessionService.createSession(newUser._id.toString(), req);
        const tokens = TokenService_1.TokenService.generateTokenPair(newUser._id.toString(), newUser.email, session._id.toString());
        session.refreshToken = tokens.refreshToken;
        await session.save();
        return res.status(201).json({
            message: "User registered successfully",
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            token: tokens.accessToken,
            user: { id: newUser._id, email: newUser.email, nickname: newUser.nickname }
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({ error: "Registration failed" });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const user = await User_1.default.findOne({ email, deletedAt: null });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const session = await SessionService_1.SessionService.createSession(user._id.toString(), req);
        const tokens = TokenService_1.TokenService.generateTokenPair(user._id.toString(), user.email, session._id.toString());
        session.refreshToken = tokens.refreshToken;
        await session.save();
        return res.status(200).json({
            message: "Login successful",
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            token: tokens.accessToken,
            user: { id: user._id, email: user.email, nickname: user.nickname }
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Login failed" });
    }
});
router.post("/refresh", auth_1.authenticateRefreshToken, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const session = await SessionService_1.SessionService.getSessionByToken(refreshToken);
        if (!session) {
            return res.status(403).json({ error: "Session not found or expired" });
        }
        await SessionService_1.SessionService.updateSessionActivity(session._id.toString());
        const newAccessToken = TokenService_1.TokenService.generateAccessToken({ userId: req.user.userId, email: req.user.email }, session._id.toString());
        return res.status(200).json({ accessToken: newAccessToken, token: newAccessToken });
    }
    catch (error) {
        console.error("Refresh token error:", error);
        return res.status(500).json({ error: "Token refresh failed" });
    }
});
router.post("/logout", auth_1.authenticateToken, async (req, res) => {
    try {
        const refreshToken = req.body?.refreshToken;
        if (refreshToken) {
            await SessionService_1.SessionService.deactivateSession(refreshToken);
        }
        else if (req.user?.sessionId) {
            await SessionService_1.SessionService.deactivateSessionById(req.user.sessionId);
        }
        return res.status(200).json({ message: "Logged out successfully" });
    }
    catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ error: "Logout failed" });
    }
});
router.post("/logout-all", auth_1.authenticateToken, async (req, res) => {
    try {
        await SessionService_1.SessionService.deactivateAllUserSessions(req.user.userId);
        return res.status(200).json({ message: "Logged out from all sessions" });
    }
    catch (error) {
        console.error("Logout all error:", error);
        return res.status(500).json({ error: "Logout failed" });
    }
});
router.get("/me", auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findOne({ _id: req.user.userId, deletedAt: null }).select("-password");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        return res.status(200).json({
            user: {
                id: user._id,
                email: user.email,
                nickname: user.nickname,
                userType: user.userType,
                bio: user.bio,
                createdAt: user.createdAt
            }
        });
    }
    catch (error) {
        console.error("Get user error:", error);
        return res.status(500).json({ error: "Failed to get user data" });
    }
});
router.patch("/me", auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findOne({ _id: req.user.userId, deletedAt: null }).select("-password");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const { nickname, userType, bio } = req.body;
        if (nickname !== undefined) {
            if (typeof nickname !== "string") {
                return res.status(400).json({ error: "nickname must be a string" });
            }
            user.nickname = nickname.trim();
        }
        if (userType !== undefined) {
            if (typeof userType !== "string") {
                return res.status(400).json({ error: "userType must be a string" });
            }
            user.userType = userType.trim();
        }
        if (bio !== undefined) {
            if (typeof bio !== "string") {
                return res.status(400).json({ error: "bio must be a string" });
            }
            user.bio = bio.trim();
        }
        await user.save();
        return res.status(200).json({
            message: "Profile updated",
            user: {
                id: user._id,
                email: user.email,
                nickname: user.nickname,
                userType: user.userType,
                bio: user.bio,
                createdAt: user.createdAt,
            },
        });
    }
    catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({ error: "Failed to update profile" });
    }
});
router.delete("/me", auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findOne({ _id: req.user.userId, deletedAt: null });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        user.deletedAt = new Date();
        await user.save();
        await SessionService_1.SessionService.deactivateAllUserSessions(req.user.userId);
        return res.status(200).json({ message: "User deleted (soft)" });
    }
    catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({ error: "Failed to delete user" });
    }
});
router.get("/sessions", auth_1.authenticateToken, async (req, res) => {
    try {
        const sessions = await SessionService_1.SessionService.getUserActiveSessions(req.user.userId);
        const sessionsInfo = sessions.map((session) => ({
            id: session._id,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            lastActivityAt: session.lastActivityAt,
            createdAt: session.createdAt,
            isCurrentSession: session._id.toString() === req.user.sessionId
        }));
        return res.status(200).json({
            sessions: sessionsInfo,
            total: sessionsInfo.length
        });
    }
    catch (error) {
        console.error("Get sessions error:", error);
        return res.status(500).json({ error: "Failed to get sessions" });
    }
});
router.delete("/sessions/:sessionId", auth_1.authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await SessionService_1.SessionService.getSessionInfo(sessionId);
        if (!session || session.userId.toString() !== req.user.userId) {
            return res.status(403).json({ error: "Cannot delete this session" });
        }
        await SessionService_1.SessionService.deleteSession(sessionId);
        return res.status(200).json({
            message: "Session deleted",
            deletedCurrentSession: req.user.sessionId === sessionId
        });
    }
    catch (error) {
        console.error("Delete session error:", error);
        return res.status(500).json({ error: "Failed to delete session" });
    }
});
router.post("/sessions/logout-other", auth_1.authenticateToken, async (req, res) => {
    try {
        await SessionService_1.SessionService.deactivateOtherSessions(req.user.userId, req.user.sessionId);
        return res.status(200).json({ message: "Logged out from other sessions" });
    }
    catch (error) {
        console.error("Logout other sessions error:", error);
        return res.status(500).json({ error: "Failed to logout from other sessions" });
    }
});
exports.default = router;
