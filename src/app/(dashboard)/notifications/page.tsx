"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bell, Check, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NotificationsPage() {
  const notifications = useQuery(api.notifications.listByUser);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const unreadCount =
    notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              markAllAsRead();
            }}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification._id}
              className={cn(!notification.isRead && "border-primary/30 bg-primary/5")}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <Bell
                  className={cn(
                    "h-5 w-5 mt-0.5",
                    notification.isRead
                      ? "text-muted-foreground"
                      : "text-primary"
                  )}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">
                      {notification.title}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(
                        new Date(notification._creationTime),
                        { addSuffix: true }
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {notification.type.replace(/_/g, " ")}
                    </Badge>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() =>
                          markAsRead({ id: notification._id })
                        }
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <CardTitle className="text-lg">No notifications yet</CardTitle>
            <CardDescription>
              You&apos;ll be notified about waitlist openings, bookings, and
              invoices here.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
