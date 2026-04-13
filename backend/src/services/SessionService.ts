import Session, { ISession } from "../models/Session";
import { Request } from "express";
import crypto from "crypto";
import mongoose from "mongoose";

export interface SessionData {
    userId: string;
    userAgent: string;
    ipAddress: string;
}

export class SessionService {
    /**
     * Создает новую сессию
     */
    static async createSession(
        userId: string,
        req: Request
    ): Promise<ISession> {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 дней

        const session = new Session({
            userId,
            // refreshToken нужен для сохранения из-за required/unique в схеме.
            // Потом его сразу заменяем на "настоящий" refresh token.
            refreshToken: crypto.randomBytes(48).toString("hex"),
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
    static async getSessionByToken(refreshToken: string): Promise<ISession | null> {
        return Session.findOne({
            refreshToken,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
    }

    /**
     * Получает все активные сессии пользователя
     */
    static async getUserActiveSessions(userId: string): Promise<ISession[]> {
        return Session.find({
            userId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        }).sort({ lastActivityAt: -1 });
    }

    /**
     * Обновляет время последней активности сессии
     */
    static async updateSessionActivity(sessionId: string): Promise<void> {
        await Session.findByIdAndUpdate(
            sessionId,
            { lastActivityAt: new Date() },
            { new: true }
        );
    }

    /**
     * Деактивирует сессию (logout)
     */
    static async deactivateSession(refreshToken: string): Promise<void> {
        await Session.findOneAndUpdate(
            { refreshToken },
            { isActive: false },
            { new: true }
        );
    }

    /**
     * Деактивирует сессию по ID (logout)
     */
    static async deactivateSessionById(sessionId: string): Promise<void> {
        await Session.findByIdAndUpdate(
            sessionId,
            { isActive: false },
            { new: true }
        );
    }

    /**
     * Деактивирует все сессии пользователя
     */
    static async deactivateAllUserSessions(userId: string): Promise<void> {
        await Session.updateMany(
            { userId },
            { isActive: false }
        );
    }

    /**
     * Деактивирует все сессии кроме текущей
     */
    static async deactivateOtherSessions(userId: string, currentSessionId: string): Promise<void> {
        const currentId = new mongoose.Types.ObjectId(currentSessionId);
        await Session.updateMany(
            { userId: new mongoose.Types.ObjectId(userId), isActive: true, _id: { $ne: currentId } },
            { isActive: false }
        );
    }

    /**
     * Удаляет сессию
     */
    static async deleteSession(sessionId: string): Promise<void> {
        await Session.findByIdAndDelete(sessionId);
    }

    /**
     * Получает информацию о сессии (без refresh token)
     */
    static async getSessionInfo(sessionId: string) {
        const session = await Session.findById(sessionId).select("-refreshToken");
        return session;
    }

    /**
     * Получает IP адрес клиента
     */
    private static getClientIp(req: Request): string {
        return (
            (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
            req.socket.remoteAddress ||
            ""
        );
    }
}
