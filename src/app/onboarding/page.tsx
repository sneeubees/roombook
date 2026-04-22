"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48) || `org-${Math.random().toString(36).slice(2, 8)}`;
}

export default function OnboardingPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.currentUser);
  const currentOrg = useQuery(api.organizations.currentOrg);
  const createOrg = useMutation(api.organizations.create);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierParam = searchParams.get("tier");
  const nextAfterOrg = tierParam ? `/subscribe?tier=${tierParam}` : "/dashboard";
  const creating = useRef(false);

  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/sign-in");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // If user already has an org, skip onboarding. Honour ?tier= so a
    // returning user who clicked a pricing CTA still lands on /subscribe.
    if (currentOrg?.org) {
      router.push(nextAfterOrg);
    }
  }, [currentOrg, router, nextAfterOrg]);

  useEffect(() => {
    if (me && !orgName) {
      setOrgName(me.fullName ? `${me.fullName}'s Organization` : "My Organization");
    }
  }, [me, orgName]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim() || creating.current) return;
    creating.current = true;
    setIsSubmitting(true);
    try {
      const slug = slugify(orgName);
      await createOrg({ name: orgName.trim(), slug });
      router.push(nextAfterOrg);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create organization"
      );
      creating.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || currentOrg === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <DoorOpen className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-background p-8 shadow-sm">
        <div className="text-center space-y-2">
          <DoorOpen className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Set up your organization / practice</h1>
          <p className="text-sm text-muted-foreground">
            Give your organization / practice a name to get started.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization / Practice Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., PhysioCare Practice"
              autoFocus
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !orgName.trim()}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </form>
      </div>
    </div>
  );
}
