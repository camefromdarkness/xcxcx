import mongoose, { Schema, Document } from "mongoose";

export interface ISession extends Document {
    userId: mongoose.Types.ObjectId;
    refreshToken: string;
    userAgent: string;
    ipAddress: string;
    isActive: boolean;
    createdAt: Date;
    lastActivityAt: Date;
    expiresAt: Date;
}

const SessionSchema = new Schema<ISession>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        refreshToken: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        userAgent: {
            type: String,
            default: ""
        },
        ipAddress: {
            type: String,
            default: ""
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        lastActivityAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true
        }
    },
    { timestamps: true }
);

// Автоматически удаляет истекшие сессии
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ISession>("Session", SessionSchema);