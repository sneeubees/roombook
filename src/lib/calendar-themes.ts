export type CalendarThemeId = "ocean" | "forest" | "sunset" | "minimal";

export interface CalendarThemeColors {
  available: string;
  availableHover: string;
  availableText: string;
  mine: string;
  mineText: string;
  other: string;
  otherText: string;
  blocked: string;
  blockedText: string;
}

export interface CalendarTheme {
  id: CalendarThemeId;
  label: string;
  description: string;
  colors: CalendarThemeColors;
  // Preview swatches for the settings page
  swatches: string[];
}

export const CALENDAR_THEMES: Record<CalendarThemeId, CalendarTheme> = {
  ocean: {
    id: "ocean",
    label: "Ocean",
    description: "Cool blues and teals",
    colors: {
      available: "bg-sky-50",
      availableHover: "hover:bg-sky-100",
      availableText: "text-sky-700",
      mine: "bg-blue-200",
      mineText: "text-blue-800",
      other: "bg-slate-200",
      otherText: "text-slate-600",
      blocked: "bg-red-100",
      blockedText: "text-red-700",
    },
    swatches: ["#e0f2fe", "#bfdbfe", "#cbd5e1", "#fee2e2"],
  },
  forest: {
    id: "forest",
    label: "Forest",
    description: "Natural greens and earth tones",
    colors: {
      available: "bg-emerald-50",
      availableHover: "hover:bg-emerald-100",
      availableText: "text-emerald-700",
      mine: "bg-emerald-200",
      mineText: "text-emerald-800",
      other: "bg-amber-100",
      otherText: "text-amber-700",
      blocked: "bg-rose-100",
      blockedText: "text-rose-700",
    },
    swatches: ["#ecfdf5", "#a7f3d0", "#fef3c7", "#ffe4e6"],
  },
  sunset: {
    id: "sunset",
    label: "Sunset",
    description: "Warm oranges and purples",
    colors: {
      available: "bg-amber-50",
      availableHover: "hover:bg-amber-100",
      availableText: "text-amber-700",
      mine: "bg-violet-200",
      mineText: "text-violet-800",
      other: "bg-orange-100",
      otherText: "text-orange-700",
      blocked: "bg-red-100",
      blockedText: "text-red-700",
    },
    swatches: ["#fffbeb", "#ddd6fe", "#ffedd5", "#fee2e2"],
  },
  minimal: {
    id: "minimal",
    label: "Vivid",
    description: "Bright, bold colors that pop",
    colors: {
      available: "bg-lime-300",
      availableHover: "hover:bg-lime-400",
      availableText: "text-lime-900",
      mine: "bg-fuchsia-400",
      mineText: "text-fuchsia-950",
      other: "bg-orange-400",
      otherText: "text-orange-950",
      blocked: "bg-red-500",
      blockedText: "text-white",
    },
    swatches: ["#bef264", "#e879f9", "#fb923c", "#ef4444"],
  },
};

export function getThemeColors(themeId?: string): CalendarThemeColors {
  const id = (themeId ?? "ocean") as CalendarThemeId;
  return CALENDAR_THEMES[id]?.colors ?? CALENDAR_THEMES.ocean.colors;
}
