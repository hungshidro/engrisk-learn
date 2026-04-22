"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useI18n } from "@/i18n";
import { useState } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="glass sticky top-0 z-50 border-b border-border rounded-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm group-hover:scale-110 transition-transform">
              E
            </div>
            <span className="font-bold text-lg gradient-text hidden sm:block">
              EngRisk Learn
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/exercises"
              className="text-muted hover:text-foreground transition-colors text-sm font-medium"
            >
              {t.nav.exercises}
            </Link>
            {session && (
              <>
                <Link
                  href="/exercises/create"
                  className="text-muted hover:text-foreground transition-colors text-sm font-medium"
                >
                  {t.nav.create}
                </Link>
                <Link
                  href="/friends"
                  className="text-muted hover:text-foreground transition-colors text-sm font-medium"
                >
                  {locale === "vi" ? "Bạn bè" : "Friends"}
                </Link>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Language Switch */}
            <button
              onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:border-primary transition-colors text-muted hover:text-foreground"
            >
              {locale === "vi" ? "VI" : "EN"}
            </button>

            {/* Auth */}
            {session ? (
              <div className="flex items-center gap-3">
                <Link
                  href={`/profile/${session.user?.id}`}
                  className="text-sm text-muted hidden sm:block hover:text-foreground transition-colors"
                >
                  {session.user?.name}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-muted hover:text-error transition-colors font-medium"
                >
                  {t.nav.logout}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm text-muted hover:text-foreground transition-colors font-medium"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/register"
                  className="btn-primary text-sm !py-1.5 !px-4"
                >
                  {t.nav.register}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-muted hover:text-foreground p-1"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 animate-slide-in">
            <Link
              href="/exercises"
              className="block py-2 text-muted hover:text-foreground transition-colors text-sm"
              onClick={() => setMobileOpen(false)}
            >
              {t.nav.exercises}
            </Link>
            {session && (
              <>
                <Link
                  href="/exercises/create"
                  className="block py-2 text-muted hover:text-foreground transition-colors text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  {t.nav.create}
                </Link>
                <Link
                  href="/friends"
                  className="block py-2 text-muted hover:text-foreground transition-colors text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  {locale === "vi" ? "Bạn bè" : "Friends"}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
