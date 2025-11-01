"use client";

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Activity, BarChart3, Bell, BookOpen, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/')
  return (
    <Sidebar className="border-r bg-sidebar">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2 text-primary">
          <Activity className="h-5 w-5" />
          <div className="font-medium">SRE Platform</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/dashboard')}>
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>대시보드</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/slo')}>
                  <Link href="/slo" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>SLO 설정</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/notifications')}>
                  <Link href="/notifications" className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <span>알림 설정</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/logs')}>
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
      <SidebarSeparator />
      <SidebarFooter className="px-3 py-3">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            if (typeof document !== 'undefined') {
              document.cookie = 'auth=; path=/; max-age=0'
            }
            router.push('/login')
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> 로그아웃
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
