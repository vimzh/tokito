"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Plug, Settings } from "lucide-react";
import { SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { homeContent } from "@/data/home";

const icons = [House, Plug, Settings];

export function WorkspaceNavigation() {
  const pathname = usePathname();
  return (
    <SidebarGroup>
      <nav aria-label={homeContent.sidebar.label}>
        <SidebarMenu>
          {homeContent.navigation.map((item, index) => {
            const Icon = icons[index];
            const active = pathname === item.href || (item.href === "/home" && pathname.startsWith("/survey/"));
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    <Icon aria-hidden="true" /><span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </nav>
    </SidebarGroup>
  );
}
