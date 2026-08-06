"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"

interface SidebarContextValue {
  collapsed: boolean
  toggleCollapsed: () => void
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // fecha o drawer mobile sempre que a rota muda
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // trava o scroll do body enquanto o drawer mobile está aberto
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggleCollapsed: () => setCollapsed((v) => !v),
        mobileOpen,
        openMobile: () => setMobileOpen(true),
        closeMobile: () => setMobileOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebar precisa ser usado dentro de um <SidebarProvider>")
  }
  return ctx
}