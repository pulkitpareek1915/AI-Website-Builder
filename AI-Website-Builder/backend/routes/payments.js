import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listPackages,
  createSession,
  verifySession,
  listHistory,
} from "../controllers/paymentsController.js";

const router = Router();

router.get("/packages", listPackages);

router.post("/create-checkout-session", requireAuth, createSession);
router.post("/verify-session", requireAuth, verifySession);
router.get("/history", requireAuth, listHistory);

export default router;
