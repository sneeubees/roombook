"use client";

import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useCustomDomain } from "@/hooks/use-custom-domain";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DoorOpen, User, LogOut, Menu, Sun, Moon } from "lucide-react";
import { ProfileDialog } from "./profile-dialog";

export function Header({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const me = useQuery(api.users.currentUser);
  const { convexOrg } = useOrgData();
  const { isCustomDomain } = useCustomDomain();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = me?.fullName || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

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
          {!isCustomDomain && <DoorOpen className="h-4 w-4 text-muted-foreground hidden md:block" />}
          <span className="text-sm font-medium hidden md:block">
            {convexOrg?.name ?? "Loading..."}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            onClick={() => {
              document.documentElement.classList.toggle("dark");
            }}
            title="Toggle dark mode"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="h-4 w-4 hidden dark:block" />
          </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted transition-colors cursor-pointer">
            <Avatar className="h-8 w-8">
              {me?.imageUrl && (
                <AvatarImage src={me.imageUrl} alt={displayName} />
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
                {me?.email}
              </p>
              {me?.phone && (
                <p className="text-xs text-muted-foreground">
                  {me.phone}
                </p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
