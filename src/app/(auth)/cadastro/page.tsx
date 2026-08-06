"use client"

import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import dynamic from "next/dynamic"
import styled, { css, keyframes } from "styled-components"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Mail, Lock, User, AlertCircle, ArrowRight, Shield, 
  CheckCircle, Eye, EyeOff, LogIn, Building, Phone,
  Users, Package, ClipboardList, UserCheck
} from "lucide-react"
import { hexToRgba } from "@/styles/theme"

// Componente de fallback para carregamento
const LoadingFallback = () => (
  <div style={{ 
    minHeight: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: '#0a0f1e'
  }}>
    <div style={{ 
      width: 40, 
      height: 40, 
      border: '3px solid rgba(255,215,0,0.1)',
      borderTop: '3px solid #ffd700',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)

// Componente principal carregado dinamicamente sem SSR
const CadastroContent = dynamic(() => Promise.resolve(CadastroComponent), {
  ssr: false,
  loading: () => <LoadingFallback />
})

export default function CadastroPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CadastroContent />
    </Suspense>
  )
}

// Tipos baseados no schema (sem ADMIN)
type Role = "GESTOR" | "SUPERVISOR" | "ALMOXARIFE" | "SOLICITANTE"

interface RoleOption {
  value: Role
  label: string
  description: string
  icon: React.ReactNode
  color: string
  permissions: string[]
}

const roleOptions: RoleOption[] = [
  {
    value: "GESTOR",
    label: "Gestor",
    description: "Visualiza dashboards, relatórios e solicita materiais",
    icon: <Users size={18} />,
    color: "#3D7DFF",
    permissions: ["Dashboards", "Relatórios", "Solicitar materiais"]
  },
  {
    value: "SUPERVISOR",
    label: "Supervisor",
    description: "Aprova/rejeita solicitações de saída e empréstimo",
    icon: <UserCheck size={18} />,
    color: "#FFDC02",
    permissions: ["Aprovar solicitações", "Visualizar solicitações", "Gerenciar empréstimos"]
  },
  {
    value: "ALMOXARIFE",
    label: "Almoxarife",
    description: "Cadastra materiais, controla estoque e gerencia empréstimos",
    icon: <Package size={18} />,
    color: "#009C3B",
    permissions: ["Cadastrar materiais", "Controle de estoque", "Gerenciar empréstimos", "Preparar solicitações"]
  },
  {
    value: "SOLICITANTE",
    label: "Solicitante",
    description: "Solicita materiais e acompanha o status dos pedidos",
    icon: <ClipboardList size={18} />,
    color: "#60b8d4",
    permissions: ["Solicitar materiais", "Acompanhar pedidos", "Ver status", "Agendar retiradas"]
  }
]

function CadastroComponent() {
  const router = useRouter()

  const [formData, setFormData] = useState({
    nome: "",
    sobrenome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    setor: "",
    cargo: "",
    telefone: ""
  })
  const [selectedRole, setSelectedRole] = useState<Role>("SOLICITANTE")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Partículas fixas - mesmo padrão da página de login
  const particles = [
    { id: 1, size: 4, left: 10, top: 20, delay: 0, duration: 12 },
    { id: 2, size: 3, left: 25, top: 80, delay: 2, duration: 15 },
    { id: 3, size: 5, left: 40, top: 10, delay: 4, duration: 18 },
    { id: 4, size: 3, left: 55, top: 70, delay: 1, duration: 14 },
    { id: 5, size: 4, left: 70, top: 30, delay: 3, duration: 16 },
    { id: 6, size: 2, left: 85, top: 90, delay: 5, duration: 20 },
    { id: 7, size: 5, left: 15, top: 50, delay: 2.5, duration: 13 },
    { id: 8, size: 3, left: 45, top: 40, delay: 4.5, duration: 17 },
    { id: 9, size: 4, left: 65, top: 60, delay: 1.5, duration: 19 },
    { id: 10, size: 2, left: 90, top: 15, delay: 3.5, duration: 11 },
    { id: 11, size: 5, left: 5, top: 5, delay: 0.5, duration: 22 },
    { id: 12, size: 3, left: 35, top: 95, delay: 2.8, duration: 16 },
    { id: 13, size: 4, left: 75, top: 5, delay: 4.2, duration: 14 },
    { id: 14, size: 2, left: 50, top: 50, delay: 3.2, duration: 18 },
    { id: 15, size: 3, left: 20, top: 35, delay: 1.8, duration: 15 },
    { id: 16, size: 4, left: 60, top: 85, delay: 0.8, duration: 21 },
    { id: 17, size: 3, left: 30, top: 15, delay: 3.8, duration: 13 },
    { id: 18, size: 5, left: 80, top: 45, delay: 1.2, duration: 17 },
    { id: 19, size: 2, left: 45, top: 75, delay: 4.8, duration: 19 },
    { id: 20, size: 4, left: 10, top: 65, delay: 2.2, duration: 16 },
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (!formData.nome || !formData.sobrenome || !formData.email || !formData.senha || !formData.confirmarSenha) {
      setError("Preencha todos os campos obrigatórios.")
      return
    }

    if (formData.senha.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError("As senhas não coincidem.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome,
          sobrenome: formData.sobrenome,
          email: formData.email,
          senha: formData.senha,
          setor: formData.setor,
          cargo: formData.cargo,
          telefone: formData.telefone,
          role: selectedRole,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao criar conta.")
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageRoot>
      <BackgroundImage />
      <Overlay />

      {/* Partículas - com visibilidade aumentada */}
      <ParticlesContainer>
        {particles.map((p) => (
          <Particle
            key={p.id}
            style={{
              width: p.size + 'px',
              height: p.size + 'px',
              left: p.left + '%',
              top: p.top + '%',
              animationDelay: p.delay + 's',
              animationDuration: p.duration + 's',
              opacity: 0.6,
              boxShadow: `0 0 ${p.size * 3}px ${p.size}px rgba(255, 215, 0, 0.3),
                          0 0 ${p.size * 6}px ${p.size * 2}px rgba(255, 200, 0, 0.15)`,
            }}
          />
        ))}
      </ParticlesContainer>

      <Wrapper>
        <GlassCard>
          <LogoWrapper>
            <Image
              src="/cbflogo.png"
              alt="CBF Logo"
              width={100}
              height={100}
              priority
              className="logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                padding: '8px'
              }}
            />
          </LogoWrapper>

          <CardHeader>
            <BrandTitle>CBF Almoxarifado</BrandTitle>
            <CardTitle>
              Criar <span>conta</span>
            </CardTitle>
            <CardSub>Cadastre-se para acessar o sistema</CardSub>
          </CardHeader>

          <Divider />

          <AnimatePresence mode="wait">
            {error && (
              <ErrorBanner
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              >
                <AlertCircle size={14} strokeWidth={2} />
                <span>{error}</span>
              </ErrorBanner>
            )}
            {success && (
              <SuccessBanner
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              >
                <CheckCircle size={14} strokeWidth={2} />
                <span>Conta criada com sucesso! Redirecionando...</span>
              </SuccessBanner>
            )}
          </AnimatePresence>

          <Form onSubmit={handleSubmit}>
            <Field>
              <FieldLabel>
                <User size={13} />
                Nome *
              </FieldLabel>
              <FieldInput
                id="nome"
                type="text"
                placeholder="Seu nome"
                value={formData.nome}
                onChange={handleChange}
                $error={!!error}
              />
            </Field>

            <Field>
              <FieldLabel>
                <User size={13} />
                Sobrenome *
              </FieldLabel>
              <FieldInput
                id="sobrenome"
                type="text"
                placeholder="Seu sobrenome"
                value={formData.sobrenome}
                onChange={handleChange}
                $error={!!error}
              />
            </Field>

            <Field>
              <FieldLabel>
                <Mail size={13} />
                E-mail *
              </FieldLabel>
              <FieldInput
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleChange}
                $error={!!error}
                autoComplete="email"
              />
            </Field>

            <Field>
              <FieldLabel>
                <Building size={13} />
                Setor / Departamento
              </FieldLabel>
              <FieldInput
                id="setor"
                type="text"
                placeholder="Ex: Engenharia, Manutenção, RH..."
                value={formData.setor}
                onChange={handleChange}
              />
            </Field>

            <Field>
              <FieldLabel>
                <User size={13} />
                Cargo / Função
              </FieldLabel>
              <FieldInput
                id="cargo"
                type="text"
                placeholder="Ex: Técnico, Analista, Coordenador..."
                value={formData.cargo}
                onChange={handleChange}
              />
            </Field>

            <Field>
              <FieldLabel>
                <Phone size={13} />
                Telefone / Ramal
              </FieldLabel>
              <FieldInput
                id="telefone"
                type="text"
                placeholder="(11) 99999-9999"
                value={formData.telefone}
                onChange={handleChange}
              />
            </Field>

            <Field>
              <FieldLabel>
                <Lock size={13} />
                Senha *
              </FieldLabel>
              <PasswordWrap>
                <FieldInput
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={handleChange}
                  $error={!!error}
                  $hasIcon
                  autoComplete="new-password"
                />
                <TogglePass
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </TogglePass>
              </PasswordWrap>
            </Field>

            <Field>
              <FieldLabel>
                <Lock size={13} />
                Confirmar senha *
              </FieldLabel>
              <PasswordWrap>
                <FieldInput
                  id="confirmarSenha"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Digite novamente"
                  value={formData.confirmarSenha}
                  onChange={handleChange}
                  $error={!!error}
                  $hasIcon
                  autoComplete="new-password"
                />
                <TogglePass
                  type="button"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </TogglePass>
              </PasswordWrap>
            </Field>

            <Field>
              <FieldLabel>
                <Shield size={13} />
                Nível de acesso *
              </FieldLabel>
              <RoleGrid>
                {roleOptions.map((role) => (
                  <RoleCard
                    key={role.value}
                    $selected={selectedRole === role.value}
                    $color={role.color}
                    onClick={() => setSelectedRole(role.value)}
                    type="button"
                  >
                    <RoleIcon $color={role.color}>{role.icon}</RoleIcon>
                    <RoleName>{role.label}</RoleName>
                    <RoleDescription>{role.description}</RoleDescription>
                    {selectedRole === role.value && (
                      <RoleCheck>
                        <CheckCircle size={14} />
                      </RoleCheck>
                    )}
                  </RoleCard>
                ))}
              </RoleGrid>
            </Field>

            <SubmitBtn type="submit" disabled={loading || success}>
              {loading ? (
                <LoadingDots>
                  <span />
                  <span />
                  <span />
                </LoadingDots>
              ) : (
                <>
                  <LogIn size={15} />
                  Cadastrar
                  <ArrowRight size={15} />
                </>
              )}
            </SubmitBtn>
          </Form>

          <FooterNote>
            <Shield size={11} />
            Acesso restrito à equipe autorizada
          </FooterNote>

          <RegisterRow>
            <RegisterLabel>Já tem conta?</RegisterLabel>
            <RegisterLink href="/login">
              Entrar <ArrowRight size={12} />
            </RegisterLink>
          </RegisterRow>
        </GlassCard>
      </Wrapper>
    </PageRoot>
  )
}

/* ---------------------------------- */
/* ANIMAÇÕES                          */
/* ---------------------------------- */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
`

const glowPulse = keyframes`
  0%, 100% { 
    box-shadow: 0 0 20px 4px rgba(255, 215, 0, 0.08),
                0 0 40px 8px rgba(255, 215, 0, 0.02); 
  }
  50% { 
    box-shadow: 0 0 30px 6px rgba(255, 215, 0, 0.15),
                0 0 60px 12px rgba(255, 215, 0, 0.04); 
  }
`

const float = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20px, -30px) scale(1.2); }
  50% { transform: translate(-15px, 15px) scale(0.8); }
  75% { transform: translate(25px, 20px) scale(1.1); }
`

const loadingDotBounce = keyframes`
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40%           { transform: scale(1); opacity: 1; }
`

/* ---------------------------------- */
/* ESTILOS                            */
/* ---------------------------------- */

const PageRoot = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: ${({ theme }) => theme.spacing[4]};
  background: ${({ theme }) => theme.colors.surface.background};
  overflow: hidden;
`

const BackgroundImage = styled.div`
  position: fixed;
  inset: 0;
  background-image: url('/BGA.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
  
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      rgba(6, 13, 31, 0.15) 0%,
      rgba(6, 13, 31, 0.7) 100%
    );
  }
`

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.surface.overlay};
  z-index: 1;
`

const ParticlesContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
`

const Particle = styled.div`
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 215, 0, 0.8) 0%,
    rgba(255, 200, 0, 0.6) 30%,
    rgba(255, 180, 0, 0.3) 60%,
    transparent 80%
  );
  animation: ${float} ease-in-out infinite;
  backdrop-filter: blur(4px);
  transition: all 0.3s ease;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle at center,
      rgba(255, 215, 0, 0.2) 0%,
      transparent 70%
    );
    animation: ${glowPulse} 3s ease-in-out infinite;
  }
`

const Wrapper = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${fadeUp} 500ms ease both;
  width: 100%;
  max-width: 460px;
`

const GlassCard = styled.div`
  width: 100%;
  background: ${({ theme }) => theme.colors.surface.card};
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii["2xl"]};
  padding: ${({ theme }) => `${theme.spacing[6]} ${theme.spacing[6]} ${theme.spacing[5]}`};
  box-shadow: ${({ theme }) => theme.shadows.xl},
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  position: relative;
  overflow: hidden;
  max-height: 90vh;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.3)};
    border-radius: ${({ theme }) => theme.radii.full};
  }

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle at 30% 30%,
      ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.03)} 0%,
      transparent 60%
    );
    pointer-events: none;
  }
`

const LogoWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing[4]};
  width: 100px;
  height: 100px;
  margin-left: auto;
  margin-right: auto;

  .logo {
    border-radius: ${({ theme }) => theme.radii.full};
    background: ${({ theme }) => hexToRgba(theme.colors.surface.background, 0.5)};
    padding: ${({ theme }) => theme.spacing[2]};
    border: 2px solid ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.2)};
    animation: ${glowPulse} 3s ease-in-out infinite;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

const CardHeader = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`

const BrandTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize["2xl"]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  color: ${({ theme }) => theme.colors.text.primary};
  letter-spacing: -0.02em;
  margin-bottom: ${({ theme }) => theme.spacing[1]};
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
  position: relative;
  display: inline-block;
  width: 100%;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 50px;
    height: 2.5px;
    background: linear-gradient(
      90deg,
      ${({ theme }) => theme.colors.accent.green},
      ${({ theme }) => theme.colors.accent.yellow}
    );
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

const CardTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-top: ${({ theme }) => theme.spacing[2]};

  span {
    background: linear-gradient(
      90deg,
      ${({ theme }) => theme.colors.accent.green},
      ${({ theme }) => theme.colors.accent.yellow},
      ${({ theme }) => theme.colors.accent.green}
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: ${shimmer} 3s linear infinite;
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
`

const CardSub = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: ${({ theme }) => theme.spacing[0]};
`

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.surface.border};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const FieldLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.08em;

  svg {
    opacity: 0.5;
  }
`

const FieldInput = styled.input<{ $error?: boolean; $hasIcon?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  padding-right: ${({ $hasIcon }) => ($hasIcon ? "36px" : "12px")};
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1.5px solid
    ${({ $error, theme }) =>
      $error ? theme.colors.status.error : hexToRgba(theme.colors.accent.green, 0.15)};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  outline: none;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:focus {
    border-color: ${({ $error, theme }) =>
      $error ? theme.colors.status.error : theme.colors.accent.green};
    box-shadow: 0 0 0 3px
      ${({ $error, theme }) =>
        $error
          ? theme.colors.status.errorBg
          : hexToRgba(theme.colors.accent.green, 0.1)};
    background: rgba(255, 255, 255, 0.07);
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  }
`

const PasswordWrap = styled.div`
  position: relative;
`

const TogglePass = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.colors.text.muted};
  display: flex;
  align-items: center;

  &:hover {
    color: ${({ theme }) => theme.colors.text.secondary};
  }
`

const ErrorBanner = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  overflow: hidden;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.status.errorBg};
  border: 1px solid ${({ theme }) => theme.colors.status.errorBorder};
  color: ${({ theme }) => theme.colors.status.error};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};

  svg {
    flex-shrink: 0;
  }
`

const SuccessBanner = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  overflow: hidden;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.status.successBg};
  border: 1px solid ${({ theme }) => theme.colors.status.successBorder};
  color: ${({ theme }) => theme.colors.status.success};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};

  svg {
    flex-shrink: 0;
  }
`

const RoleGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
`

const RoleCard = styled.button<{ $selected: boolean; $color: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  padding: 12px 8px;
  background: ${({ $selected, theme }) => 
    $selected ? hexToRgba(theme.colors.surface.background, 0.4) : theme.colors.surface.glass
  };
  border: 1.5px solid ${({ $selected, $color }) => 
    $selected ? $color : 'rgba(255,255,255,0.06)'
  };
  border-radius: ${({ theme }) => theme.radii.md};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  position: relative;

  &:hover {
    background: ${({ theme }) => hexToRgba(theme.colors.surface.background, 0.3)};
    transform: translateY(-1px);
  }

  ${({ $selected, $color }) => $selected && css`
    box-shadow: 0 0 20px ${hexToRgba($color, 0.15)};
  `}
`

const RoleIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ $color }) => hexToRgba($color, 0.15)};
  color: ${({ $color }) => $color};
`

const RoleName = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`

const RoleDescription = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  line-height: 1.3;
`

const RoleCheck = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
  color: ${({ theme }) => theme.colors.accent.green};
`

const LoadingDots = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;

  span {
    width: 6px;
    height: 6px;
    border-radius: ${({ theme }) => theme.radii.full};
    background: ${({ theme }) => theme.colors.neutral.white};
    display: block;
    animation: ${loadingDotBounce} 1.2s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
`

const SubmitBtn = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  width: 100%;
  padding: 10px 16px;
  background: linear-gradient(
    135deg,
    ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.9)},
    ${({ theme }) => theme.colors.accent.green}
  );
  border: 1px solid ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.5)};
  color: ${({ theme }) => theme.colors.neutral.white};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  box-shadow: 0 4px 16px ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.2)};
  transition: all ${({ theme }) => theme.transitions.base};
  margin-top: ${({ theme }) => theme.spacing[1]};
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle at center,
      rgba(255, 255, 255, 0.15) 0%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity ${({ theme }) => theme.transitions.base};
  }

  &:hover:not(:disabled)::before {
    opacity: 1;
  }

  &:hover:not(:disabled) {
    box-shadow: 0 6px 24px ${({ theme }) => hexToRgba(theme.colors.accent.green, 0.3)};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    justify-content: center;
  }

  &:not(:disabled) {
    justify-content: flex-start;
  }

  svg:last-child {
    margin-left: auto;
  }
`

const RegisterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[1]};
  margin-top: ${({ theme }) => theme.spacing[4]};
`

const RegisterLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const RegisterLink = styled.a`
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.link};
  transition: all ${({ theme }) => theme.transitions.fast};
  cursor: pointer;

  &:hover {
    opacity: 0.8;
    color: ${({ theme }) => theme.colors.text.linkHover};
    transform: translateX(2px);
  }
`

const FooterNote = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: ${({ theme }) => theme.spacing[3]};
  opacity: 0.5;
`