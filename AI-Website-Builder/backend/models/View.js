import mongoose from "mongoose";

// One document per (user, project) view, so each logged-in user counts once.
// Replaces the old Project.viewedBy array.
const viewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

viewSchema.index({ user: 1, project: 1 }, { unique: true });

export const View = mongoose.model("View", viewSchema);
