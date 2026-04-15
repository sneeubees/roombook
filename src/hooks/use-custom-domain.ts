"use client";

import { useMemo } from "react";

const MAIN_DOMAINS = ["roombook.co.za", "www.roombook.co.za", "localhost"];

export function useCustomDomain() {
  const customDomain = useMemo(() => {
    if (typeof window === "undefined") return null;

    const hostname = window.location.hostname;
    const isCustom = !MAIN_DOMAINS.some(
      (d) => hostname === d || hostname.includes("localhost")
    );

    return isCustom ? hostname : null;
  }, []);

  return {
    isCustomDomain: !!customDomain,
    customDomain,
  };
}
