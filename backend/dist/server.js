"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const auth_1 = __importDefault(require("./api/auth"));
const posts_1 = __importDefault(require("./api/posts"));
const users_1 = __importDefault(require("./api/users"));
const chat_1 = __importDefault(require("./api/chat"));
const db_1 = require("./db");
const ws_1 = require("./realtime/ws");
const app = (0, express_1.default)();
const allowedOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.has(origin))
            return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));
app.use(express_1.default.json());
app.use("/api/auth", auth_1.default);
app.use("/api/posts", posts_1.default);
app.use("/api/users", users_1.default);
app.use("/api/chat", chat_1.default);
app.get("/", (req, res) => {
    res.json({ status: "ok" });
});
const PORT = 3000;
async function startServer() {
    await (0, db_1.connectDB)();
    const server = http_1.default.createServer(app);
    (0, ws_1.initWebSocketServer)(server);
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`WebSocket listening on ws://localhost:${PORT}/ws`);
    });
}
startServer();
