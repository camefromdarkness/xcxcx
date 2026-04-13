import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "your-access-secret-key";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "your-refresh-secret-key";

export interface TokenPayload {
    userId: string;
    email: string;
    sessionId: string;
}

export class TokenService {
    /**
     * Генерирует access token (короткий срок - 15 минут)
     */
    static generateAccessToken(payload: Omit<TokenPayload, "sessionId">, sessionId: string): string {
        return jwt.sign(
            { ...payload, sessionId },
            ACCESS_TOKEN_SECRET,
            { expiresIn: "15m" }
        );
    }

    /**
     * Генерирует refresh token (длинный срок - 7 дней)
     */
    static generateRefreshToken(payload: Omit<TokenPayload, "sessionId">, sessionId: string): string {
        return jwt.sign(
            { ...payload, sessionId },
            REFRESH_TOKEN_SECRET,
            { expiresIn: "7d" }
        );
    }

    /**
     * Генерирует оба токена
     */
    static generateTokenPair(userId: string, email: string, sessionId: string) {
        const payload = { userId, email };
        return {
            accessToken: this.generateAccessToken(payload, sessionId),
            refreshToken: this.generateRefreshToken(payload, sessionId)
        };
    }

    /**
     * Проверяет access token
     */
    static verifyAccessToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
        } catch (error) {
            throw new Error("Invalid or expired access token");
        }
    }

    /**
     * Проверяет refresh token
     */
    static verifyRefreshToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
        } catch (error) {
            throw new Error("Invalid or expired refresh token");
        }
    }
}