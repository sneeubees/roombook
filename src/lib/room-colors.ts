// Distinct color palette for rooms on the calendar
// Each room gets a different color so they're easy to tell apart at a glance

export interface RoomColor {
  bg: string;        // background for booked slots (other users)
  bgMine: string;    // background for booked slots (current user — slightly darker)
  bgLight: string;   // light background for available slots
  text: string;      // text color
  border: string;    // border color for "mine" indicator
}

const PALETTE: RoomColor[] = [
  {
    bg: "bg-blue-300",
    bgMine: "bg-blue-500",
    bgLight: "bg-blue-50",
    text: "text-blue-900",
    border: "border-blue-700",
  },
  {
    bg: "bg-emerald-300",
    bgMine: "bg-emerald-500",
    bgLight: "bg-emerald-50",
    text: "text-emerald-900",
    border: "border-emerald-700",
  },
  {
    bg: "bg-amber-300",
    bgMine: "bg-amber-500",
    bgLight: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-700",
  },
  {
    bg: "bg-pink-300",
    bgMine: "bg-pink-500",
    bgLight: "bg-pink-50",
    text: "text-pink-900",
    border: "border-pink-700",
  },
  {
    bg: "bg-violet-300",
    bgMine: "bg-violet-500",
    bgLight: "bg-violet-50",
    text: "text-violet-900",
    border: "border-violet-700",
  },
  {
    bg: "bg-cyan-300",
    bgMine: "bg-cyan-500",
    bgLight: "bg-cyan-50",
    text: "text-cyan-900",
    border: "border-cyan-700",
  },
  {
    bg: "bg-orange-300",
    bgMine: "bg-orange-500",
    bgLight: "bg-orange-50",
    text: "text-orange-900",
    border: "border-orange-700",
  },
  {
    bg: "bg-lime-300",
    bgMine: "bg-lime-500",
    bgLight: "bg-lime-50",
    text: "text-lime-900",
    border: "border-lime-700",
  },
];

export function getRoomColor(index: number): RoomColor {
  return PALETTE[index % PALETTE.length];
}
