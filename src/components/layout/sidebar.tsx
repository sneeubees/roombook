"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/use-user-role";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import { useOrgData } from "@/hooks/use-org-data";
import { useCustomDomain } from "@/hooks/use-custom-domain";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Feature } from "@/lib/tiers";
import {
  CalendarDays,
  LayoutDashboard,
  DoorOpen,
  BookOpen,
  Users,
  FileText,
  BarChart3,
  Settings,
  Shield,
  History,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredFeature?: Feature;
};

const ownerLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/bookings", label: "Bookings", icon: BookOpen },
  { href: "/history", label: "Booking History", icon: History, requiredFeature: "history" },
  { href: "/team", label: "Team", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText, requiredFeature: "invoices" },
  { href: "/reports", label: "Reports", icon: BarChart3, requiredFeature: "reports" },
  { href: "/settings", label: "Settings", icon: Settings },
];

const bookerLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/bookings", label: "My Bookings", icon: BookOpen },
  { href: "/history", label: "Booking History", icon: History, requiredFeature: "history" },
  { href: "/invoices", label: "Invoices", icon: FileText, requiredFeature: "invoices" },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const { isOwner, isManager, isSuperAdmin, canAccessSettings, canAccessReports } = useUserRole();
  const { isCustomDomain } = useCustomDomain();
  const { can } = useSubscriptionTier();
  const { convexOrg } = useOrgData();

  const unreadCount = useQuery(api.notifications.countUnread);

  const invoicesOn = convexOrg?.invoicesEnabled !== false;
  // Manager gets owner links minus Settings + Reports
  const allLinks = (isOwner || isManager) ? ownerLinks : bookerLinks;
  const links = allLinks.filter((link) => {
    if (link.requiredFeature && !can(link.requiredFeature)) return false;
    if (link.href === "/invoices" && !invoicesOn) return false;
    if (link.href === "/settings" && !canAccessSettings) return false;
    if (link.href === "/reports" && !canAccessReports) return false;
    return true;
  });

  // Add admin link for super admin
  if (isSuperAdmin) {
    links.push({ href: "/admin", label: "Admin", icon: Shield });
  }

  return (
    <aside className="flex flex-col w-64 border-r bg-sidebar text-sidebar-foreground">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          {convexOrg?.logoUrl ? (
            <img
              src={convexOrg.logoUrl}
              alt={convexOrg.name}
              className="h-6 w-6 rounded object-contain"
            />
          ) : (
            <DoorOpen className="h-6 w-6 text-primary" />
          )}
          <span className="text-lg font-bold">
            {convexOrg?.name ?? "RoomBook"}
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
