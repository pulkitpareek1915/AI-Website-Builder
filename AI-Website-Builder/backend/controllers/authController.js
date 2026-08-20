// Auth controller — register/login/profile/contributions.
// Forgot-password subflow lives in routes/authForgot.

import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { signToken } from "../middleware/auth.js";
import {
  sendOtpEmail,
  generateOtp,
  saveOtp,
  verifyOtp,
} from "../utils/services.js";

// Issue an OTP for an email and send it. Returns the standard payload.
async function issueAndSend(email, name, status, res, code = 201) {
  const otp = generateOtp();
  saveOtp(email, otp);
  await sendOtpEmail({ to: email, name, code: otp, purpose: status });
  return res.status(code).json({ ok: true, email });
}

// Sign up a new user, or re-send OTP if the email exists but is unverified.
export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(404).json({
        message: "All fields are required"
      })
    }
    if (name.length < 2)
      return res.status(400).json({ error: "Name must be at least 2 characters." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });


    const existing = await User.findOne({ email });
    if (existing) {
      // Existing + verified → email already in use. Unverified → re-issue OTP.
      if (existing.emailVerified)
        return res.status(409).json({ error: "Email already in use" });
      return issueAndSend(email, existing.name, "signup", res, 200);
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await User.hashPassword(password),
      emailVerified: false,
    });
    return issueAndSend(user.email, user.name, "signup", res, 201);
  } catch (err) {
    next(err);
  }
}

// Check the signup OTP and mark the user's email as verified if it matches.
export async function verifyRegister(req, res, next) {
  try {
    const {email, code} = req.body;
    if (!email || !code)
      return res.status(400).json({ error: "Email and code are required." });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ error: "No account found with that email." });
    if (user.emailVerified)
      return res.json({ ok: true, alreadyVerified: true });

    const result = verifyOtp(email, code);
    if (!result.ok) return res.status(400).json({ error: result.reason });

    user.emailVerified = true;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Send a fresh signup OTP to a user who has not verified their email yet.
export async function resendRegister(req, res, next) {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ error: "No account found with that email." });
    if (user.emailVerified)
      return res
        .status(400)
        .json({ error: "This email is already verified — just sign in." });

    return issueAndSend(user.email, user.name, "signup", res, 200);
  } catch (err) {
    next(err);
  }
}

// Check email and password, then return a login token if the email is verified.
export async function login(req, res, next) {
  try {
    const {email, password} = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email and password are required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await user.verifyPassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.emailVerified) {
      return res.status(403).json({
        error:
          "Please verify your email first. Check your inbox for the 6-digit code.",
        needsVerification: true,
        email: user.email,
      });
    }
    const token = signToken(user._id.toString());
    res.json({ token, user: user.toClient() });
  } catch (err) {
    next(err);
  }
}

// Return the currently logged-in user's profile.
export function me(req, res) {
  res.json({ user: req.user.toClient() });
}

// Activity heatmap: count each user message (initial prompt + iterations)
// as exactly one contribution. Mirrors GitHub's commit graph shape.
export async function contributions(req, res, next) {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setUTCHours(0, 0, 0, 0);
    oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 364);

    const projects = await Project.find({
      user: req.user._id,
      "messages.createdAt": { $gte: oneYearAgo },
    }).select("messages");

    const counts = {};
    const key = (d) => new Date(d).toISOString().slice(0, 10);
    for (const p of projects) {
      for (const m of p.messages || []) {
        if (m.role === "user" && m.createdAt && m.createdAt >= oneYearAgo) {
          const k = key(m.createdAt);
          counts[k] = (counts[k] || 0) + 1;
        }
      }
    }

    const days = Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const total = days.reduce((s, d) => s + d.count, 0);
    res.json({ days, total, from: key(oneYearAgo), to: key(new Date()) });
  } catch (err) {
    next(err);
  }
}

// Update the logged-in user's display name.
export async function updateProfile(req, res, next) {
  try {
    // Email is fixed after signup — only the name can be changed here.
    const name =
      req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    if (name === undefined)
      return res.status(400).json({ error: "Nothing to update" });
    if (name.length < 2 || name.length > 32)
      return res.status(400).json({ error: "Name must be 2–32 characters." });

    req.user.name = name;
    await req.user.save();
    res.json({ user: req.user.toClient() });
  } catch (err) {
    next(err);
  }
}

// Verify the current password, then set a new one for the logged-in user.
export async function changePassword(req, res, next) {
  try {
    const {current, nextPw} = req.body;
    if (!current || nextPw.length < 6)
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters." });

    const ok = await req.user.verifyPassword(current);
    if (!ok)
      return res.status(400).json({ error: "Current password is incorrect" });
    req.user.passwordHash = await User.hashPassword(nextPw);
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Delete the logged-in user's account along with all of their projects.
export async function deleteAccount(req, res, next) {
  try {
    await Project.deleteMany({ user: req.user._id });
    await req.user.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
