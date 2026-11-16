import mongoose from "mongoose";

// One document per (user, project) like. Replaces the old Project.likedBy array,
// which grew without limit inside every project document.
const likeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true, // for "delete all likes of this project"
    },
  },
  { timestamps: true },
);

// Same as SQL's PRIMARY KEY (user_id, project_id): a user can like a project
// only once. A duplicate insert fails with error code 11000.
likeSchema.index({ user: 1, project: 1 }, { unique: true });

export const Like = mongoose.model("Like", likeSchema);
