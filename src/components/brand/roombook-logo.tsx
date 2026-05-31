import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type RoomBookLogoProps = {
  href?: string;
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function RoomBookLogo({
  href,
  className,
  markClassName,
  textClassName,
}: RoomBookLogoProps) {
  const content = (
    <>
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-[13px]",
          "bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-700",
          "text-white shadow-[0_10px_24px_rgba(5,150,105,0.28),inset_0_1px_0_rgba(255,255,255,0.28)]",
          markClassName
        )}
      >
        <DoorOpen className="h-[22px] w-[22px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)]" />
      </span>
      <span
        className={cn(
          "font-sans text-2xl leading-none tracking-normal text-[#172033]",
          textClassName
        )}
      >
        <span className="font-medium">Room</span>
        <span className="font-bold">Book</span>
      </span>
    </>
  );

  const classes = cn("inline-flex items-center gap-3", className);

  if (href) {
    return (
      <Link href={href} className={classes} aria-label="RoomBook home">
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
