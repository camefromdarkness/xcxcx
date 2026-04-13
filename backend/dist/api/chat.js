"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const auth_1 = require("../middleware/auth");
const User_1 = __importDefault(require("../models/User"));
const Conversation_1 = __importDefault(require("../models/Conversation"));
const Message_1 = __importDefault(require("../models/Message"));
const SessionService_1 = require("../services/SessionService");
const ws_1 = require("../realtime/ws");
const router = express_1.default.Router();
function buildDmKey(a, b) {
    const [x, y] = [a, b].sort();
    return `${x}:${y}`;
}
async function ensureConversationAccess(conversationId, userId) {
    if (!mongoose_1.default.isValidObjectId(conversationId))
        return null;
    const conversation = await Conversation_1.default.findOne({
        _id: conversationId,
        deletedAt: null,
        participants: userId,
    });
    return conversation;
}
// POST /api/chat/conversations/dm - создать/получить диалог 1-на-1
router.post("/conversations/dm", auth_1.authenticateToken, async (req, res) => {
    try {
        const { otherUserId } = req.body;
        const userId = req.user.userId;
        if (!otherUserId || typeof otherUserId !== "string") {
            return res.status(400).json({ error: "otherUserId is required" });
        }
        if (otherUserId === userId) {
            return res.status(400).json({ error: "Cannot create DM with yourself" });
        }
        const otherUser = await User_1.default.findOne({ _id: otherUserId, deletedAt: null }).select("_id");
        if (!otherUser) {
            return res.status(404).json({ error: "User not found" });
        }
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        const dmKey = buildDmKey(userId, otherUserId);
        let conversation = await Conversation_1.default.findOne({ dmKey, deletedAt: null });
        if (!conversation) {
            conversation = new Conversation_1.default({
                participants: [userId, otherUserId],
                dmKey,
            });
            await conversation.save();
        }
        const populated = await conversation.populate("participants", "email nickname userType");
        return res.status(200).json({ conversation: populated });
    }
    catch (error) {
        console.error("Create DM conversation error:", error);
        return res.status(500).json({ error: "Failed to create conversation" });
    }
});
// GET /api/chat/conversations - список диалогов пользователя
router.get("/conversations", auth_1.authenticateToken, async (req, res) => {
    try {
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        const conversations = await Conversation_1.default.find({
            deletedAt: null,
            participants: req.user.userId,
        })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .populate("participants", "email nickname userType");
        return res.status(200).json({ conversations });
    }
    catch (error) {
        console.error("List conversations error:", error);
        return res.status(500).json({ error: "Failed to list conversations" });
    }
});
// GET /api/chat/conversations/:conversationId/messages - получить сообщения
router.get("/conversations/:conversationId/messages", auth_1.authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const conversation = await ensureConversationAccess(conversationId, req.user.userId);
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        const messages = await Message_1.default.find({
            conversationId: conversation._id,
            deletedAt: null,
        })
            .sort({ createdAt: 1 })
            .populate("senderId", "email nickname userType");
        return res.status(200).json({ messages });
    }
    catch (error) {
        console.error("List messages error:", error);
        return res.status(500).json({ error: "Failed to list messages" });
    }
});
// POST /api/chat/conversations/:conversationId/messages - отправить сообщение
router.post("/conversations/:conversationId/messages", auth_1.authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { text } = req.body;
        if (!text || typeof text !== "string" || !text.trim()) {
            return res.status(400).json({ error: "text is required" });
        }
        const conversation = await ensureConversationAccess(conversationId, req.user.userId);
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        const message = new Message_1.default({
            conversationId: conversation._id,
            senderId: req.user.userId,
            text: text.trim(),
        });
        await message.save();
        conversation.lastMessageId = message._id;
        conversation.lastMessageText = message.text;
        conversation.lastMessageAt = message.createdAt;
        conversation.lastMessageSenderId = message.senderId;
        await conversation.save();
        const populated = await message.populate("senderId", "email nickname userType");
        (0, ws_1.publishToConversation)(conversation._id.toString(), {
            type: "message_created",
            conversationId: conversation._id.toString(),
            message: populated.toObject(),
            conversation: {
                _id: conversation._id,
                lastMessageId: conversation.lastMessageId,
                lastMessageText: conversation.lastMessageText,
                lastMessageAt: conversation.lastMessageAt,
                lastMessageSenderId: conversation.lastMessageSenderId,
                updatedAt: conversation.updatedAt,
            },
        });
        return res.status(201).json({ message: populated });
    }
    catch (error) {
        console.error("Send message error:", error);
        return res.status(500).json({ error: "Failed to send message" });
    }
});
// PUT /api/chat/messages/:messageId - редактировать сообщение
router.put("/messages/:messageId", auth_1.authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { text } = req.body;
        if (!text || typeof text !== "string" || !text.trim()) {
            return res.status(400).json({ error: "text is required" });
        }
        const message = await Message_1.default.findOne({ _id: messageId, deletedAt: null });
        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }
        if (message.senderId.toString() !== req.user.userId) {
            return res.status(403).json({ error: "You can only edit your own messages" });
        }
        const conversation = await ensureConversationAccess(message.conversationId.toString(), req.user.userId);
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        message.text = text.trim();
        await message.save();
        if (conversation.lastMessageId?.toString() === message._id.toString()) {
            conversation.lastMessageText = message.text;
            conversation.lastMessageAt = message.updatedAt;
            await conversation.save();
        }
        const populated = await message.populate("senderId", "email nickname userType");
        (0, ws_1.publishToConversation)(conversation._id.toString(), {
            type: "message_updated",
            conversationId: conversation._id.toString(),
            message: populated.toObject(),
            conversation: {
                _id: conversation._id,
                lastMessageId: conversation.lastMessageId,
                lastMessageText: conversation.lastMessageText,
                lastMessageAt: conversation.lastMessageAt,
                lastMessageSenderId: conversation.lastMessageSenderId,
                updatedAt: conversation.updatedAt,
            },
        });
        return res.status(200).json({ message: populated });
    }
    catch (error) {
        console.error("Edit message error:", error);
        return res.status(500).json({ error: "Failed to edit message" });
    }
});
// DELETE /api/chat/messages/:messageId - удалить (soft) сообщение
router.delete("/messages/:messageId", auth_1.authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message_1.default.findOne({ _id: messageId, deletedAt: null });
        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }
        if (message.senderId.toString() !== req.user.userId) {
            return res.status(403).json({ error: "You can only delete your own messages" });
        }
        const conversation = await ensureConversationAccess(message.conversationId.toString(), req.user.userId);
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        await SessionService_1.SessionService.updateSessionActivity(req.user.sessionId);
        message.deletedAt = new Date();
        await message.save();
        if (conversation.lastMessageId?.toString() === message._id.toString()) {
            const prev = await Message_1.default.findOne({
                conversationId: conversation._id,
                deletedAt: null,
                _id: { $ne: message._id },
            }).sort({ createdAt: -1 });
            conversation.lastMessageId = prev?._id ?? null;
            conversation.lastMessageText = prev?.text ?? "";
            conversation.lastMessageAt = prev?.createdAt ?? null;
            conversation.lastMessageSenderId = prev?.senderId ?? null;
            await conversation.save();
        }
        (0, ws_1.publishToConversation)(conversation._id.toString(), {
            type: "message_deleted",
            conversationId: conversation._id.toString(),
            messageId: message._id.toString(),
            conversation: {
                _id: conversation._id,
                lastMessageId: conversation.lastMessageId,
                lastMessageText: conversation.lastMessageText,
                lastMessageAt: conversation.lastMessageAt,
                lastMessageSenderId: conversation.lastMessageSenderId,
                updatedAt: conversation.updatedAt,
            },
        });
        return res.status(200).json({ message: "Message deleted (soft)" });
    }
    catch (error) {
        console.error("Delete message error:", error);
        return res.status(500).json({ error: "Failed to delete message" });
    }
});
exports.default = router;
