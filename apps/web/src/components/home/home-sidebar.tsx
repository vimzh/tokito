import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarProfileCard } from "@/components/home/sidebar-profile-card";
import { WorkspaceNavigation } from "@/components/home/workspace-navigation";
import { homeContent } from "@/data/home";

export function HomeSidebar({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="none" className="sticky top-0 h-svh w-40 shrink-0 border-r sm:w-(--sidebar-width)">
        <SidebarHeader className="p-5">
          <Link href="/" aria-label={homeContent.sidebar.brand.homeLabel} className="flex min-h-11 items-center gap-3 font-medium">
            <Image src="/icon.svg" alt="" width={32} height={32} />
            {homeContent.sidebar.brand.name}
          </Link>
        </SidebarHeader>
        <SidebarContent><WorkspaceNavigation /></SidebarContent>
        <SidebarProfileCard />
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <div className="mx-auto w-full max-w-6xl space-y-8 p-5 sm:p-8 lg:p-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
