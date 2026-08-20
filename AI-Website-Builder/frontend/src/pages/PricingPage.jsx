import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Check,
  Zap,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  getPackages,
  verifySession,
  apiError,
  createCheckoutSession,
} from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { pricingPageStyles as s } from "../assets/dummyStyles";

const faqs = [
  {
    q: "What's a credit?",
    a: "One credit = one AI generation. New sites cost 5, iterations cost 2.",
  },
  {
    q: "Do credits expire?",
    a: "No. Credits you buy stay on your account forever. The 20 free signup credits also never expire.",
  },
  {
    q: "Do I need a subscription?",
    a: "No subscription, no auto-renewal. Buy a one-time pack when you need more credits. Pay only for what you use.",
  },
  {
    q: "What payment methods work?",
    a: "All major debit / credit cards (Visa, Mastercard, Amex) — handled by Stripe's secure hosted checkout.",
  },
  {
    q: "Do you offer refunds?",
    a: "Unused credits are refundable within 14 days of purchase — just email us. Already-used credits aren't refundable.",
  },
  {
    q: "What if a generation fails?",
    a: "If the AI falls back to a template (provider error, quota exhausted, etc.) we don't charge any credits. You only pay for successful generations.",
  },
];

// Handles the Stripe success-return URL: ?session_id=cs_test_...
// We hit /verify-session, credit the user, and clear the query param.
function StripeReturnBanner() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get("session_id");
  const cancelled = params.get("cancelled");
  const { setUser } = useAuth();
  const [status, setStatus] = useState(
    sessionId ? "verifying" : cancelled ? "cancelled" : "idle",
  );
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;
    verifySession(sessionId)
      .then((r) => {
        if (!mounted) return;
        if (r.user) setUser(r.user);
        setResult(r);
        setStatus("success");
      })
      .catch((e) => {
        if (!mounted) return;
        setError(apiError(e));
        setStatus("error");
      })
      .finally(() => {
        const next = new URLSearchParams(params);
        next.delete("session_id");
        next.delete("cancelled");
        setParams(next, { replace: true });
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (status === "idle") return null;

  const banner = {
    cancelled: {
      className: `${s.bannerBase} ${s.bannerCancelled}`,
      icon: <AlertTriangle className={s.bannerIcon} />,
      body: "Payment cancelled — no credits were charged.",
    },
    verifying: {
      className: `${s.bannerBase} ${s.bannerVerifying}`,
      body: "Verifying your payment with Stripe…",
    },
    error: {
      className: `${s.bannerBase} ${s.bannerError}`,
      icon: <AlertTriangle className={s.bannerIcon} />,
      body: (
        <>
          Couldn't verify the payment: {error}. If you were charged, refresh —
          the webhook usually credits you within a minute.
        </>
      ),
    },
    success: {
      className: `${s.bannerBase} ${s.bannerSuccess}`,
      icon: <CheckCircle2 className={s.bannerIconSuccess} />,
      body: (
        <div>
          <p className={s.bannerBodySuccess}>
            Payment received — {result?.creditsAdded || 0} credits added!
          </p>
          <p className={s.bannerBodySuccessSub}>
            Your new balance: {result?.user?.credits ?? "(refresh to see)"}{" "}
            credits.
          </p>
        </div>
      ),
    },
  }[status];

  return (
    <div className={banner.className}>
      {banner.icon}
      {banner.body}
    </div>
  );
}

// The full pricing page: hero, Stripe return banner, credit packages, and FAQ.
export default function PricingPage() {
  return (
    <div className={s.container}>
      <Navbar />

      <section className={s.hero}>
        <div className={s.heroBg} style={s.heroBgStyle} />
        <div className={s.heroInner}>
          <p className={s.heroBadge}>Pricing</p>
          <h1 className={s.heroTitle}>
            Start free. <br className={s.heroTitleBr} />
            Pay when you grow.
          </h1>
          <p className={s.heroSub}>
            No credit card to start. Cancel anytime. Built to scale with you.
          </p>
        </div>
      </section>

      <StripeReturnBanner />

      <Pricing standalone />

      <section className={s.faqSection}>
        <div className={s.faqContainer}>
          <h2 className={s.faqHeading}>
            Frequently asked questions
          </h2>
          <div className={s.faqList}>
            {faqs.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary className={s.faqSummary}>
                  {f.q}
                  <span className={s.faqPlus}>+</span>
                </summary>
                <p className={s.faqAnswer}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// Hook that starts a Stripe checkout for a package and tracks buying state/errors.
function useStripeCheckout() {
  const [purchasingId, setPurchasingId] = useState(null);
  const [error, setError] = useState("");
  async function buy(pkg) {
    setError("");
    setPurchasingId(pkg.id);
    try {
      const { url } = await createCheckoutSession(pkg.id);
      if (!url) throw new Error("Stripe didn't return a checkout URL");
      window.location.assign(url);
    } catch (err) {
      setError(apiError(err));
      setPurchasingId(null);
    }
  }
  return { buy, purchasingId, error };
}

// The credit packages grid. `standalone` drops the section heading (used when
// the page already has its own hero, like this one).
function Pricing({ standalone = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthed = Boolean(user);
  const { buy, purchasingId, error } = useStripeCheckout();

  const [pkgData, setPkgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    getPackages()
      .then((d) => setPkgData(d))
      .catch((err) => setLoadError(err))
      .finally(() => setLoading(false));
  }, []);
  const packages = pkgData?.packages || [];
  const configured = pkgData?.configured;

  function handleBuy(pkg) {
    if (!isAuthed) {
      navigate("/register");
      return;
    }
    if (!configured) return;
    buy(pkg);
  }

  const sectionClass = `${s.pricingSection} ${
    !standalone ? s.pricingSectionWithBorder : ""
  }`;

  return (
    <section className={sectionClass}>
      <div className={s.pricingContainer}>
        {!standalone && (
          <div className={s.pricingHeader}>
            <p className={s.pricingHeaderBadge}>Pricing</p>
            <h2 className={s.pricingHeaderTitle}>
              Simple. No subscriptions. Just credits.
            </h2>
            <p className={s.pricingHeaderSub}>
              One credit = one AI generation. Buy what you need, when you need
              it. Credits never expire.
            </p>
          </div>
        )}

        <FreeBanner
          onCta={() => navigate(isAuthed ? "/dashboard" : "/register")}
          authed={isAuthed}
        />

        {!loading && !configured && (
          <div className={s.configWarning}>
            <AlertTriangle className={s.configWarningIcon} />
            <span>
              <strong className={s.configWarningStrong}>
                Payments not configured.
              </strong>{" "}
              Set{" "}
              <code className={s.configWarningCode}>STRIPE_SECRET_KEY</code>{" "}
              in <code className={s.configWarningCode}>backend/.env</code>,
              then restart the backend.
            </span>
          </div>
        )}

        {error && <div className={s.errorBox}>{error}</div>}

        {loading ? (
          <div className={s.loadingWrapper}>
            <Loader2 className={s.loadingSpinner} />
            Loading packages...
          </div>
        ) : loadError ? (
          <div className={s.loadError}>
            Couldn't load packages: {apiError(loadError)}
          </div>
        ) : (
          <div className={s.packageGrid}>
            {packages.map((p) => (
              <PackageCard
                key={p.id}
                pkg={p}
                onBuy={() => handleBuy(p)}
                purchasing={purchasingId === p.id}
                disabled={Boolean(purchasingId) || (!configured && isAuthed)}
                authed={isAuthed}
              />
            ))}
          </div>
        )}

        <p className={s.packageFooter}>
          Secure payments by Stripe · One-time purchase · Cards accepted
          worldwide
        </p>
      </div>
    </section>
  );
}

// Banner promoting the 20 free signup credits; hidden once the user is logged in.
function FreeBanner({ onCta, authed }) {
  if (authed) return null;
  return (
    <div className={s.freeBanner}>
      <div className={s.freeBannerLeft}>
        <div className={s.freeBannerIconBox}>
          <Sparkles className={s.freeBannerIcon} />
        </div>
        <div>
          <p className={s.freeBannerTitle}>
            Get 20 free credits when you sign up
          </p>
          <p className={s.freeBannerSub}>
            No card needed. Try the full builder before buying anything.
          </p>
        </div>
      </div>
      <button onClick={onCta} className={s.freeBannerButton}>
        Sign up free
      </button>
    </div>
  );
}

// Format the package amount using its own currency (Stripe sends `usd`).
function formatPrice(pkg) {
  const code = (pkg.currency || "usd").toUpperCase();
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(pkg.amount / 100);
}

const CARD_FEATURES = [
  "Unlimited project edits",
  "Publish to Community",
  "Export HTML",
  "Credits never expire",
];

// One credit-pack card showing price, features, and a buy button.
function PackageCard({ pkg, onBuy, purchasing, disabled, authed }) {
  const price = formatPrice(pkg);
  const buttonLabel = !authed
    ? "Sign up to buy"
    : purchasing
      ? "Processing..."
      : `Buy ${pkg.credits} credits`;
  const isHighlighted = pkg.highlighted;
  const cardClass = `${s.cardBase} ${
    isHighlighted ? s.cardHighlighted : s.cardNormal
  }`;
  const buttonClass = `${s.buyButton} ${
    isHighlighted ? s.buyButtonHighlighted : s.buyButtonNormal
  }`;

  return (
    <div className={cardClass}>
      {isHighlighted && (
        <span className={s.popularBadge}>Popular</span>
      )}
      <h3 className={s.packageName}>{pkg.name}</h3>
      <p className={s.packageTagline}>{pkg.tagline}</p>
      <div className={s.priceRow}>
        <span className={s.price}>{price}</span>
        <span className={s.priceSuffix}>one-time</span>
      </div>
      <p className={s.perCredit}>{pkg.perCredit} / credit</p>
      <ul className={s.featureList}>
        <li className={s.featureItem}>
          <Zap className={s.featureIcon} />
          <span>
            <span className={s.featureText}>{pkg.credits}</span> AI
            generations
          </span>
        </li>
        {CARD_FEATURES.map((f) => (
          <li key={f} className={s.featureItem}>
            <Check className={s.featureIcon} />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onBuy}
        disabled={disabled || purchasing}
        className={buttonClass}
      >
        {purchasing && <Loader2 className={s.buySpinner} />}
        {buttonLabel}
      </button>
    </div>
  );
}