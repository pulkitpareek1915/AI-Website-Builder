import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { list, get, toggleLike } from "../controllers/communityController.js";

const router = Router();

router.get("/", optionalAuth, list);
router.get("/:id", optionalAuth, get);
router.post("/:id/like", requireAuth, toggleLike);

export default router;
