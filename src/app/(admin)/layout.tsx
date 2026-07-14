"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { useUserRole } from "@/hooks/use-user-role";

/**
 * Route-group layout for the Super Admin console.
 *
 * The Convex + Auth providers already come from the ROOT layout
 * (src/app/layout.tsx), so this group has Convex access without re-wrapping.
 * This layout only adds a CLIENT-side guard for UX — the underlying Convex
 * functions are all independently super-admin gated on the server.
 *
 *  - Not authenticated  -> /sign-in
 *  - Authenticated, not super admin -> /dashboard
 *  - While resolving, render nothing (avoids a flash of the console).
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  // currentUser: undefined = still loading, null = signed out, object = loaded.
  const me = useQuery(api.users.currentUser);
  const { isSuperAdmin } = useUserRole();

  const resolving = authLoading || me === undefined;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (resolving) return;
    if (isAuthenticated && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [resolving, isAuthenticated, isSuperAdmin, router]);

  if (resolving) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070a09] text-sm text-stone-400">
        Loading console…
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdmin) {
    // Redirect is in flight; render nothing so the console never flashes.
    return null;
  }

  return <>{children}</>;
}
