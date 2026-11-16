import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import { withTransaction } from "../utils/tx.js";
import {
  createCheckoutSession,
  retrieveSession,
  isStripeConfigured,
} from "../utils/services.js";

// Credit packages — `amount` is in the smallest currency unit (cents for USD).
export const PACKAGES = [
  {
    id: "starter",
    name: "Starter",
    credits: 50,
    amount: 499,
    currency: "usd",
    perCredit: "$0.10",
    tagline: "Try a few new projects",
  },
  {
    id: "popular",
    name: "Popular",
    credits: 200,
    amount: 1499,
    currency: "usd",
    perCredit: "$0.075",
    tagline: "Best for active creators",
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    credits: 500,
    amount: 2999,
    currency: "usd",
    perCredit: "$0.06",
    tagline: "For agencies and power users",
  },
];

// Returns the list of credit packages and whether Stripe is set up.
export function listPackages(_req, res) {
  res.json({
    packages: PACKAGES,
    configured: isStripeConfigured(),
  });
}

// Starts a Stripe checkout for the chosen package and saves a pending payment.
export async function createSession(req, res, next) {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({
        error:
          "Payments aren't configured. Add STRIPE_SECRET_KEY to backend/.env.",
      });
    }
    const packageId = req.body.packageId;
    if (!packageId)
      return res.status(400).json({ error: "packageId is required" });
    const pkg = PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: "Unknown package" });

    // Redirect back to whatever localhost port the frontend is on.
    const origin = req.headers.origin || "http://localhost:5173";
    const { id, url } = await createCheckoutSession({
      pkg,
      user: req.user,
      successUrl: `${origin}/pricing?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pricing?cancelled=1`,
    });

    await Payment.create({
      user: req.user._id,
      packageId: pkg.id,
      creditsPurchased: pkg.credits,
      amount: pkg.amount,
      currency: pkg.currency,
      stripeSessionId: id,
      status: "created",
    });

    res.json({ url, sessionId: id });
  } catch (err) {
    next(err);
  }
}

// Idempotent: client calls this on the success-return URL. We verify the
// session with Stripe and credit the user (only once).
export async function verifySession(req, res, next) {
  try {
    if (!isStripeConfigured())
      return res.status(503).json({ error: "Payments aren't configured." });
    const sessionId = req.body.sessionId;
    if (!sessionId || String(sessionId).length < 5)
      return res.status(400).json({ error: "sessionId is required" });
    const payment = await Payment.findOne({
      stripeSessionId: sessionId,
      user: req.user._id,
    });
    if (!payment) return res.status(404).json({ error: "Session not found" });
    if (payment.status === "paid") {
      return res.json({
        ok: true,
        alreadyCredited: true,
        user: req.user.toClient(),
      });
    }
    const stripeSession = await retrieveSession(sessionId);
    if (stripeSession.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed yet" });
    }
    const creditsToAdd = Number(payment.creditsPurchased);
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      return res.status(500).json({ error: "Invalid creditsPurchased value on payment record." });
    }

    // Flip the payment to "paid" and add the credits as ONE unit:
    // - the filter status != "paid" lets only the FIRST of several parallel
    //   requests match, so the same payment can never be credited twice;
    // - the transaction makes both writes commit together or not at all;
    // - $inc adds to the balance inside MongoDB (no stale read-modify-write).
    const credited = await withTransaction(async (session) => {
      const flipped = await Payment.findOneAndUpdate(
        { _id: payment._id, status: { $ne: "paid" } },
        { $set: { status: "paid", stripePaymentIntentId: stripeSession.payment_intent } },
        { new: true, session },
      );
      if (!flipped) return false; // another request already credited it
      await User.updateOne(
        { _id: req.user._id },
        { $inc: { credits: creditsToAdd } },
        { session },
      );
      return true;
    });

    const freshUser = await User.findById(req.user._id);
    res.json({
      ok: true,
      ...(credited ? { creditsAdded: creditsToAdd } : { alreadyCredited: true }),
      user: freshUser.toClient(),
    });
  } catch (err) {
    next(err);
  }
}

// Returns the user's 50 most recent successful (paid) payments.
export async function listHistory(req, res, next) {
  try {
    const list = await Payment.find({ user: req.user._id, status: "paid" })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ payments: list.map((p) => p.toClient()) });
  } catch (err) {
    next(err);
  }
}
