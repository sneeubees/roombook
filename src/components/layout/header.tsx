"use client";

import { useOrganization, useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUserRole } from "@/hooks/use-user-role";
import { useOrgData } from "@/hooks/use-org-data";
import { useState } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DoorOpen, User, Settings, LogOut, Menu } from "lucide-react";
import { ProfileDialog } from "./profile-dialog";

export function Header({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const { organization } = useOrganization();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isOwner } = useUserRole();
  const { convexOrg } = useOrgData();
  const [profileOpen, setProfileOpen] = useState(false);

  const convexUser = useQuery(
    api.users.getByClerkUserId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const displayName = convexUser?.fullName || user?.fullName || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <header className="flex items-center justify-between border-b px-6 py-3 bg-background">
        <div className="flex items-center gap-2">
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <DoorOpen className="h-4 w-4 text-muted-foreground hidden md:block" />
          <span className="text-sm font-medium hidden md:block">
            {convexOrg?.name ?? organization?.name ?? "Loading..."}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted transition-colors">
            <Avatar className="h-8 w-8">
              {user?.imageUrl && !user.imageUrl.includes("img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdC") && (
                <AvatarImage src={user.imageUrl} alt={displayName} />
              )}
              <AvatarFallback className="bg-foreground text-background text-xs font-semibold">
                {initials.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:inline">
              {displayName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {convexUser?.email || user?.primaryEmailAddress?.emailAddress}
              </p>
              {convexUser?.phone && (
                <p className="text-xs text-muted-foreground">
                  {convexUser.phone}
                </p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            {isOwner && (
              <>
                <DropdownMenuItem
                  onClick={() => (window.location.href = "/settings")}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ redirectUrl: "/" })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
