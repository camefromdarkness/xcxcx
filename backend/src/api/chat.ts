import express from "express";
import mongoose from "mongoose";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import User from "../models/User";
import Conversation from "../models/Conversation";
import Message from "../models/Message";
import { SessionService } from "../services/SessionService";
import { publishToConversation } from "../realtime/ws";

const router = express.Router();

function buildDmKey(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `${x}:${y}`;
}

async function ensureConversationAccess(conversationId: string, userId: string) {
  if (!mongoose.isValidObjectId(conversationId)) return null;
  const conversation = await Conversation.findOne({
    _id: conversationId,
    deletedAt: null,
    participants: userId,
  });
  return conversation;
}

// POST /api/chat/conversations/dm - создать/получить диалог 1-на-1
router.post("/conversations/dm", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { otherUserId } = req.body as { otherUserId?: string };
    const userId = req.user!.userId;

    if (!otherUserId || typeof otherUserId !== "string") {
      return res.status(400).json({ error: "otherUserId is required" });
    }
    if (otherUserId === userId) {
      return res.status(400).json({ error: "Cannot create DM with yourself" });
    }

    const otherUser = await User.findOne({ _id: otherUserId, deletedAt: null }).select("_id");
    if (!otherUser) {
      return res.status(404).json({ error: "User not found" });
    }

    await SessionService.updateSessionActivity(req.user!.sessionId);

    const dmKey = buildDmKey(userId, otherUserId);

    let conversation = await Conversation.findOne({ dmKey, deletedAt: null });
    if (!conversation) {
      conversation = new Conversation({
        participants: [userId, otherUserId],
        dmKey,
      });
      await conversation.save();
    }

    const populated = await conversation.populate("participants", "email nickname userType");
    return res.status(200).json({ conversation: populated });
  } catch (error) {
    console.error("Create DM conversation error:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /api/chat/conversations - список диалогов пользователя
router.get("/conversations", authenticateToken, async (req: AuthRequest, res) => {
  try {
    await SessionService.updateSessionActivity(req.user!.sessionId);

    const conversations = await Conversation.find({
      deletedAt: null,
      participants: req.user!.userId,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("participants", "email nickname userType");

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

// GET /api/chat/conversations/:conversationId/messages - получить сообщения
router.get("/conversations/:conversationId/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params as { conversationId: string };
    const conversation = await ensureConversationAccess(conversationId, req.user!.userId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await SessionService.updateSessionActivity(req.user!.sessionId);

    const messages = await Message.find({
      conversationId: conversation._id,
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .populate("senderId", "email nickname userType");

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("List messages error:", error);
    return res.status(500).json({ error: "Failed to list messages" });
  }
});

// POST /api/chat/conversations/:conversationId/messages - отправить сообщение
router.post("/conversations/:conversationId/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params as { conversationId: string };
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    const conversation = await ensureConversationAccess(conversationId, req.user!.userId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await SessionService.updateSessionActivity(req.user!.sessionId);

    const message = new Message({
      conversationId: conversation._id,
      senderId: req.user!.userId,
      text: text.trim(),
    });
    await message.save();

    conversation.lastMessageId = message._id;
    conversation.lastMessageText = message.text;
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessageSenderId = message.senderId;
    await conversation.save();

    const populated = await message.populate("senderId", "email nickname userType");

    publishToConversation(conversation._id.toString(), {
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
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

// PUT /api/chat/messages/:messageId - редактировать сообщение
router.put("/messages/:messageId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params as { messageId: string };
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    const message = await Message.findOne({ _id: messageId, deletedAt: null });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (message.senderId.toString() !== req.user!.userId) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }

    const conversation = await ensureConversationAccess(message.conversationId.toString(), req.user!.userId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await SessionService.updateSessionActivity(req.user!.sessionId);

    message.text = text.trim();
    await message.save();

    if (conversation.lastMessageId?.toString() === message._id.toString()) {
      conversation.lastMessageText = message.text;
      conversation.lastMessageAt = message.updatedAt;
      await conversation.save();
    }

    const populated = await message.populate("senderId", "email nickname userType");

    publishToConversation(conversation._id.toString(), {
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
  } catch (error) {
    console.error("Edit message error:", error);
    return res.status(500).json({ error: "Failed to edit message" });
  }
});

// DELETE /api/chat/messages/:messageId - удалить (soft) сообщение
router.delete("/messages/:messageId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params as { messageId: string };

    const message = await Message.findOne({ _id: messageId, deletedAt: null });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (message.senderId.toString() !== req.user!.userId) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    const conversation = await ensureConversationAccess(message.conversationId.toString(), req.user!.userId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await SessionService.updateSessionActivity(req.user!.sessionId);

    message.deletedAt = new Date();
    await message.save();

    if (conversation.lastMessageId?.toString() === message._id.toString()) {
      const prev = await Message.findOne({
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

    publishToConversation(conversation._id.toString(), {
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
  } catch (error) {
    console.error("Delete message error:", error);
    return res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
