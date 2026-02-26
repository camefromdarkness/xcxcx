import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = express.Router();

const JWT_SECRET = "your-secret-key"; // В продакшене использовать переменную окружения

router.post("/login", async function (req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Ищем пользователя по email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Неверный пароль или почта" });
        }

        // Проверяем пароль
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Неверный пароль или почта" });
        }

        // Создаем JWT токен
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log("User logged in:", email);
        return res.status(200).json({
            message: "Login successful",
            token,
            user: { id: user._id, email: user.email }
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Login failed" });
    }
});

router.post("/logout", async function (req, res) {
    // В stateless JWT logout происходит на клиенте (удаление токена)
    return res.status(200).json({ message: "Logged out successfully" });
});

// Защищенный роут для получения информации о пользователе
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
        const user = await User.findById(req.user.userId).select("-password");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(200).json({ user });
    } catch (error) {
        console.error("Get user error:", error);
        return res.status(500).json({ error: "Failed to get user data" });
    }
});

router.post("/register", async function (req, res) {
    try {
        const {email, password} = req.body;
        if (!email || !password) 
            return res.status(400).json({error: "Email or password missing"});
        
        // Проверяем, существует ли пользователь
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({error: "User already exists"});
        }

        console.log(email, password);
        
        // Создаем нового пользователя
        const newUser = new User({ email, password });
        await newUser.save();

        // Создаем JWT токен для нового пользователя
        const token = jwt.sign(
            { userId: newUser._id, email: newUser.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );
        
        console.log("User registered:", email);
        return res.status(201).json({
            message: "User registered successfully",
            token,
            user: { id: newUser._id, email: newUser.email }
        });    
    } catch (e) {
        console.error("Registration error:", e);
        return res.status(500).json({error: "Registration failed"});
    }
});   

export default router;