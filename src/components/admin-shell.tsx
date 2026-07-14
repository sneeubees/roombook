"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { AdminSidebar } from "@/components/admin-sidebar";
import { RoomBookLogo } from "@/components/brand/roombook-logo";

export function AdminShell({
  title,
  eyebrow,
  description,
  headerActions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileNavOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [mobileNavOpen]);

  return (
    // Self-contained dark console. It hardcodes its own emerald-tinted gradient
    // and light-on-dark colours, so it renders identically regardless of the
    // user's app theme (the (dashboard) group's dark-mode toggle never runs
    // here — this is a separate route group).
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[radial-gradient(circle_at_top_left,#064e3b,transparent_24%),radial-gradient(circle_at_top_right,#022c22,transparent_22%),linear-gradient(180deg,#0a0f0d_0%,#070a09_100%)] text-white">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#070a09]/85 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-xl text-white transition hover:bg-white/5"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link href="/admin" className="flex items-center gap-2">
          <RoomBookLogo textClassName="text-white text-lg" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">
            Admin
          </span>
        </Link>
        <div className="w-10" aria-hidden />
      </header>

      <div className="mx-auto grid lg:h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[252px_1fr] lg:px-6">
        <AdminSidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <main className="min-h-0 lg:overflow-hidden rounded-[32px] border border-white/10 bg-[#070a09]/70 backdrop-blur">
          <div className="lg:h-full lg:overflow-y-auto rounded-[28px] px-5 py-6 lg:px-8 lg:py-8">
            <header className="mb-8 flex flex-col gap-3 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-emerald-300/80">
                  {eyebrow ?? "Super Admin"}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
                    {description}
                  </p>
                ) : null}
              </div>
              {headerActions ? (
                <div className="flex items-center gap-3">{headerActions}</div>
              ) : null}
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
