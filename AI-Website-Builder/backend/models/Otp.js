import mongoose from "mongoose";

// One pending one-time code per purpose + email (e.g. "reset:akarsh@gmail.com").
// Only a hash of the code is stored, never the code itself.
const otpSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // "<purpose>:<email>"
    codeHash: { type: String, required: true },          // HMAC-SHA256 of the 6-digit code
    attempts: { type: Number, default: 0 },              // checks used so far
    expiresAt: { type: Date, required: true },           // now + 10 minutes
  },
  { timestamps: true },
);

// TTL index: MongoDB deletes the document automatically once expiresAt has passed.
// (Its cleanup job runs about once a minute, so the code still checks expiresAt itself.)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model("Otp", otpSchema);
