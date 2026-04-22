"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { useCustomDomain } from "@/hooks/use-custom-domain";
import { TIERS, formatZAR } from "@/lib/tiers";
import { Check, X } from "lucide-react";
import {
  CalendarDays,
  DoorOpen,
  FileText,
  BarChart3,
  Bell,
  Users,
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
              <div className="text-sm uppercase tracking-widest text-muted-foreground">
                {orgName}
              </div>
            )}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
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
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">RoomBook</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard" className={buttonVariants()}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={buttonVariants({ variant: "ghost" })}
                >
                  Sign In
                </Link>
                <Link href="/sign-up" className={buttonVariants()}>
                  Register Your Practice
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Room booking made simple
            <br />
            <span className="text-muted-foreground">
              for medical practices
            </span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            Let your bookers book rooms, track usage, and receive automated
            invoices. Full reporting and waitlist notifications included.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
              Get Started
            </Link>
            <Link
              href="/sign-in"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="space-y-3">
                <feature.icon className="h-8 w-8 text-primary" />
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-2">
            Simple, predictable pricing
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Pay monthly via EFT. Cancel any time.
          </p>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {(["basic", "professional", "enterprise"] as const).map((tierId) => {
              const t = TIERS[tierId];
              const isFeatured = tierId === "professional";
              return (
                <div
                  key={tierId}
                  className={
                    "rounded-lg border p-6 flex flex-col " +
                    (isFeatured ? "border-primary shadow-md" : "")
                  }
                >
                  {isFeatured && (
                    <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                      Most popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold">{t.label}</h3>
                  <p className="text-sm text-muted-foreground">{t.tagline}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">
                      {formatZAR(t.monthlyPriceZAR)}
                    </span>
                    <span className="text-muted-foreground"> / month</span>
                  </div>
                  <ul className="space-y-2 my-6 text-sm">
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

      <footer className="border-t py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} RoomBook. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
