import express , {type Request,type Response } from "express";
import cors from "cors";

import authRouter from "./api/auth";
import postsRouter from "./api/posts";
import { connectDB } from "./db";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true}));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/posts", postsRouter);

app.get("/", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const PORT = 3000;

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();