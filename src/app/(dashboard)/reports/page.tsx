"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
  getDay,
  parseISO,
} from "date-fns";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ReportsPage() {
  const { orgId } = useOrgData();
  const { can } = useSubscriptionTier();
  const [monthsBack, setMonthsBack] = useState(3);

  if (!can("reports")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-xl font-semibold mb-2">Reports</h2>
        <p className="text-muted-foreground max-w-md">
          Upgrade to the Professional plan to access occupancy charts, revenue
          reports, busy-time heatmaps, and booker utilization analytics.
        </p>
      </div>
    );
  }

  const now = new Date();
  const startDate = format(
    startOfMonth(subMonths(now, monthsBack - 1)),
    "yyyy-MM-dd"
  );
  const endDate = format(endOfMonth(now), "yyyy-MM-dd");

  const rooms = useQuery(api.rooms.list, orgId ? { orgId } : "skip");
  const bookings = useQuery(
    api.bookings.listAllByOrg,
    orgId
      ? { orgId, startDate, endDate, status: "confirmed" }
      : "skip"
  );

  // Resolve user names from Convex
  const bookerIds = useMemo(() => {
    const ids = new Set<string>();
    bookings?.forEach((b) => ids.add(b.userId));
    return Array.from(ids);
  }, [bookings]);

  const convexUsers = useQuery(
    api.users.listByClerkUserIds,
    bookerIds.length > 0 ? { clerkUserIds: bookerIds } : "skip"
  );

  function resolveUserName(clerkUserId: string): string {
    const cu = convexUsers?.find((u) => u.clerkUserId === clerkUserId);
    return cu?.fullName || clerkUserId;
  }

  // Room occupancy data
  const occupancyData = useMemo(() => {
    if (!rooms || !bookings) return [];
    return rooms.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomId === room._id);
      const totalDays = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate),
      }).length;
      const bookedSlots = roomBookings.length;
      const occupancyRate = totalDays > 0 ? (bookedSlots / totalDays) * 100 : 0;

      return {
        name: room.name,
        occupancy: Math.round(occupancyRate),
        bookings: bookedSlots,
      };
    });
  }, [rooms, bookings, startDate, endDate]);

  // Revenue by room
  const revenueByRoom = useMemo(() => {
    if (!rooms || !bookings) return [];
    return rooms.map((room) => {
      const roomBookings = bookings.filter(
        (b) => b.roomId === room._id && b.isBillable
      );
      const revenue = roomBookings.reduce((sum, b) => sum + b.rateApplied, 0);
      return {
        name: room.name,
        revenue: revenue / 100,
      };
    });
  }, [rooms, bookings]);

  // Busy times by day of week
  const busyTimesData = useMemo(() => {
    if (!bookings) return [];
    const dayCounts = Array(7).fill(0);
    bookings.forEach((b) => {
      const dayOfWeek = getDay(parseISO(b.date));
      dayCounts[dayOfWeek]++;
    });
    return DAY_NAMES.map((name, i) => ({
      name,
      bookings: dayCounts[i],
    }));
  }, [bookings]);

  // Booker utilization
  const bookerData = useMemo(() => {
    if (!bookings) return [];
    const bookerMap = new Map<string, { name: string; count: number; revenue: number }>();
    bookings.forEach((b) => {
      const existing = bookerMap.get(b.userId) ?? {
        name: resolveUserName(b.userId),
        count: 0,
        revenue: 0,
      };
      existing.count++;
      if (b.isBillable) existing.revenue += b.rateApplied;
      bookerMap.set(b.userId, existing);
    });
    return Array.from(bookerMap.values()).sort(
      (a, b) => b.count - a.count
    );
  }, [bookings, convexUsers]);

  // KPIs
  const totalRevenue = bookings
    ?.filter((b) => b.isBillable)
    .reduce((sum, b) => sum + b.rateApplied, 0) ?? 0;
  const totalBookings = bookings?.length ?? 0;
  const activeRooms = rooms?.filter((r) => r.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Tabs
          value={String(monthsBack)}
          onValueChange={(v) => setMonthsBack(parseInt(v))}
        >
          <TabsList>
            <TabsTrigger value="1">1 Month</TabsTrigger>
            <TabsTrigger value="3">3 Months</TabsTrigger>
            <TabsTrigger value="6">6 Months</TabsTrigger>
            <TabsTrigger value="12">12 Months</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R{(totalRevenue / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRooms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Active Bookers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookerData.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Room Occupancy */}
        <Card>
          <CardHeader>
            <CardTitle>Room Occupancy</CardTitle>
            <CardDescription>Percentage of days booked per room</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={occupancyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="occupancy" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Room */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Room</CardTitle>
            <CardDescription>Total revenue generated per room</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueByRoom}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="revenue"
                  nameKey="name"
                  label={({ name, value }) => `${name}: R${value.toFixed(0)}`}
                >
                  {revenueByRoom.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `R${Number(value).toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Busy Times */}
        <Card>
          <CardHeader>
            <CardTitle>Busy Times</CardTitle>
            <CardDescription>Bookings by day of week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={busyTimesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="bookings" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Booker Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Booker Utilization</CardTitle>
            <CardDescription>Bookings and revenue per booker</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bookerData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#9333ea" name="Bookings" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
