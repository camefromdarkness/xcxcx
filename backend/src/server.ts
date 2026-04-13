import express , {type Request,type Response } from "express";
import cors from "cors";
import http from "http";

import authRouter from "./api/auth";
import postsRouter from "./api/posts";
import usersRouter from "./api/users";
import chatRouter from "./api/chat";
import { connectDB } from "./db";
import { initWebSocketServer } from "./realtime/ws";

const app = express();

const allowedOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/posts", postsRouter);
app.use("/api/users", usersRouter);
app.use("/api/chat", chatRouter);

app.get("/", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const PORT = 3000;

async function startServer() {
  await connectDB();
  const server = http.createServer(app);
  initWebSocketServer(server);
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket listening on ws://localhost:${PORT}/ws`);
  });
}

startServer();
