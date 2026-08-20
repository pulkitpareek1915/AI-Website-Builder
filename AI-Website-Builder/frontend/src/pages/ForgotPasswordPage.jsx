// Forgot password page — email → verify the code → set a new password → sign in.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { Input } from "../assets/ui";
import {
  forgotRequest,
  forgotVerifyCode,
  forgotReset,
  apiError,
} from "../utils/api";
import { forgotPasswordPageStyles as s } from "../assets/dummyStyles";

const RESEND_COOLDOWN_SECONDS = 60;

// Multi-step forgot-password page: renders the email, code, or new-password step based on state.
export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState("email"); // 'email' | 'otp' | 'password'
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "otp") otpRef.current?.focus();
  }, [step]);

  // Step 1 — email the 6-digit code.
  async function requestCode(initial = false) {
    setError("");
    if (!email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    setLoading(true);
    try {
      await forgotRequest(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      if (initial) setStep("otp");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  // Step 2 — check the code, then move to the new-password step.
  async function verifyCode(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await forgotVerifyCode(email, otp);
      setStep("password");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  // Step 3 — set the new password, then send the user to sign in again.
  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await forgotReset(email, otp, password);
      toast.success("Password reset — please sign in with your new password.");
      navigate("/login");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────── Step 1: email ───────────────────
  if (step === "email") {
    return (
      <AuthShell
        title="Forgot your password?"
        subtitle="Enter the email tied to your account and we'll send a 6-digit code."
        footer={
          <Link
            to="/login"
            className={s.backLink}
          >
            <ArrowLeft className={s.backLinkIcon} /> Back to sign in
          </Link>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            requestCode(true);
          }}
          className={s.form}
        >
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            error={error}
            autoComplete="email"
          />

          <div className={s.infoBox}>
            <ShieldCheck className={s.infoIcon} />
            We only send codes to registered accounts.
          </div>

          <button
            type="submit"
            disabled={loading}
            className={s.buttonPrimary}
          >
            <Mail className={s.buttonPrimaryIcon} />
            {loading ? "Sending code..." : "Send verification code"}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ─────────────────── Step 3: new password ───────────────────
  if (step === "password") {
    return (
      <AuthShell
        title="Set a new password"
        subtitle="Code verified. Choose a new password for your account."
        footer={
          <Link
            to="/login"
            className={s.backLink}
          >
            <ArrowLeft className={s.backLinkIcon} /> Back to sign in
          </Link>
        }
      >
        <form onSubmit={resetPassword} className={s.form}>
          <Input
            label="New password"
            name="new-password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            error={error}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={loading || password.length < 6}
            className={s.buttonSecondary}
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ─────────────────── Step 2: verify the code ───────────────────
  return (
    <AuthShell
      title="Enter your code"
      subtitle={`We've emailed a 6-digit code to ${email}. It expires in 10 minutes.`}
      footer={
        <button
          onClick={() => {
            setStep("email");
            setOtp("");
            setPassword("");
            setError("");
          }}
          className={s.backLink}
        >
          <ArrowLeft className={s.backLinkIcon} /> Use a different email
        </button>
      }
    >
      <form onSubmit={verifyCode} className={s.form}>
        <div>
          <label htmlFor="otp" className={s.label}>
            Verification code
          </label>
          <input
            ref={otpRef}
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            placeholder="••••••"
            className={s.otpInput}
          />
          {error && <p className={s.error}>{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className={s.buttonSecondary}
        >
          {loading ? "Verifying..." : "Verify code"}
        </button>

        <div className={s.resendRow}>
          <span>Didn't get a code?</span>
          <button
            type="button"
            disabled={cooldown > 0 || loading}
            onClick={() => requestCode(false)}
            className={s.resendButton}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}