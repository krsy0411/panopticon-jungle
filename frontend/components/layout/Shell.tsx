"use client";

import { ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider className="h-svh">
      {/* Provider renders a flex container; keep Sidebar and Inset as siblings */}
      <AppSidebar />
      <SidebarInset className="h-svh overflow-auto">
        <header className="flex h-14 items-center gap-2 border-b bg-background px-4">
          {/* Sidebar is always visible; trigger removed */}
        </header>
        <main className="p-6 min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
