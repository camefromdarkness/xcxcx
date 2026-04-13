"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebSocketServer = initWebSocketServer;
exports.publishToConversation = publishToConversation;
const crypto_1 = __importDefault(require("crypto"));
const TokenService_1 = require("../services/TokenService");
const Conversation_1 = __importDefault(require("../models/Conversation"));
const clients = new Set();
let isAttached = false;
function getTokenFromRequestUrl(url) {
    try {
        const u = new URL(url, "http://localhost");
        return u.searchParams.get("token") || "";
    }
    catch {
        return "";
    }
}
function writeHttpError(socket, status) {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`, () => {
        socket.destroy();
    });
}
function acceptKey(secWebSocketKey) {
    const magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    return crypto_1.default.createHash("sha1").update(secWebSocketKey + magic).digest("base64");
}
function sendFrame(socket, text) {
    const payload = Buffer.from(text, "utf8");
    const len = payload.length;
    let header;
    if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81; // FIN + text
        header[1] = len; // no mask
    }
    else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    }
    else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    socket.write(Buffer.concat([header, payload]));
}
function parseFrames(state, onText) {
    while (true) {
        const buf = state.buffer;
        if (buf.length < 2)
            return;
        const b0 = buf[0];
        const b1 = buf[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;
        if (!fin) {
            // для простоты не поддерживаем фрагментацию
            return;
        }
        if (payloadLen === 126) {
            if (buf.length < offset + 2)
                return;
            payloadLen = buf.readUInt16BE(offset);
            offset += 2;
        }
        else if (payloadLen === 127) {
            if (buf.length < offset + 8)
                return;
            const big = buf.readBigUInt64BE(offset);
            if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
                return;
            }
            payloadLen = Number(big);
            offset += 8;
        }
        let maskKey = null;
        if (masked) {
            if (buf.length < offset + 4)
                return;
            maskKey = buf.subarray(offset, offset + 4);
            offset += 4;
        }
        if (buf.length < offset + payloadLen)
            return;
        const payload = buf.subarray(offset, offset + payloadLen);
        state.buffer = buf.subarray(offset + payloadLen);
        if (opcode === 0x8) {
            state.socket.end();
            return;
        }
        if (opcode !== 0x1) {
            continue;
        }
        let decoded = payload;
        if (masked && maskKey) {
            const out = Buffer.alloc(payload.length);
            for (let i = 0; i < payload.length; i++) {
                out[i] = payload[i] ^ maskKey[i % 4];
            }
            decoded = out;
        }
        onText(decoded.toString("utf8"));
    }
}
function safeSend(state, event) {
    try {
        sendFrame(state.socket, JSON.stringify(event));
    }
    catch {
        // ignore
    }
}
function initWebSocketServer(server) {
    if (isAttached)
        return;
    isAttached = true;
    server.on("upgrade", async (req, socket, head) => {
        try {
            const { url = "" } = req;
            const u = new URL(url, "http://localhost");
            if (u.pathname !== "/ws") {
                writeHttpError(socket, "404 Not Found");
                return;
            }
            const token = getTokenFromRequestUrl(url);
            if (!token) {
                writeHttpError(socket, "401 Unauthorized");
                return;
            }
            let payload;
            try {
                const decoded = TokenService_1.TokenService.verifyAccessToken(token);
                payload = { userId: decoded.userId, sessionId: decoded.sessionId };
            }
            catch {
                writeHttpError(socket, "403 Forbidden");
                return;
            }
            const secKey = req.headers["sec-websocket-key"];
            if (!secKey || typeof secKey !== "string") {
                writeHttpError(socket, "400 Bad Request");
                return;
            }
            const accept = acceptKey(secKey);
            socket.write("HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                `Sec-WebSocket-Accept: ${accept}\r\n` +
                "\r\n");
            const state = {
                socket,
                userId: payload.userId,
                sessionId: payload.sessionId,
                subscribedConversations: new Set(),
                buffer: Buffer.alloc(0),
            };
            clients.add(state);
            if (head && head.length) {
                state.buffer = Buffer.concat([state.buffer, head]);
            }
            socket.on("data", (chunk) => {
                state.buffer = Buffer.concat([state.buffer, chunk]);
                parseFrames(state, async (text) => {
                    let msg;
                    try {
                        msg = JSON.parse(text);
                    }
                    catch {
                        safeSend(state, { type: "error", error: "Invalid JSON" });
                        return;
                    }
                    const type = msg?.type;
                    const conversationId = msg?.conversationId;
                    if (type === "subscribe") {
                        if (!conversationId || typeof conversationId !== "string") {
                            safeSend(state, { type: "error", error: "conversationId is required" });
                            return;
                        }
                        const conversation = await Conversation_1.default.findOne({
                            _id: conversationId,
                            deletedAt: null,
                            participants: state.userId,
                        }).select("_id");
                        if (!conversation) {
                            safeSend(state, { type: "error", error: "Conversation not found" });
                            return;
                        }
                        state.subscribedConversations.add(conversationId);
                        safeSend(state, { type: "subscribed", conversationId });
                        return;
                    }
                    if (type === "unsubscribe") {
                        if (!conversationId || typeof conversationId !== "string") {
                            safeSend(state, { type: "error", error: "conversationId is required" });
                            return;
                        }
                        state.subscribedConversations.delete(conversationId);
                        safeSend(state, { type: "unsubscribed", conversationId });
                        return;
                    }
                    safeSend(state, { type: "error", error: "Unknown message type" });
                });
            });
            const cleanup = () => clients.delete(state);
            socket.on("end", cleanup);
            socket.on("close", cleanup);
            socket.on("error", cleanup);
        }
        catch {
            socket.destroy();
        }
    });
}
function publishToConversation(conversationId, event) {
    for (const c of clients) {
        if (!c.subscribedConversations.has(conversationId))
            continue;
        safeSend(c, event);
    }
}
