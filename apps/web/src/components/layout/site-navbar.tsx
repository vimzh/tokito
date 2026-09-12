import Link from "next/link";
import Image from "next/image";
import { AuthControl } from "@/components/auth/auth-control";
import { navigationContent } from "@/data/navigation";

export function SiteNavbar() {
  return (
    <nav
      aria-label={navigationContent.label}
      className="grid h-16 w-full grid-cols-[1fr_auto] items-center md:grid-cols-[1fr_auto_1fr]"
    >
      <Link
        aria-label={navigationContent.brand.homeLabel}
        className="flex min-h-11 w-fit items-center gap-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="/"
      >
        <Image src="/icon.svg" alt="" width={32} height={32} />
        <span>{navigationContent.brand.name}</span>
      </Link>

      <ul className="hidden items-center gap-8 text-sm md:flex">
        {navigationContent.links.map((link) => (
          <li key={link.label}>
            <Link
              className="flex min-h-11 items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={link.href}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="justify-self-end">
        <AuthControl />
      </div>
    </nav>
  );
}
