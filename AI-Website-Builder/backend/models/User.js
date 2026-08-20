import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const STARTING_CREDITS = 20;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 32 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    credits: { type: Number, default: STARTING_CREDITS, min: 0 },
    emailVerified: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Returns a safe user object (no password hash) to send to the frontend.
userSchema.methods.toClient = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    credits: this.credits,
    emailVerified: Boolean(this.emailVerified),
    createdAt: this.createdAt,
  };
};

// Turns a plain-text password into a secure bcrypt hash for storage.
userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

// Checks whether a plain-text password matches this user's stored hash.
userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.STARTING_CREDITS = STARTING_CREDITS;

export const User = mongoose.model("User", userSchema);
