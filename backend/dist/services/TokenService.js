"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "your-access-secret-key";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "your-refresh-secret-key";
class TokenService {
    /**
     * Генерирует access token (короткий срок - 15 минут)
     */
    static generateAccessToken(payload, sessionId) {
        return jsonwebtoken_1.default.sign({ ...payload, sessionId }, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
    }
    /**
     * Генерирует refresh token (длинный срок - 7 дней)
     */
    static generateRefreshToken(payload, sessionId) {
        return jsonwebtoken_1.default.sign({ ...payload, sessionId }, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
    }
    /**
     * Генерирует оба токена
     */
    static generateTokenPair(userId, email, sessionId) {
        const payload = { userId, email };
        return {
            accessToken: this.generateAccessToken(payload, sessionId),
            refreshToken: this.generateRefreshToken(payload, sessionId)
        };
    }
    /**
     * Проверяет access token
     */
    static verifyAccessToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, ACCESS_TOKEN_SECRET);
        }
        catch (error) {
            throw new Error("Invalid or expired access token");
        }
    }
    /**
     * Проверяет refresh token
     */
    static verifyRefreshToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, REFRESH_TOKEN_SECRET);
        }
        catch (error) {
            throw new Error("Invalid or expired refresh token");
        }
    }
}
exports.TokenService = TokenService;
