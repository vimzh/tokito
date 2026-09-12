"use client";

import AeroShards from "@/components/AeroShards";

export function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-70">
      <AeroShards
        backgroundColor="#f8f8f6"
        shardColor="#d97757"
        accentColor="#d97757"
        placement="center"
        flow="ribbon"
        speed={0.7}
        density={1.2}
        bloom={0.3}
        glow={0.6}
        grain={0}
        chromaticAberration={0}
        interaction="none"
        onError={(error) => console.error("Hero AeroShards rendering failed:", error)}
      />
    </div>
  );
}
