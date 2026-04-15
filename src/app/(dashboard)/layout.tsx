"use client";

import { useOrganization, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { FirstLoginModal } from "@/components/layout/first-login-modal";
import { useUserSync } from "@/hooks/use-user-sync";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DoorOpen, Clock, ShieldX } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoaded: userLoaded, isSignedIn } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const router = useRouter();
  const { convexOrg } = useOrgData();
  const { isSuperAdmin } = useUserRole();
  useUserSync();

  // Apply dark mode based on org setting
  useEffect(() => {
    if (convexOrg?.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [convexOrg?.darkMode]);

  const convexUser = useQuery(
    api.users.getByClerkUserId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  useEffect(() => {
    if (userLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [userLoaded, isSignedIn, router]);

  useEffect(() => {
    if (orgLoaded && !organization && isSignedIn && !isSuperAdmin) {
      router.push("/onboarding");
    }
  }, [orgLoaded, organization, isSignedIn, isSuperAdmin, router]);

  if (!userLoaded || !orgLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  // Super admin can access without an org
  if (!organization && !isSuperAdmin) {
    return null;
  }

  // Check org approval status (skip for super admin)
  const orgStatus = convexOrg?.status ?? "active"; // default active for existing orgs
  if (!isSuperAdmin && orgStatus === "pending_approval") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Clock className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>Registration Pending</CardTitle>
            <CardDescription>
              Your account is awaiting approval. You&apos;ll be able to access
              the platform once an administrator reviews your registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This usually takes less than 24 hours. You&apos;ll receive a
              notification once approved.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSuperAdmin && orgStatus === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <ShieldX className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>Account Suspended</CardTitle>
            <CardDescription>
              Your organization has been suspended. Please contact support
              for more information.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show first-login modal if profile is not complete
  const needsProfileSetup =
    convexUser !== undefined && convexUser?.isProfileComplete !== true;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
      {needsProfileSetup && <FirstLoginModal open={true} />}
    </div>
  );
}
