import mongoose, { Document } from "mongoose";

interface IPost extends Document {
  title: string;
  content: string;
  author: mongoose.Types.ObjectId;
  authorEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new mongoose.Schema<IPost>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorEmail: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Post = mongoose.model<IPost>("Post", postSchema);

export default Post;
