"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/client"
import styled, { css, keyframes, useTheme } from "styled-components"
import { motion, LayoutGroup } from "framer-motion"
import {
  LayoutDashboard,
  ArrowLeftRight,
  ClipboardList,
  Package,
  ShoppingCart,
  Tags,
  BarChart3,
  Settings,
  ChevronsLeft,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react"
import { hexToRgba } from "@/styles/theme"
import { useSidebar } from "./Sidebarcontext"
import { useCallback, useEffect, useRef, useState } from "react"
import ModalPerfil from "@/components/modalperfil"

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Movimentações", href: "/movimentacoes", icon: ArrowLeftRight },
  { label: "Requisições", href: "/requisicoes", icon: ClipboardList },
  { label: "Materiais", href: "/materiais", icon: Package },
  { label: "Compras", href: "/compras", icon: ShoppingCart },
  { label: "Categorias", href: "/categorias", icon: Tags },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
]

export interface SidebarUser {
  name: string
  role?: string
  avatarUrl?: string
}

interface SidebarProps {
  user?: SidebarUser
  onLogout?: () => void
}

// Mapa de role -> label em português
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  SUPERVISOR: "Supervisor",
  ALMOXARIFE: "Almoxarife",
  SOLICITANTE: "Solicitante",
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

// Perfil vindo de /api/perfil (Prisma) — Supabase só cuida de autenticação,
// não sabe nada sobre nome/role/avatar do negócio.
interface PerfilSidebar {
  nome: string
  sobrenome: string
  role: string
  image: string | null
}

export default function Sidebar({
  user = { name: "Usuário Convidado", role: "Almoxarife" },
  onLogout,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebar()
  const theme = useTheme()
  const [perfil, setPerfil] = useState<PerfilSidebar | null>(null)
  const [perfilAberto, setPerfilAberto] = useState(false)

  const [travellingIndex, setTravellingIndex] = useState<number | null>(null)
  const previousIndex = useRef(0)

  const carregarPerfil = useCallback(async () => {
    try {
      const res = await fetch("/api/perfil")
      if (!res.ok) return
      const data = await res.json()
      setPerfil(data.usuario)
    } catch {
      // Falha silenciosa aqui: o Sidebar cai no fallback `user` abaixo.
    }
  }, [])

  useEffect(() => {
    carregarPerfil()
  }, [carregarPerfil])

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`)

  const activeIndex = NAV_ITEMS.findIndex((item) =>
    isActive(item.href)
  )

  // Usuário exibido: prioriza o perfil real (Prisma), cai no prop `user` só
  // como fallback enquanto o perfil carrega (evita "flash" de usuário genérico)
  const usuarioExibido: SidebarUser = {
    name: perfil ? `${perfil.nome} ${perfil.sobrenome}`.trim() : user.name,
    role: perfil?.role ? ROLE_LABELS[perfil.role] ?? perfil.role : user.role,
    avatarUrl: perfil?.image ?? user.avatarUrl,
  }

  useEffect(() => {
    const from = previousIndex.current
    const to = activeIndex

    if (from === to || from === -1 || to === -1) return

    previousIndex.current = to

    const direction = from < to ? 1 : -1

    const timers: NodeJS.Timeout[] = []

    let delay = 0

    for (let i = from + direction; ; i += direction) {
      timers.push(
        setTimeout(() => {
          setTravellingIndex(i)
        }, delay)
      )

      if (i === to) break

      delay += 60
    }

    timers.push(
      setTimeout(() => {
        setTravellingIndex(null)
      }, delay + 300)
    )

    return () => timers.forEach(clearTimeout)
  }, [activeIndex])

  async function handleLogout() {
    if (onLogout) {
      onLogout()
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      <MobileTrigger type="button" aria-label="Abrir menu" onClick={openMobile}>
        <Menu size={22} strokeWidth={2} />
      </MobileTrigger>

      <Backdrop $open={mobileOpen} onClick={closeMobile} />

      <Aside $collapsed={collapsed} $mobileOpen={mobileOpen}>
        <SideGlow />

        <TopRow>
          <Brand>
            <LogoCircle>
              <img src="/cbflogo.png" alt="CBF" />
            </LogoCircle>
            <BrandText $collapsed={collapsed}>
              <BrandName>CBF</BrandName>
              <BrandSub>Almoxarifado</BrandSub>
            </BrandText>
          </Brand>

          <MobileCloseButton type="button" aria-label="Fechar menu" onClick={closeMobile}>
            <X size={20} strokeWidth={2} />
          </MobileCloseButton>
        </TopRow>

        <Nav>
          <LayoutGroup id="sidebar-navigation">
            <NavList>
              {NAV_ITEMS.map((item, index) => {
                const Icon = item.icon
                const active = isActive(item.href)
                const travelling = travellingIndex === index
                
                return (
                  <li key={item.href}>
                    <NavLink
                      href={item.href}
                      $active={active}
                      $collapsed={collapsed}
                      title={collapsed ? item.label : undefined}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    >
                      {active && (
                        <ActiveBackground
                          layoutId="sidebar-active-bg"
                          transition={{
                            layout: {
                              type: "spring",
                              stiffness: 520,
                              damping: 38,
                              mass: 0.7,
                            },
                          }}
                        />
                      )}

                      <ActiveBarWrapper>
                        {active && (
                          <ActiveBar
                            layoutId="sidebar-active-bar"
                            transition={{
                              layout: {
                                type: "spring",
                                stiffness: 520,
                                damping: 38,
                                mass: 0.7,
                              },
                            }}
                          />
                        )}
                      </ActiveBarWrapper>

                      <IconSlot
                        $active={active}
                        $collapsed={collapsed}
                        animate={{
                          scale: active
                            ? 1.1
                            : travelling
                            ? 1.15
                            : 1,
                          color: active
                            ? theme.colors.accent.yellow
                            : travelling
                            ? theme.colors.accent.yellow
                            : theme.colors.text.secondary,
                          filter: travelling
                            ? "drop-shadow(0 0 12px rgba(255,220,80,.8))"
                            : active
                            ? "drop-shadow(0 0 8px rgba(255,220,80,.4))"
                            : "drop-shadow(0 0 0px rgba(0,0,0,0))",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 24,
                          duration: 0.3,
                        }}
                      >
                        <Icon size={19} strokeWidth={active ? 2.25 : 1.9} />
                      </IconSlot>

                      <NavLabel
                        $collapsed={collapsed}
                        animate={{
                          opacity: collapsed ? 0 : 1,
                          scale: active
                            ? 1.03
                            : travelling
                            ? 1.05
                            : 1,
                          color: active
                            ? theme.colors.text.primary
                            : travelling
                            ? theme.colors.accent.yellow
                            : theme.colors.text.secondary,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 24,
                          duration: 0.3,
                        }}
                      >
                        {item.label}
                      </NavLabel>
                    </NavLink>
                  </li>
                )
              })}
            </NavList>
          </LayoutGroup>

          <ToggleWrapper>
            <ToggleButton
              type="button"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              $collapsed={collapsed}
              onClick={toggleCollapsed}
            >
              <ChevronsLeft size={15} strokeWidth={2} />
            </ToggleButton>
          </ToggleWrapper>
        </Nav>

        <BottomSection>
          <ProfileRow
            $collapsed={collapsed}
            onClick={() => setPerfilAberto(true)}
            style={{ cursor: "pointer" }}
          >
            <Avatar>
              {usuarioExibido.avatarUrl ? (
                <img src={usuarioExibido.avatarUrl} alt={usuarioExibido.name} />
              ) : (
                <span>{getInitials(usuarioExibido.name)}</span>
              )}
            </Avatar>

            {!collapsed && (
              <ProfileInfo>
                <ProfileName title={usuarioExibido.name}>{usuarioExibido.name}</ProfileName>
                {usuarioExibido.role && <ProfileRole title={usuarioExibido.role}>{usuarioExibido.role}</ProfileRole>}
              </ProfileInfo>
            )}

            <LogoutButton
              type="button"
              aria-label="Sair"
              title="Sair"
              onClick={(e) => {
                e.stopPropagation() // impede que o clique também abra o modal de perfil
                handleLogout()
              }}
            >
              <LogOut size={16} strokeWidth={2} />
            </LogoutButton>
          </ProfileRow>
        </BottomSection>
      </Aside>

      {perfilAberto && (
        <ModalPerfil
          onClose={() => setPerfilAberto(false)}
          onProfileUpdated={carregarPerfil}
        />
      )}
    </>
  )
}

/* ---------------------------------- */
/* estilos                            */
/* ---------------------------------- */

const shimmer = keyframes`
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
`

const flow = keyframes`
  0% { background-position: 0% 0%; }
  100% { background-position: 0% 200%; }
`

const Aside = styled.aside<{ $collapsed: boolean; $mobileOpen: boolean }>`
  position: fixed;
  inset: 0 auto 0 0;

  display: flex;
  flex-direction: column;

  width: ${({ theme, $collapsed }) =>
    $collapsed ? theme.layout.sidebarCollapsed : theme.layout.sidebarWidth};

  overflow: hidden;

  transition: width ${({ theme }) => theme.transitions.base};

  border-right: 1px solid rgba(255,255,255,.08);

  box-shadow: ${({ theme }) => theme.shadows.sidebar};

  z-index: ${({ theme }) => theme.zIndex.overlay};

  background-image:
  linear-gradient(
    180deg,
    rgba(10,22,40,.60) 0%,
    rgba(10,22,40,.58) 50%,
    rgba(10,22,40,.68) 100%
  ),
  url("/BGSB.png");

  background-size: cover;
  background-position: center 30%;
  background-repeat: no-repeat;

  & > * {
    position: relative;
    z-index: 2;
  }

  @media (max-width:${({ theme }) => theme.breakpoints.md}) {
    width:${({ theme }) => theme.layout.sidebarWidth};

    transform:translateX(${({ $mobileOpen }) =>
      $mobileOpen ? "0" : "-100%"});

    transition:transform ${({ theme }) => theme.transitions.base};

    z-index:${({ theme }) => theme.zIndex.modal};
  }
`

const SideGlow = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    ${({ theme }) => theme.colors.accent.green} 0%,
    ${({ theme }) => theme.colors.accent.yellow} 25%,
    ${({ theme }) => theme.colors.accent.green} 50%,
    ${({ theme }) => theme.colors.accent.yellow} 75%,
    ${({ theme }) => theme.colors.accent.green} 100%
  );
  background-size: 100% 200%;
  animation: ${flow} 6s linear infinite;
  box-shadow: 0 0 8px ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.35)},
    0 0 8px ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.3)};
  pointer-events: none;
  z-index: 2;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Backdrop = styled.div<{ $open: boolean }>`
  display: none;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: block;
    position: fixed;
    inset: 0;
    background: ${({ theme }) => theme.colors.surface.overlay};
    opacity: ${({ $open }) => ($open ? 1 : 0)};
    pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
    transition: opacity ${({ theme }) => theme.transitions.base};
    z-index: ${({ theme }) => theme.zIndex.overlay};
  }
`

const MobileTrigger = styled.button`
  display: none;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 14px;
    left: 14px;
    width: 40px;
    height: 40px;
    border-radius: ${({ theme }) => theme.radii.md};
    background: ${({ theme }) => hexToRgba(theme.colors.surface.sidebar, 0.7)};
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: ${({ theme }) => theme.colors.text.primary};
    box-shadow: ${({ theme }) => theme.shadows.md};
    z-index: ${({ theme }) => theme.zIndex.sticky};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surface.sidebarActive};
    }
  }
`

const MobileCloseButton = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.text.secondary};
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: ${({ theme }) => theme.colors.text.primary};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: inline-flex;
  }
`

const TopRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  height: calc(${({ theme }) => theme.layout.headerHeight} + 12px);
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.05) 0%,
    transparent 100%
  );
`

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  min-width: 0;
  flex: 1;
`

const LogoCircle = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.radii.full};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.accent.green},
    ${({ theme }) => theme.colors.accent.greenDark}
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 2px solid ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.6)};
  box-shadow: 
    ${({ theme }) => theme.shadows.md},
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 0 20px ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.3)};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
`

const BrandText = styled.div<{ $collapsed: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.1;
  opacity: ${({ $collapsed }) => ($collapsed ? 0 : 1)};
  width: ${({ $collapsed }) => ($collapsed ? 0 : "auto")};
  transition: opacity ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;
  overflow: hidden;
`

const BrandName = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  letter-spacing: 0.12em;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.accent.green} 0%,
    ${({ theme }) => theme.colors.accent.yellow} 50%,
    ${({ theme }) => theme.colors.accent.green} 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shimmer} 3s linear infinite;
  text-shadow: none;
  filter: drop-shadow(0 0 10px ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.3)});
`

const BrandSub = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text.muted};
  opacity: 0.8;
  margin-top: 1px;
`

const Nav = styled.nav`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[3]};
  position: relative;
  z-index: 1;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

const NavList = styled.ul`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
  margin: 0;
  padding: 0;
`

const NavLink = styled(motion.create(Link))<{ $active: boolean; $collapsed: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: 10px 22px 1fr;
  align-items: center;
  height: 42px;
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0 ${({ theme }) => theme.spacing[3]};
  text-decoration: none;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  overflow: visible;
  cursor: pointer;

  color: ${({ theme, $active }) =>
    $active ? theme.colors.text.primary : theme.colors.text.secondary};

  ${({ $collapsed }) =>
    $collapsed &&
    css`
      grid-template-columns: 10px 22px 0fr;
      padding: 0;
    `}
`

const ActiveBackground = styled(motion.div)`
  position: absolute;
  inset: 0;
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  z-index: 0;
  overflow: hidden;
`

const ActiveBarWrapper = styled.div`
  grid-column: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  position: relative;
  z-index: 1;
`

const ActiveBar = styled(motion.span)`
  width: 3px;
  height: 26px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    ${({ theme }) => theme.colors.accent.green},
    ${({ theme }) => theme.colors.accent.yellow}
  );
`

const IconSlot = styled(motion.span)<{ $active: boolean; $collapsed: boolean }>`
  grid-column: 2;
  justify-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  color: ${({ theme }) => theme.colors.text.secondary};
`

const NavLabel = styled(motion.span)<{ $collapsed: boolean }>`
  grid-column: 3;
  white-space: nowrap;
  overflow: hidden;
  position: relative;
  z-index: 2;
  font-weight: 500;
  opacity: ${({ $collapsed }) => ($collapsed ? 0 : 1)};
  padding-left: ${({ theme }) => theme.spacing[2]};
`

const ToggleWrapper = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[3]} 0;
  position: relative;
  z-index: 1;
`

const ToggleButton = styled.button<{ $collapsed: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.radii.full};
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: ${({ theme }) => theme.colors.text.muted};
  cursor: pointer;
  transition: background ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  svg {
    transition: transform ${({ theme }) => theme.transitions.base};
    transform: rotate(${({ $collapsed }) => ($collapsed ? "180deg" : "0deg")});
  }

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme.colors.text.primary};
  }
`

const BottomSection = styled.div`
  flex-shrink: 0;
  position: relative;
  z-index: 1;
`

const ProfileRow = styled.div<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  border-top: 1px solid rgba(255, 255, 255, 0.08);

  ${({ $collapsed }) =>
    $collapsed &&
    css`
      flex-direction: column;
      padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[2]};
      gap: ${({ theme }) => theme.spacing[2]};
    `}
`

const Avatar = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radii.full};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.primary.vivid},
    ${({ theme }) => theme.colors.primary.deep}
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  span {
    font-family: ${({ theme }) => theme.typography.fontFamily.sans};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`

const ProfileInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  line-height: 1.2;
`

const ProfileName = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ProfileRole = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const LogoutButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.radii.md};
  background: transparent;
  color: ${({ theme }) => theme.colors.text.secondary};
  cursor: pointer;
  transition: background ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.status.errorBg};
    color: ${({ theme }) => theme.colors.status.error};
  }
`