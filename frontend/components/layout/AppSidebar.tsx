"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Activity, BarChart3, BookOpen } from "lucide-react";

export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <Sidebar className="border-r bg-sidebar">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2 text-primary">
          <Activity className="h-5 w-5" />
          <div className="font-medium">Panopticon</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")}>
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>대시보드</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/logs")}>
                  <Link href="/logs" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>로그 뷰어</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar;
