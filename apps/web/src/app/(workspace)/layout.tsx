import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HomeSidebar } from "@/components/home/home-sidebar";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  if (!(await auth())?.user) redirect("/");
  return <HomeSidebar>{children}</HomeSidebar>;
}
