"use client"

import Link from "next/link"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import { LogIn, UserPlus, Package } from "lucide-react"

export default function LandingClient() {
  return (
    <Container>
      <BackgroundGlow />

      <Card>
        <LogoCircle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cbflogo.png" alt="CBF" />
        </LogoCircle>

        <BrandName>CBF</BrandName>
        <BrandSub>Almoxarifado</BrandSub>

        <Divider />

        <Description>
          <Package size={16} />
          Sistema interno de controle de estoque, empréstimos e movimentações.
        </Description>

        <Actions>
          <PrimaryLink href="/login">
            <LogIn size={16} />
            Entrar
          </PrimaryLink>
          <SecondaryLink href="/cadastro">
            <UserPlus size={16} />
            Solicitar acesso
          </SecondaryLink>
        </Actions>

        <Rodape>Acesso restrito a colaboradores autorizados.</Rodape>
      </Card>
    </Container>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const shimmer = keyframes`
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
`

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`

const glassCardStyles = `
  background: ${hexToRgba('#0a1628', 0.45)};
  border: 1px solid ${hexToRgba('#ffffff', 0.06)};
  border-radius: ${theme.radii.xl};
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
`

const Container = styled.main`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing[6]};
  overflow: hidden;

  background-image: linear-gradient(
      180deg,
      rgba(10, 22, 40, 0.72) 0%,
      rgba(10, 22, 40, 0.68) 50%,
      rgba(10, 22, 40, 0.78) 100%
    ),
    url("/BGA.png");
  background-size: cover;
  background-position: center 30%;
  background-repeat: no-repeat;
`

const BackgroundGlow = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 600px;
  height: 600px;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.12)} 0%,
    transparent 70%
  );
  pointer-events: none;
`

const Card = styled.section`
  position: relative;
  width: 100%;
  max-width: 420px;
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[10]} ${({ theme }) => theme.spacing[8]};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: ${fadeInUp} 0.4s ease both;
  transition: transform ${({ theme }) => theme.transitions.fast}, 
              box-shadow ${({ theme }) => theme.transitions.fast};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing[8]} ${({ theme }) => theme.spacing[6]};
    border-radius: ${({ theme }) => theme.radii.lg};
  }
`

const LogoCircle = styled.div`
  width: 84px;
  height: 84px;
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
  border: 2px solid ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.6)};
  box-shadow: ${({ theme }) => theme.shadows.lg},
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 0 32px ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.35)};
  margin-bottom: ${({ theme }) => theme.spacing[5]};
  transition: transform ${({ theme }) => theme.transitions.fast};

  &:hover {
    transform: scale(1.05);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const BrandName = styled.h1`
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  font-size: ${({ theme }) => theme.typography.fontSize["4xl"]};
  letter-spacing: 0.1em;
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

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
  }
`

const BrandSub = styled.span`
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: 2px;
`

const Divider = styled.div`
  width: 40px;
  height: 2px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.5)};
  margin: ${({ theme }) => theme.spacing[6]} 0;
`

const Description = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  max-width: 34ch;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};

  svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.accent.green};
  }
`

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing[6]};
`

const linkBaseStyles = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: ${theme.spacing[3]} ${theme.spacing[5]};
  border-radius: ${theme.radii.md};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  text-decoration: none;
  transition: all ${theme.transitions.fast};

  &:active {
    transform: translateY(1px);
  }
`

const PrimaryLink = styled(Link)`
  ${linkBaseStyles}
  background: ${({ theme }) => theme.colors.primary.vivid};
  color: ${({ theme }) => theme.colors.neutral.white};
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.15),
      transparent
    );
    transform: translateX(-100%);
    transition: transform 0.5s ease;
  }

  &:hover::after {
    transform: translateX(100%);
  }

  &:hover {
    background: ${({ theme }) => theme.colors.primary.deep};
    transform: translateY(-1px);
  }
`

const SecondaryLink = styled(Link)`
  ${linkBaseStyles}
  background: ${hexToRgba('#ffffff', 0.05)};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid ${hexToRgba('#ffffff', 0.08)};

  &:hover {
    background: ${hexToRgba('#ffffff', 0.1)};
    transform: translateY(-1px);
  }
`

const Rodape = styled.span`
  margin-top: ${({ theme }) => theme.spacing[6]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${hexToRgba('#ffffff', 0.4)};
`