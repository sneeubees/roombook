"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Building2, Gauge, PiggyBank, Users2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { RoomBookLogo } from "@/components/brand/roombook-logo";

const NAV = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  {
    href: "/admin/organizations",
    label: "Organizations",
    icon: Building2,
    exact: false,
  },
  { href: "/admin/pricing", label: "Pricing", icon: PiggyBank, exact: false },
  { href: "/admin/co-admins", label: "Co-admins", icon: Users2, exact: false },
];

export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();

  const menuContent = (
    <>
      <div className="space-y-8">
        <div>
          <RoomBookLogo textClassName="text-white text-xl" />
          <p className="mt-4 text-xs uppercase tracking-[0.32em] text-emerald-300/80">
            Super Admin
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            Platform console
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-stone-400">
            Manage organizations, pricing and co-admins across RoomBook.
          </p>
        </div>

        <nav className="space-y-2">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                  active
                    ? "bg-emerald-500 text-black"
                    : "text-stone-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Link
        href="/dashboard"
        className="mt-8 flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-stone-300 transition hover:border-white/20 hover:bg-white/[0.06]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden flex-col justify-between rounded-[32px] border border-white/10 bg-black/35 p-5 backdrop-blur lg:flex lg:h-[calc(100vh-2rem)] lg:min-h-0 lg:self-start">
        {menuContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-[88%] max-w-sm flex-col justify-between border-r border-white/10 bg-[#070a09]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur">
            <button
              type="button"
              aria-label="Close menu"
              onClick={onMobileClose}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-stone-300 transition hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {menuContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
