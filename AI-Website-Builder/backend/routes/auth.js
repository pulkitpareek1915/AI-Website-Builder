import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  register,
  verifyRegister,
  resendRegister,
  login,
  me,
  contributions,
  updateProfile,
  changePassword,
  deleteAccount,
} from "../controllers/authController.js";
import forgotRoutes from "./authForgot.js";

const router = Router();

// Registration → OTP verify → login
router.post("/register", register);
router.post("/register/verify", verifyRegister);
router.post("/register/resend", resendRegister);
router.post("/login", login);

// Current user
router.get("/me", requireAuth, me);
router.get("/me/contributions", requireAuth, contributions);
router.patch("/me", requireAuth, updateProfile);
router.patch("/me/password", requireAuth, changePassword);
router.delete("/me", requireAuth, deleteAccount);

// Forgot-password subflow — lives in its own controller/route file
router.use("/forgot", forgotRoutes);

export default router;
