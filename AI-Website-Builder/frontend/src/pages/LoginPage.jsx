// Login page — email + password sign-in form.
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { Input } from "../assets/ui";
import { useAuth } from "../context/AuthContext";
import { login, apiError } from "../utils/api";
import { loginPageStyles as s } from "../assets/dummyStyles";

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [params] = useSearchParams();
  // Pre-fill email if redirected from /verify-email or /register
  const initialEmail = params.get("email") || "";
  const justVerified = params.get("verified") === "1";
  const [form, setForm] = useState({ email: initialEmail, password: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  // Returns an onChange handler that updates one field and clears its error.
  function update(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((er) => ({ ...er, [field]: undefined }));
      setSubmitError("");
    };
  }

  // Validates inputs, logs the user in, and redirects to the dashboard.
  async function handleSubmit(e) {
    e.preventDefault();
    const er = {};
    if (!form.email.includes("@")) er.email = "Enter a valid email";
    if (form.password.length < 6) er.password = "At least 6 characters";
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      const { token, user } = await login(form);
      loginUser(token, user);
      navigate("/dashboard");
    } catch (err) {
      // If the server says the email isn't verified yet, jump straight to
      // verify-email instead of showing a generic error.
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 403 && data?.needsVerification && data?.email) {
        navigate(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
      setSubmitError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Sign In"
      subtitle="Enter your email below to login to your account"
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to="/register"
            className={s.signUpLink}
          >
            Sign Up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={s.form}>
        {justVerified && (
          <div className={s.verifiedBanner}>
            <CheckCircle2 className={s.verifiedIcon} />
            Email verified — sign in to get your 20 free credits.
          </div>
        )}
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

        <div>
          <div className={s.passwordRow}>
            <label htmlFor="password" className={s.passwordLabel}>
              Password
            </label>
            <Link
              to="/forgot"
              className={s.forgotLink}
            >
              Forgot your password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={update("password")}
            error={errors.password}
            autoComplete="current-password"
          />
        </div>

        {submitError && (
          <p className={s.submitError}>{submitError}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={s.submitButton}
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </AuthShell>
  );
}