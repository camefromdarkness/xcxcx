"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = void 0;
const Session_1 = __importDefault(require("../models/Session"));
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
class SessionService {
    /**
     * Создает новую сессию
     */
    static async createSession(userId, req) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 дней
        const session = new Session_1.default({
            userId,
            // refreshToken нужен для сохранения из-за required/unique в схеме.
            // Потом его сразу заменяем на "настоящий" refresh token.
            refreshToken: crypto_1.default.randomBytes(48).toString("hex"),
            userAgent: req.headers["user-agent"] || "",
            ipAddress: this.getClientIp(req),
            isActive: true,
            expiresAt
        });
        await session.save();
        return session;
    }
    /**
     * Получает активную сессию по refresh token
     */
    static async getSessionByToken(refreshToken) {
        return Session_1.default.findOne({
            refreshToken,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
    }
    /**
     * Получает все активные сессии пользователя
     */
    static async getUserActiveSessions(userId) {
        return Session_1.default.find({
            userId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        }).sort({ lastActivityAt: -1 });
    }
    /**
     * Обновляет время последней активности сессии
     */
    static async updateSessionActivity(sessionId) {
        await Session_1.default.findByIdAndUpdate(sessionId, { lastActivityAt: new Date() }, { new: true });
    }
    /**
     * Деактивирует сессию (logout)
     */
    static async deactivateSession(refreshToken) {
        await Session_1.default.findOneAndUpdate({ refreshToken }, { isActive: false }, { new: true });
    }
    /**
     * Деактивирует сессию по ID (logout)
     */
    static async deactivateSessionById(sessionId) {
        await Session_1.default.findByIdAndUpdate(sessionId, { isActive: false }, { new: true });
    }
    /**
     * Деактивирует все сессии пользователя
     */
    static async deactivateAllUserSessions(userId) {
        await Session_1.default.updateMany({ userId }, { isActive: false });
    }
    /**
     * Деактивирует все сессии кроме текущей
     */
    static async deactivateOtherSessions(userId, currentSessionId) {
        const currentId = new mongoose_1.default.Types.ObjectId(currentSessionId);
        await Session_1.default.updateMany({ userId: new mongoose_1.default.Types.ObjectId(userId), isActive: true, _id: { $ne: currentId } }, { isActive: false });
    }
    /**
     * Удаляет сессию
     */
    static async deleteSession(sessionId) {
        await Session_1.default.findByIdAndDelete(sessionId);
    }
    /**
     * Получает информацию о сессии (без refresh token)
     */
    static async getSessionInfo(sessionId) {
        const session = await Session_1.default.findById(sessionId).select("-refreshToken");
        return session;
    }
    /**
     * Получает IP адрес клиента
     */
    static getClientIp(req) {
        return (req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.socket.remoteAddress ||
            "");
    }
}
exports.SessionService = SessionService;
