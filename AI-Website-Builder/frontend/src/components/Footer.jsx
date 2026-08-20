// Footer — brand on the left, a few real links on the right.
import { Link } from "react-router-dom";
import { Logo } from "../assets/ui";
import { footerStyles as s } from "../assets/dummyStyles";

const links = [
  { label: "Features", to: "/#features" },
  { label: "Pricing", to: "/pricing" },
  { label: "Community", to: "/community" },
];

export default function Footer() {
  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        {/* Brand */}
        <div className={s.brand}>
          <Logo />
          <p className={s.brandText}>
            Turn thoughts into websites instantly with AI.
          </p>
        </div>

        {/* Real links */}
        <nav className={s.nav}>
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className={s.navLink}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <p className={s.copyright}>
        © 2025 mintsite. All rights reserved.
      </p>
    </footer>
  );
}