// Register page — name/email/password sign-up that emails a verification code.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { Input } from "../assets/ui";
import { register, apiError } from "../utils/api";
import { registerPageStyles as s } from "../assets/dummyStyles";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  // Returns an onChange handler that updates one form field and clears its error.
  function update(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((er) => ({ ...er, [field]: undefined }));
      setSubmitError("");
    };
  }

  // Validates the fields, calls register, then sends the user to the verify-email page.
  async function handleSubmit(e) {
    e.preventDefault();
    const er = {};
    if (form.name.trim().length < 2) er.name = "Enter your name";
    if (!form.email.includes("@")) er.email = "Enter a valid email";
    if (form.password.length < 6) er.password = "At least 6 characters";
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      const result = await register(form);
      const params = new URLSearchParams({ email: result.email });
      navigate(`/verify-email?${params.toString()}`);
    } catch (err) {
      setSubmitError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Sign Up"
      subtitle="Enter your information to create an account"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className={s.signInLink}
          >
            Sign In
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={s.form}>
        <Input
          label="Name"
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
          autoComplete="name"
        />
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="m@example.com"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={update("password")}
          error={errors.password}
          autoComplete="new-password"
        />

        {submitError && (
          <p className={s.submitError}>{submitError}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={s.submitButton}
        >
          {loading ? "Sending code..." : "Send verification code"}
        </button>

        <div className={s.infoBox}>
          <div className={s.infoRow}>
            <span className={s.infoDotIndigo} />
            We'll email you a 6-digit code. Enter it to verify, then sign in.
          </div>
          <div className={s.infoRow}>
            <span className={s.infoDotEmerald} />
            You get{" "}
            <span className={s.infoHighlight}>20 free credits</span> on
            first login.
          </div>
        </div>
      </form>
    </AuthShell>
  );
}