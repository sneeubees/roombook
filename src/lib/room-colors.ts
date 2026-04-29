// Distinct color palette for rooms on the calendar
// Each room gets a different color so they're easy to tell apart at a glance

export interface RoomColor {
  bg: string;        // background for booked slots (other users)
  bgMine: string;    // background for booked slots (current user — slightly darker)
  bgLight: string;   // very light background for available slots / calendar tint
  bgTint: string;    // medium-light background for today's cell highlight
  text: string;      // text color
  border: string;    // border color for "mine" indicator
  borderSoft: string; // softer border for calendar cell dividers
}

const PALETTE: RoomColor[] = [
  {
    bg: "bg-blue-300",
    bgMine: "bg-blue-500",
    bgLight: "bg-blue-50",
    bgTint: "bg-blue-100",
    text: "text-black",
    border: "border-blue-700",
    borderSoft: "border-blue-200",
  },
  {
    bg: "bg-emerald-300",
    bgMine: "bg-emerald-500",
    bgLight: "bg-emerald-50",
    bgTint: "bg-emerald-100",
    text: "text-black",
    border: "border-emerald-700",
    borderSoft: "border-emerald-200",
  },
  {
    bg: "bg-amber-300",
    bgMine: "bg-amber-500",
    bgLight: "bg-amber-50",
    bgTint: "bg-amber-100",
    text: "text-black",
    border: "border-amber-700",
    borderSoft: "border-amber-200",
  },
  {
    bg: "bg-pink-300",
    bgMine: "bg-pink-500",
    bgLight: "bg-pink-50",
    bgTint: "bg-pink-100",
    text: "text-black",
    border: "border-pink-700",
    borderSoft: "border-pink-200",
  },
  {
    bg: "bg-violet-300",
    bgMine: "bg-violet-500",
    bgLight: "bg-violet-50",
    bgTint: "bg-violet-100",
    text: "text-black",
    border: "border-violet-700",
    borderSoft: "border-violet-200",
  },
  {
    bg: "bg-cyan-300",
    bgMine: "bg-cyan-500",
    bgLight: "bg-cyan-50",
    bgTint: "bg-cyan-100",
    text: "text-black",
    border: "border-cyan-700",
    borderSoft: "border-cyan-200",
  },
  {
    bg: "bg-orange-300",
    bgMine: "bg-orange-500",
    bgLight: "bg-orange-50",
    bgTint: "bg-orange-100",
    text: "text-black",
    border: "border-orange-700",
    borderSoft: "border-orange-200",
  },
  {
    bg: "bg-lime-300",
    bgMine: "bg-lime-500",
    bgLight: "bg-lime-50",
    bgTint: "bg-lime-100",
    text: "text-black",
    border: "border-lime-700",
    borderSoft: "border-lime-200",
  },
];

export function getRoomColor(index: number): RoomColor {
  return PALETTE[index % PALETTE.length];
}
