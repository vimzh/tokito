import { LandingHero } from "@/components/landing/landing-hero";
import { UseCases } from "@/components/landing/use-cases";
import { Features } from "@/components/landing/features";
import { Connections } from "@/components/landing/connections";

export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <UseCases />
      <Features />
      <Connections />
    </>
  );
}
