import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  list,
  create,
  get,
  update,
  remove,
  generate,
  loadOwnedProject,
} from "../controllers/projectsController.js";
import { githubRoute, vercelRoute } from "./projectDeploy.js";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.get("/:id", requireAuth, get);
router.patch("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);
router.post("/:id/generate", requireAuth, generate);
router.post("/:id/github", requireAuth, githubRoute(loadOwnedProject));
router.post("/:id/deploy", requireAuth, vercelRoute(loadOwnedProject));

export default router;
