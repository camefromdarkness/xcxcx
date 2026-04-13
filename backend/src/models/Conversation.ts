import mongoose, { Schema, Document } from "mongoose";

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  dmKey: string;
  lastMessageId?: mongoose.Types.ObjectId | null;
  lastMessageText: string;
  lastMessageAt?: Date | null;
  lastMessageSenderId?: mongoose.Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
    ],
    dmKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      index: true,
    },
    lastMessageText: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastMessageSenderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1, deletedAt: 1 });

export default mongoose.model<IConversation>("Conversation", ConversationSchema);

