"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userSchema = new mongoose_1.default.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    nickname: {
        type: String,
        trim: true,
        minlength: 2,
        maxlength: 32,
        default: "",
    },
    userType: {
        type: String,
        trim: true,
        maxlength: 32,
        default: "user",
    },
    bio: {
        type: String,
        trim: true,
        maxlength: 280,
        default: "",
    },
    deletedAt: {
        type: Date,
        default: null,
        index: true,
    },
}, { timestamps: true });
// Хеширование пароля перед сохранением
userSchema.pre("save", async function () {
    if (!this.isModified("password"))
        return;
    try {
        const salt = await bcrypt_1.default.genSalt(10);
        this.password = await bcrypt_1.default.hash(this.password, salt);
    }
    catch (error) {
        throw error;
    }
});
// Метод для сравнения паролей
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt_1.default.compare(password, this.password);
};
const User = mongoose_1.default.model("User", userSchema);
exports.default = User;
