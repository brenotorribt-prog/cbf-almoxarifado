"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import styled, { keyframes, css, createGlobalStyle } from "styled-components"
import { LogIn, UserPlus, Package, Shield, BarChart3, Boxes, ArrowRight, ChevronDown, Lock, Zap, Users } from "lucide-react"

export default function LandingClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isLoaded, setIsLoaded] = useState(false)

  // Canvas particle network
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      opacity: number
    }> = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const PARTICLE_COUNT = 60
    const CONNECTION_DISTANCE = 150
    const MAX_CONNECTIONS = 3

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p, i) => {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(25, 174, 71, ${p.opacity})`
        ctx.fill()

        let connections = 0
        for (let j = i + 1; j < particles.length && connections < MAX_CONNECTIONS; j++) {
          const dx = particles[j].x - p.x
          const dy = particles[j].y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.15
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(25, 174, 71, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
            connections++
          }
        }
      })

      animationId = requestAnimationFrame(draw)
    }

    draw()
    setIsLoaded(true)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  // Mouse parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      })
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  const features = [
    {
      icon: <Boxes size={24} />,
      title: "Controle Total",
      desc: "Gestão completa de itens, categorias e localizações no almoxarifado.",
    },
    {
      icon: <BarChart3 size={24} />,
      title: "Relatórios em Tempo Real",
      desc: "Dashboards interativos com métricas de movimentação e estoque.",
    },
    {
      icon: <Shield size={24} />,
      title: "Segurança Garantida",
      desc: "Autenticação robusta e controle de acesso por níveis de permissão.",
    },
    {
      icon: <Zap size={24} />,
      title: "Empréstimos Ágeis",
      desc: "Fluxo simplificado de retirada e devolução com notificações automáticas.",
    },
    {
      icon: <Users size={24} />,
      title: "Multiusuário",
      desc: "Suporte a múltiplos colaboradores com rastreamento de atividades.",
    },
    {
      icon: <Lock size={24} />,
      title: "Auditoria Completa",
      desc: "Histórico detalhado de todas as movimentações e alterações.",
    },
  ]

  return (
    <>
      <GlobalStyles />
      
      {/* Background com imagem e overlay */}
      <BackgroundContainer>
        <Canvas ref={canvasRef} />
      </BackgroundContainer>

      <Page>
        {/* HERO SECTION */}
        <HeroSection>
          <HeroGlow $mouseX={mousePos.x} $mouseY={mousePos.y} />

          <HeroContent $loaded={isLoaded}>
            <Badge>
              <Package size={14} />
              Sistema Interno de Almoxarifado
            </Badge>

            <HeroTitle>
              <TitleLine>
                <GradientText>Orbit</GradientText>
              </TitleLine>
              <TitleLine $delay={0.1}>
                Almoxarifado
              </TitleLine>
            </HeroTitle>

            <HeroSubtitle>
              Controle inteligente de estoque, empréstimos e movimentações
              para colaboradores autorizados.
            </HeroSubtitle>

            <HeroActions>
              <PrimaryButton href="/login">
                <LogIn size={18} />
                Acessar Sistema
                <ArrowRight size={16} />
              </PrimaryButton>
              <SecondaryButton href="/cadastro">
                <UserPlus size={18} />
                Solicitar Acesso
              </SecondaryButton>
            </HeroActions>
          </HeroContent>

          <ScrollIndicator>
            <ChevronDown size={20} />
          </ScrollIndicator>
        </HeroSection>

        {/* FEATURES SECTION */}
        <FeaturesSection>
          <SectionHeader>
            <SectionEyebrow>Funcionalidades</SectionEyebrow>
            <SectionTitle>Tudo que você precisa em um só lugar</SectionTitle>
            <SectionDesc>
              Uma plataforma completa para gerenciar todo o fluxo do almoxarifado
              com eficiência e precisão.
            </SectionDesc>
          </SectionHeader>

          <FeaturesGrid>
            {features.map((f, i) => (
              <FeatureCard key={i} $index={i}>
                <FeatureIcon>{f.icon}</FeatureIcon>
                <FeatureTitle>{f.title}</FeatureTitle>
                <FeatureDesc>{f.desc}</FeatureDesc>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </FeaturesSection>

        {/* CTA SECTION */}
        <CTASection>
          <CTAGlow />
          <CTAContent>
            <CTATitle>Pronto para começar?</CTATitle>
            <CTADesc>
              Acesso restrito a colaboradores autorizados.
              Entre com suas credenciais ou solicite acesso ao administrador.
            </CTADesc>
            <CTAActions>
              <CTAPrimary href="/login">
                <LogIn size={18} />
                Entrar no Sistema
              </CTAPrimary>
              <CTASecondary href="/cadastro">
                <UserPlus size={18} />
                Solicitar Acesso
              </CTASecondary>
            </CTAActions>
          </CTAContent>
        </CTASection>

        {/* FOOTER */}
        <Footer>
          <FooterContent>
            <FooterBrand>
              <FooterLogo>Orbit</FooterLogo>
              <FooterBrandText>Almoxarifado</FooterBrandText>
            </FooterBrand>
            <FooterCopy>
              © {new Date().getFullYear()} Orbit — Sistema Interno. Acesso restrito.
            </FooterCopy>
          </FooterContent>
        </Footer>
      </Page>
    </>
  )
}

// =====================================================================
// GLOBAL STYLES
// =====================================================================

const GlobalStyles = createGlobalStyle`
  :root {
    --font-space: "Space Grotesk", system-ui, sans-serif;
    --font-inter: "Inter", system-ui, sans-serif;
    --color-green: #19ae47;
    --color-green-dark: #148a38;
    --color-green-light: #1fc95a;
    --color-yellow: #facc15;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    margin: 0;
    padding: 0;
    background: #050a12;
    color: #e2e8f0;
    font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }

  ::selection {
    background: rgba(25, 174, 71, 0.3);
    color: #fff;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: #0a1628;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(25, 174, 71, 0.3);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(25, 174, 71, 0.5);
  }
`

// =====================================================================
// KEYFRAMES
// =====================================================================

const shimmer = keyframes`
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
`

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
`

const scrollBounce = keyframes`
  0%, 100% { transform: translateY(0); opacity: 0.6; }
  50% { transform: translateY(8px); opacity: 1; }
`

const glowPulse = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
`

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

// ---- Background Container com imagem ----
const BackgroundContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  
  /* Overlay gradiente escuro sobre a imagem */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(5, 10, 18, 0.88) 0%,
      rgba(5, 10, 18, 0.78) 40%,
      rgba(5, 10, 18, 0.88) 100%
    );
    z-index: 1;
  }
  
  /* Imagem de fundo — identidade configurável (R2 ou fallback neutro) */
  background-image: ${({ theme }) => `url("${theme.colors.brand.loginBackgroundUrl}")`};
  background-color: ${({ theme }) => theme.colors.surface.background};
  background-size: cover;
  background-position: center 30%;
  background-repeat: no-repeat;
  background-attachment: fixed;
`

// ---- Canvas (partículas sobre a imagem) ----
const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
`

// ---- Page Container ----
const Page = styled.main`
  position: relative;
  min-height: 100vh;
  z-index: 1;
  overflow-x: hidden;
`

// ---- Hero Section ----
const HeroSection = styled.section`
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  z-index: 1;
`

const HeroGlow = styled.div.attrs<{ $mouseX: number; $mouseY: number }>((props) => ({
  style: {
    transform: `translate(-50%, -50%) translate(${props.$mouseX}px, ${props.$mouseY}px)`,
  },
}))`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 800px;
  height: 800px;
  background: radial-gradient(
    circle,
    rgba(25, 174, 71, 0.08) 0%,
    rgba(20, 138, 56, 0.04) 30%,
    transparent 70%
  );
  pointer-events: none;
  animation: ${glowPulse} 4s ease-in-out infinite;
  transition: transform 0.3s ease-out;
`

const HeroContent = styled.div<{ $loaded: boolean }>`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 720px;
  opacity: ${p => (p.$loaded ? 1 : 0)};
  transition: opacity 0.8s ease;
`

const Badge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 100px;
  background: rgba(25, 174, 71, 0.1);
  border: 1px solid rgba(25, 174, 71, 0.2);
  color: #19ae47;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-bottom: 32px;
  animation: ${fadeInUp} 0.6s ease both;
  animation-delay: 0.1s;

  svg {
    flex-shrink: 0;
  }
`

const HeroTitle = styled.h1`
  margin: 0 0 20px 0;
  font-family: var(--font-space), system-ui, sans-serif;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
`

const TitleLine = styled.span<{ $delay?: number }>`
  display: block;
  font-size: clamp(48px, 10vw, 88px);
  animation: ${fadeInUp} 0.7s ease both;
  animation-delay: ${p => p.$delay || 0}s;
`

const GradientText = styled.span`
  background: linear-gradient(
    135deg,
    #19ae47 0%,
    #148a38 30%,
    #facc15 55%,
    #148a38 80%,
    #19ae47 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${shimmer} 4s linear infinite;
`

const HeroSubtitle = styled.p`
  font-size: clamp(16px, 2.5vw, 20px);
  line-height: 1.7;
  color: rgba(226, 232, 240, 0.7);
  max-width: 520px;
  margin: 0 0 40px 0;
  animation: ${fadeInUp} 0.6s ease both;
  animation-delay: 0.3s;
`

const HeroActions = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 24px;
  animation: ${fadeInUp} 0.6s ease both;
  animation-delay: 0.4s;
`

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:active {
    transform: scale(0.97);
  }
`

const PrimaryButton = styled(Link)`
  ${buttonBase}
  background: linear-gradient(135deg, #19ae47 0%, #148a38 100%);
  color: #fff;
  box-shadow:
    0 4px 20px rgba(25, 174, 71, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transform: translateX(-100%);
    transition: transform 0.6s ease;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 8px 30px rgba(25, 174, 71, 0.45),
      0 0 0 1px rgba(255, 255, 255, 0.15) inset;

    &::after {
      transform: translateX(100%);
    }
  }

  svg:last-child {
    transition: transform 0.25s ease;
  }

  &:hover svg:last-child {
    transform: translateX(3px);
  }
`

const SecondaryButton = styled(Link)`
  ${buttonBase}
  background: rgba(255, 255, 255, 0.05);
  color: rgba(226, 232, 240, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.02) inset;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }
`

// ---- Scroll Indicator ----
const ScrollIndicator = styled.div`
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(226, 232, 240, 0.3);
  animation: ${scrollBounce} 2s ease-in-out infinite;
`

// ---- Features Section ----
const FeaturesSection = styled.section`
  position: relative;
  z-index: 1;
  padding: 120px 24px;
  max-width: 1200px;
  margin: 0 auto;
`

const SectionHeader = styled.div`
  text-align: center;
  margin-bottom: 64px;
`

const SectionEyebrow = styled.span`
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #19ae47;
  margin-bottom: 16px;
`

const SectionTitle = styled.h2`
  font-family: var(--font-space), system-ui, sans-serif;
  font-size: clamp(28px, 5vw, 42px);
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 16px 0;
  letter-spacing: -0.02em;
  line-height: 1.2;
`

const SectionDesc = styled.p`
  font-size: 17px;
  color: rgba(226, 232, 240, 0.55);
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.6;
`

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const FeatureCard = styled.div<{ $index: number }>`
  position: relative;
  padding: 32px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${fadeInUp} 0.5s ease both;
  animation-delay: ${p => p.$index * 0.08}s;
  overflow: hidden;
  backdrop-filter: blur(4px);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(25, 174, 71, 0.3),
      transparent
    );
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(25, 174, 71, 0.2);
    transform: translateY(-4px);
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.3),
      0 0 60px rgba(25, 174, 71, 0.05);

    &::before {
      opacity: 1;
    }
  }
`

const FeatureIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(25, 174, 71, 0.12), rgba(20, 138, 56, 0.06));
  border: 1px solid rgba(25, 174, 71, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #19ae47;
  margin-bottom: 20px;
  transition: all 0.3s ease;

  ${FeatureCard}:hover & {
    background: linear-gradient(135deg, rgba(25, 174, 71, 0.2), rgba(20, 138, 56, 0.1));
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(25, 174, 71, 0.15);
  }
`

const FeatureTitle = styled.h3`
  font-family: var(--font-space), system-ui, sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0 0 10px 0;
`

const FeatureDesc = styled.p`
  font-size: 14px;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.5);
  margin: 0;
`

// ---- CTA Section ----
const CTASection = styled.section`
  position: relative;
  z-index: 1;
  padding: 100px 24px;
  display: flex;
  justify-content: center;
`

const CTAGlow = styled.div`
  position: absolute;
  width: 600px;
  height: 400px;
  background: radial-gradient(
    ellipse,
    rgba(25, 174, 71, 0.08) 0%,
    transparent 70%
  );
  pointer-events: none;
`

const CTAContent = styled.div`
  position: relative;
  text-align: center;
  max-width: 560px;
  padding: 56px 48px;
  border-radius: 24px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.01) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
`

const CTATitle = styled.h2`
  font-family: var(--font-space), system-ui, sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 12px 0;
  letter-spacing: -0.02em;
`

const CTADesc = styled.p`
  font-size: 15px;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.5);
  margin: 0 0 32px 0;
`

const CTAActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
`

const CTAPrimary = styled(Link)`
  ${buttonBase}
  background: linear-gradient(135deg, #19ae47 0%, #148a38 100%);
  color: #fff;
  box-shadow: 0 4px 20px rgba(25, 174, 71, 0.35);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(25, 174, 71, 0.45);
  }
`

const CTASecondary = styled(Link)`
  ${buttonBase}
  background: transparent;
  color: rgba(226, 232, 240, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }
`

// ---- Footer ----
const Footer = styled.footer`
  position: relative;
  z-index: 1;
  padding: 40px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
`

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;

  @media (max-width: 640px) {
    flex-direction: column;
    text-align: center;
  }
`

const FooterBrand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const FooterLogo = styled.span`
  font-family: var(--font-space), system-ui, sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #19ae47;
  letter-spacing: 0.05em;
`

const FooterBrandText = styled.span`
  font-size: 14px;
  color: rgba(226, 232, 240, 0.4);
`

const FooterCopy = styled.p`
  font-size: 13px;
  color: rgba(226, 232, 240, 0.3);
  margin: 0;
`