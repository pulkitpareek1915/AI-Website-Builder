// AuthShell — shared layout wrapper for the login/register/verify screens.
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo, PageBackdrop } from "../assets/ui";
import { authShellStyles as s } from "../assets/dummyStyles";

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className={s.container}>
      <PageBackdrop grid />

      <header className={s.header}>
        <Logo />
        <Link
          to="/"
          className={s.backLink}
        >
          <ArrowLeft className={s.backIcon} /> Back home
        </Link>
      </header>

      <main className={s.main}>
        <div className={s.inner}>
          <div className={s.card}>
            <h1 className={s.title}>{title}</h1>
            <p className={s.subtitle}>{subtitle}</p>
            {children}
          </div>
          {footer && (
            <p className={s.footer}>{footer}</p>
          )}
        </div>
      </main>
    </div>
  );
}