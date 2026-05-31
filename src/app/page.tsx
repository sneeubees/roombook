"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { RoomBookLogo } from "@/components/brand/roombook-logo";
import { buttonVariants } from "@/components/ui/button";
import { useCustomDomain } from "@/hooks/use-custom-domain";
import { TIERS, formatZAR } from "@/lib/tiers";
import { ArrowRight, Check, X } from "lucide-react";
import {
  CalendarDays,
  DoorOpen,
  FileText,
  BarChart3,
  Bell,
  Users,
  Clock,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    icon: CalendarDays,
    title: "Calendar Booking",
    description:
      "View room availability and book full or half day slots with a single click.",
  },
  {
    icon: DoorOpen,
    title: "Room Management",
    description:
      "Add multiple rooms, set rates, and block rooms for maintenance.",
  },
  {
    icon: FileText,
    title: "Automated Invoicing",
    description:
      "Monthly invoices generated automatically and emailed to bookers.",
  },
  {
    icon: BarChart3,
    title: "Full Reporting",
    description:
      "Occupancy rates, revenue charts, busy times heatmaps, and more.",
  },
  {
    icon: Bell,
    title: "Waitlist Notifications",
    description:
      "Get notified instantly when a room you want becomes available.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Invite bookers via secure links and manage your team easily.",
  },
];

const previewBookings = [
  { time: "08:00", room: "Treatment Room 1", booker: "Dr. Naidoo" },
  { time: "10:30", room: "Rehab Studio", booker: "Physio Team" },
  { time: "14:00", room: "Consult Room 3", booker: "Dr. Patel" },
];

const roomAvailability = [
  { room: "Treatment Room 1", status: "Booked", width: "78%" },
  { room: "Rehab Studio", status: "Available", width: "42%" },
  { room: "Consult Room 3", status: "Booked", width: "64%" },
];

export default function LandingPage() {
  const { isAuthenticated } = useConvexAuth();
  const { isCustomDomain, customDomain } = useCustomDomain();

  // Look up the org attached to this custom domain (if any) so we can show
  // its name on the landing.
  const orgLookup = useQuery(
    api.domains.getByDomain,
    isCustomDomain && customDomain ? { domain: customDomain } : "skip"
  );

  // White-label landing: no RoomBook branding, no sign-up, just Sign In.
  if (isCustomDomain) {
    const orgName = orgLookup?.org?.name ?? "";
    const logoUrl = orgLookup?.org?.logoUrl;
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-md">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={orgName || "Logo"}
                className="h-16 w-16 mx-auto rounded object-contain"
              />
            ) : (
              <DoorOpen className="h-16 w-16 mx-auto text-primary" />
            )}
            {orgName && (
              <div className="text-sm font-bold uppercase text-muted-foreground">
                {orgName}
              </div>
            )}
            <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
              Book Your Room
            </h1>
            <div className="pt-4">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className={buttonVariants({ size: "lg" })}
                >
                  Open dashboard
                </Link>
              ) : (
                <Link
                  href="/sign-in"
                  className={buttonVariants({ size: "lg" })}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Default RoomBook landing (main domain only).
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-white/90 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <RoomBookLogo />
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard" className={buttonVariants()}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={
                    buttonVariants({ variant: "ghost" }) +
                    " text-muted-foreground hover:text-foreground"
                  }
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className={
                    buttonVariants() +
                    " h-9 px-4 shadow-sm shadow-primary/20 hover:bg-primary/90"
                  }
                >
                  Register Your Practice
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative flex-1 overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_48%,#ecfeff_100%)]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: "url('/hero-medical-practice-bg.webp')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255_/_0.50)_0%,rgb(255_255_255_/_0.42)_48%,rgb(236_254_255_/_0.62)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgb(5_150_105_/_0.18),transparent_32%),radial-gradient(circle_at_top_right,rgb(20_184_166_/_0.14),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="container relative mx-auto px-6 pb-36 pt-24 text-center sm:pb-40 sm:pt-28 lg:pb-44 lg:pt-32">
          <div className="mx-auto mb-7 inline-flex items-center rounded-full bg-[#059669] px-4 py-1.5 text-xs font-bold text-white shadow-sm shadow-emerald-700/20">
            Room scheduling, billing, and reporting
          </div>
          <h1 className="mx-auto max-w-5xl text-balance font-heading text-5xl font-bold leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
            Room booking made simple for{" "}
            <span className="text-primary">medical practices</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg font-medium leading-8 text-slate-700 sm:text-xl sm:leading-9">
            Let your bookers book rooms, track usage, and receive automated
            invoices. Full reporting and waitlist notifications included.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className={
                buttonVariants({ size: "lg" }) +
                " h-12 px-6 text-base shadow-xl shadow-primary/25 hover:bg-primary/90"
              }
            >
              Register Your Practice
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
            <Link
              href="/sign-in"
              className={
                buttonVariants({ size: "lg", variant: "outline" }) +
                " h-12 border-border/80 bg-white/85 px-6 text-base shadow-sm hover:bg-white"
              }
            >
              Sign In
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-secondary" />
              Automated monthly invoices
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-secondary" />
              Live availability calendar
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-secondary" />
              Practice-level reporting
            </span>
          </div>
        </div>
      </section>

      <section className="-mt-20 bg-transparent pb-24">
        <div className="container mx-auto px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="mb-3 font-heading text-4xl font-bold leading-tight">
              See the day at a glance
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              A calm command center for bookings, availability, occupancy, and
              monthly performance.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-border bg-white/95 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading text-2xl font-bold leading-snug">
                    Calendar bookings
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tuesday, 16 June
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  9 bookings
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {["08:00", "10:30", "14:00"].map((time) => (
                  <div
                    key={time}
                    className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {time}
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {previewBookings.map((booking) => (
                  <div
                    key={`${booking.time}-${booking.room}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">
                        {booking.room}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {booking.time} - {booking.booker}
                      </div>
                    </div>
                    <div className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-accent-foreground">
                      Confirmed
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-3xl border border-border bg-white/95 p-6 shadow-xl shadow-slate-900/8 backdrop-blur">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-heading text-2xl font-bold leading-snug">
                    Room availability
                  </h3>
                  <DoorOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-4">
                  {roomAvailability.map((room) => (
                    <div key={room.room} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{room.room}</span>
                        <span className="text-muted-foreground">
                          {room.status}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: room.width }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-3xl border border-border bg-white/95 p-6 shadow-xl shadow-slate-900/8 backdrop-blur">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-heading text-xl font-bold">
                      Occupancy
                    </h3>
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-4xl font-bold text-foreground">
                    82%
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Average occupancy across active rooms this month.
                  </p>
                </div>

                <div className="rounded-3xl border border-border bg-white/95 p-6 shadow-xl shadow-slate-900/8 backdrop-blur">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-heading text-xl font-bold">
                      Monthly revenue
                    </h3>
                    <TrendingUp className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="text-4xl font-bold text-foreground">
                    R 48,250
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Projected billable room usage for June.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_42%,#f8fafc_100%)] py-24">
        <div className="container mx-auto px-6">
          <h2 className="mb-12 text-center font-heading text-4xl font-bold leading-tight">
            Everything you need
          </h2>
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-[#E2E8F0] bg-white p-7 shadow-sm shadow-slate-900/5 transition-all duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl hover:shadow-slate-900/10"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-7 w-7" />
                </div>
                <div className="space-y-3">
                  <h3 className="font-heading text-2xl font-bold leading-snug">
                    {feature.title}
                  </h3>
                  <p className="leading-7 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="border-y border-border/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] py-28"
      >
        <div className="container mx-auto px-6">
          <h2 className="mb-3 text-center font-heading text-4xl font-bold leading-tight">
            Simple, predictable pricing
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-base leading-7 text-muted-foreground">
            Pay monthly via EFT. Cancel any time.
          </p>
          <div className="mx-auto grid max-w-5xl gap-7 md:grid-cols-3">
            {(["basic", "professional", "enterprise"] as const).map((tierId) => {
              const t = TIERS[tierId];
              const isFeatured = tierId === "professional";
              return (
                <div
                  key={tierId}
                  className={
                    "flex flex-col rounded-2xl border border-border bg-white p-7 shadow-sm shadow-slate-900/5 " +
                    (isFeatured
                      ? "border-primary/40 shadow-xl shadow-primary/10"
                      : "hover:border-primary/20 hover:shadow-lg hover:shadow-slate-900/10 transition-all duration-200")
                  }
                >
                  {isFeatured && (
                    <div className="mb-2 text-xs font-bold uppercase text-primary">
                      Most popular
                    </div>
                  )}
                  <h3 className="font-heading text-2xl font-bold leading-snug">
                    {t.label}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t.tagline}
                  </p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">
                      {formatZAR(t.monthlyPriceZAR)}
                    </span>
                    <span className="text-muted-foreground"> / month</span>
                  </div>
                  <ul className="my-6 space-y-2.5 text-sm leading-6">
                    {t.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                    {t.notIncluded.map((h) => (
                      <li
                        key={h}
                        className="flex items-start gap-2 text-muted-foreground"
                      >
                        <X className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={
                      isAuthenticated
                        ? `/subscribe?tier=${tierId}`
                        : `/sign-up?tier=${tierId}`
                    }
                    className={
                      buttonVariants({
                        variant: isFeatured ? "default" : "outline",
                      }) + " mt-auto"
                    }
                  >
                    Choose {t.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="bg-white py-10">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} RoomBook. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
