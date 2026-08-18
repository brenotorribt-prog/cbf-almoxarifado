"use client"

import type { ReactNode } from "react"
import styled from "styled-components"
import Sidebar from "./SideBar"
import { SidebarProvider, useSidebar } from "./Sidebarcontext"

const Shell = styled.div`
  display: flex;
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.surface.background};
`

const Content = styled.main<{ $collapsed: boolean }>`
  flex: 1;
  min-width: 0;
  margin-left: ${({ theme, $collapsed }) =>
    $collapsed ? theme.layout.sidebarCollapsed : theme.layout.sidebarWidth};
  padding: ${({ theme }) => theme.layout.contentPadding};
  transition: margin-left ${({ theme }) => theme.transitions.base};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    margin-left: 0;
    /* espaço extra no topo pro botão hambúrguer não sobrepor o conteúdo */
    padding-top: calc(${({ theme }) => theme.layout.contentPadding} + 44px);
  }
`

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Shell>
        <Sidebar />
        <ContentInner>{children}</ContentInner>
      </Shell>
    </SidebarProvider>
  )
}

// Componente separado só pra consumir o useSidebar()
// (o Provider precisa ficar acima na árvore).
function ContentInner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()
  return <Content $collapsed={collapsed}>{children}</Content>
}