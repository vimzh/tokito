"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the server page on an interval while outreach is active, so counts and calls stay current.
export function LiveRefresh({ active, seconds = 15 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [active, seconds, router]);
  return null;
}
