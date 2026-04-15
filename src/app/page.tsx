"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Button, buttonVariants } from "@/components/ui/button";
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
  const { isSignedIn } = useUser();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">RoomBook</span>
          </div>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <Link href="/dashboard" className={buttonVariants()}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
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

      {/* Hero */}
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
            <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
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

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} RoomBook. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
