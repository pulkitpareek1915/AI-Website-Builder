import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { Like } from "../models/Like.js";
import { View } from "../models/View.js";
import { withTransaction } from "../utils/tx.js";

// Returns the published community projects, sorted, with per-user like/own flags.
export async function list(req, res, next) {
  try {
    const sort = req.query.sort || "new";
    const sortMap = {
      new: { publishedAt: -1, createdAt: -1 },
      views: { views: -1, publishedAt: -1 },
      likes: { likes: -1, publishedAt: -1 },
    };
    const items = await Project.find({ published: true })
      .sort(sortMap[sort] || sortMap.new)
      .limit(60)
      .populate("user", "name");

    // One query for "which of these did I like?" instead of reading
    // a likedBy array inside every project.
    const meId = req.user?._id?.toString();
    let likedIds = new Set();
    if (meId && items.length) {
      const mine = await Like.find(
        { user: req.user._id, project: { $in: items.map((p) => p._id) } },
        { project: 1 },
      ).lean();
      likedIds = new Set(mine.map((l) => l.project.toString()));
    }

    const projects = items.map((p) => {
      const card = p.toPublicCard({ withHtml: true });
      // Is this MY project? (so the frontend can disable the like button)
      card.isOwn = Boolean(meId && p.user?._id?.toString() === meId);
      card.likedByMe = likedIds.has(p._id.toString());
      return card;
    });
    res.json({ projects });
  } catch (err) {
    next(err);
  }
}

// Fetches one published project by id, counts a new view, and returns its details.
export async function get(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ error: "Invalid id" });
    const project = await Project.findById(req.params.id).populate("user", "name");
    if (!project || !project.published)
      return res.status(404).json({ error: "Not found" });

    const meId = req.user?._id?.toString();
    const ownerId = project.user?._id?.toString();
    const isOwn = Boolean(meId && ownerId === meId);

    // Count one view per logged-in non-owner. The unique { user, project } index
    // makes a second insert fail with 11000, so a repeat visit is never counted.
    if (meId && !isOwn) {
      try {
        await View.create({ user: req.user._id, project: project._id });
        await Project.updateOne({ _id: project._id }, { $inc: { views: 1 } });
        project.views += 1;
      } catch (err) {
        if (err.code !== 11000) throw err; // 11000 = already viewed
      }
    }

    const likedByMe = Boolean(
      meId && (await Like.exists({ user: req.user._id, project: project._id })),
    );

    res.json({
      project: {
        ...project.toPublicCard(),
        html: project.html,
        isOwn,
        likedByMe,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Likes or unlikes a project for the current user and returns the new like count.
export async function toggleLike(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ error: "Invalid id" });
    const project = await Project.findOne({ _id: req.params.id, published: true });
    if (!project) return res.status(404).json({ error: "Not found" });

    if (project.user.toString() === req.user._id.toString())
      return res.status(403).json({ error: "You can't like your own project" });

    const me = req.user._id;
    let liked;
    try {
      // The Like document and the counter change commit together.
      liked = await withTransaction(async (session) => {
        const removed = await Like.findOneAndDelete(
          { user: me, project: project._id },
          { session },
        );
        if (removed) {
          await Project.updateOne(
            { _id: project._id, likes: { $gt: 0 } },
            { $inc: { likes: -1 } },
            { session },
          );
          return false; // unliked
        }
        // The unique index makes a duplicate like impossible.
        await Like.create([{ user: me, project: project._id }], { session });
        await Project.updateOne({ _id: project._id }, { $inc: { likes: 1 } }, { session });
        return true; // liked
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      liked = true; // a parallel request already inserted this like
    }

    const fresh = await Project.findById(project._id).select("likes");
    res.json({ likes: Math.max(0, fresh?.likes ?? 0), liked });
  } catch (err) {
    next(err);
  }
}
