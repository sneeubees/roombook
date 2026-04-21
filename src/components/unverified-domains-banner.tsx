"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { buttonVariants } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * Shows a warning banner at the top of a page when the current org has
 * any white-label domains that are pending DNS verification. Only visible
 * to owners (who are the ones able to fix it from Settings).
 */
export function UnverifiedDomainsBanner() {
  const { orgId } = useOrgData();
  const { isOwner } = useUserRole();
  const domains = useQuery(
    api.domains.listByOrg,
    isOwner && orgId ? { orgId } : "skip"
  );
  if (!isOwner) return null;
  const unverified = (domains ?? []).filter((d) => !d.isVerified);
  if (unverified.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Your DNS is not verified</p>
        <p className="text-xs mt-0.5">
          The following domain{unverified.length > 1 ? "s are" : " is"} pending
          DNS verification and will not work until verified:{" "}
          <span className="font-mono">
            {unverified.map((d) => d.domain).join(", ")}
          </span>
          .
        </p>
      </div>
      <Link
        href="/settings#domains-unverified"
        className={buttonVariants({ size: "sm" })}
      >
        Verify now
      </Link>
    </div>
  );
}
