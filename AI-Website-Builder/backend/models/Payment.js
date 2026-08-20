import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    packageId: { type: String, required: true },
    creditsPurchased: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "usd" },
    stripeSessionId: { type: String, required: true, index: true },
    stripePaymentIntentId: { type: String, default: null },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },
  },
  { timestamps: true },
);

// Returns a safe payment object for the frontend without internal Stripe fields.
paymentSchema.methods.toClient = function () {
  return {
    id: this._id.toString(),
    packageId: this.packageId,
    creditsPurchased: this.creditsPurchased,
    amount: this.amount,
    currency: this.currency,
    status: this.status,
    createdAt: this.createdAt,
  };
};

export const Payment = mongoose.model("Payment", paymentSchema);
