"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateRefreshToken = exports.authenticateToken = void 0;
const TokenService_1 = require("../services/TokenService");
/**
 * Middleware для проверки access token
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }
    try {
        const decoded = TokenService_1.TokenService.verifyAccessToken(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: "Invalid or expired access token" });
    }
};
exports.authenticateToken = authenticateToken;
/**
 * Middleware для проверки refresh token
 */
const authenticateRefreshToken = (req, res, next) => {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    if (!token) {
        return res.status(401).json({ error: "Refresh token required" });
    }
    try {
        const decoded = TokenService_1.TokenService.verifyRefreshToken(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: "Invalid or expired refresh token" });
    }
};
exports.authenticateRefreshToken = authenticateRefreshToken;
