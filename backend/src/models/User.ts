import mongoose, { Document } from "mongoose";
import bcrypt from "bcrypt";

export interface IUser extends Document {
  email: string;
  password: string;
  nickname?: string;
  userType?: string;
  bio?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  comparePassword: (password: string) => Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
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
  },
  { timestamps: true }
);

// Хеширование пароля перед сохранением
userSchema.pre<IUser>("save", async function () {
  if (!this.isModified("password")) return;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Метод для сравнения паролей
userSchema.methods.comparePassword = async function (password: string) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model<IUser>("User", userSchema);

export default User;
