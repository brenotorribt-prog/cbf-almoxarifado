"use client"

/**
 * components/modalperfil.tsx
 * ------------------------------------------------------------------
 * Modal de perfil do usuário logado: nome, sobrenome, telefone (com
 * máscara), avatar e troca de senha (exige senha atual). Não edita
 * email nem role — isso fica de fora por ora.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import {
  X,
  Check,
  Loader2,
  Camera,
  AlertTriangle,
  Lock,
  User as UserIcon,
} from "lucide-react"
import { formatarTelefone } from "@/lib/telefone-mask"

// =====================================================================
// HELPERS — compressão de avatar (reaproveita a mesma técnica da foto de
// material, mas pula a compressão se o arquivo já for pequeno — abaixo
// de 1000KB não compensa gastar CPU do usuário recomprimindo)
// =====================================================================

const LIMITE_SEM_COMPRESSAO = 1000 * 1024 // 1000KB
const MAX_DIMENSAO_AVATAR = 800 // avatar é exibido pequeno, não precisa de 1600px
const QUALIDADE_JPEG = 0.85
const TAMANHO_MAXIMO_ORIGINAL = 15 * 1024 * 1024

function comprimirImagem(file: File, maxDimensao: number, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDimensao || height > maxDimensao) {
          const escala = maxDimensao / Math.max(width, height)
          width = Math.round(width * escala)
          height = Math.round(height * escala)
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem neste navegador."))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao comprimir a imagem."))),
          "image/jpeg",
          qualidade
        )
      }
      img.onerror = () => reject(new Error("Não foi possível ler essa imagem."))
      img.src = leitor.result as string
    }
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."))
    leitor.readAsDataURL(file)
  })
}

// Se já está pequeno, usa o arquivo original direto — evita gastar CPU
// comprimindo algo que já está abaixo do que a gente aceitaria de saída.
async function processarAvatar(file: File): Promise<Blob> {
  if (file.size <= LIMITE_SEM_COMPRESSAO) return file
  return comprimirImagem(file, MAX_DIMENSAO_AVATAR, QUALIDADE_JPEG)
}

function formatarKB(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`
}

function getInitials(nome: string, sobrenome: string) {
  return `${nome[0] ?? ""}${sobrenome[0] ?? ""}`.toUpperCase()
}

// =====================================================================
// TIPOS
// =====================================================================

interface PerfilUsuario {
  id: string
  nome: string
  sobrenome: string
  email: string
  telefone: string | null
  role: string
  image: string | null
}

interface ModalPerfilProps {
  onClose: () => void
}

// =====================================================================
// ANIMAÇÕES / LAYOUT
// =====================================================================

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`
const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`
const spin = keyframes`to { transform: rotate(360deg); }`
const pulse = keyframes`0%, 100% { opacity: 1; } 50% { opacity: 0.4; }`

const glassCardStyles = `
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.surface.border};
  border-radius: ${theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.card};
`

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.surface.overlay};
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${({ theme }) => theme.zIndex.modal};
  padding: ${({ theme }) => theme.spacing[4]};
  animation: ${fadeIn} 0.15s ease both;
`

const ModalCard = styled.form`
  ${glassCardStyles}
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[6]};
  animation: ${slideIn} 0.2s ease both;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

const ModalTopo = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
`

const FecharButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.text.secondary};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`

const AvatarSecao = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`

const AvatarPreviewWrapper = styled.button`
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: ${({ theme }) => theme.radii.full};
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.primary.vivid},
    ${({ theme }) => theme.colors.primary.deep}
  );
  border: 2px solid ${({ theme }) => theme.colors.surface.border};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const AvatarOverlayHover = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity ${({ theme }) => theme.transitions.fast};

  ${AvatarPreviewWrapper}:hover & {
    opacity: 1;
  }
`

const AvatarInfoTexto = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const InputFileOculto = styled.input`
  display: none;
`

const Secao = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const SecaoTitulo = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.text.muted};
  display: flex;
  align-items: center;
  gap: 6px;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.surface.border};
  }
`

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const Label = styled.label`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};
`

const inputBaseStyles = `
  ${glassCardStyles}
  background: ${theme.colors.surface.glass};
  padding: ${theme.spacing[3]};
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm};
  width: 100%;

  &::placeholder { color: ${theme.colors.text.muted}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`

const Input = styled.input`${inputBaseStyles}`

const InputSomenteLeitura = styled.input`
  ${inputBaseStyles}
  opacity: 0.6;
  cursor: not-allowed;
`

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.error};
`

const AvisoErro = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.status.errorBg};
  border: 1px solid ${({ theme }) => theme.colors.status.errorBorder};
  color: ${({ theme }) => theme.colors.status.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  svg { flex-shrink: 0; margin-top: 1px; }
`

const AvisoSucesso = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.status.successBg};
  border: 1px solid ${({ theme }) => theme.colors.status.successBorder};
  color: ${({ theme }) => theme.colors.status.success};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const SkeletonLinha = styled.div`
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface.glass};
  animation: ${pulse} 1.4s ease-in-out infinite;
`

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[3]};
  padding-top: ${({ theme }) => theme.spacing[3]};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
`

const ActionButton = styled.button<{ $variant: "primary" | "ghost" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};

  ${({ $variant, theme }) =>
    $variant === "primary" &&
    `
    background: ${theme.colors.primary.vivid};
    color: ${theme.colors.neutral.white};
    &:hover:not(:disabled) { background: ${theme.colors.primary.deep}; }
  `}
  ${({ $variant, theme }) =>
    $variant === "ghost" &&
    `
    background: transparent;
    color: ${theme.colors.text.secondary};
    border: 1px solid ${theme.colors.surface.border};
    &:hover:not(:disabled) { background: ${theme.colors.surface.glass}; color: ${theme.colors.text.primary}; }
  `}

  &:disabled { opacity: 0.6; cursor: not-allowed; }
  svg.spin { animation: ${spin} 0.7s linear infinite; }
`

// =====================================================================
// COMPONENTE
// =====================================================================

export default function ModalPerfil({ onClose }: ModalPerfilProps) {
  const { update: atualizarSessao } = useSession()

  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  const [nome, setNome] = useState("")
  const [sobrenome, setSobrenome] = useState("")
  const [telefone, setTelefone] = useState("")

  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("")

  const [avatarUrlAtual, setAvatarUrlAtual] = useState<string | null>(null)
  const [avatarRemovido, setAvatarRemovido] = useState(false)
  const [avatarBlobComprimido, setAvatarBlobComprimido] = useState<Blob | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [processandoAvatar, setProcessandoAvatar] = useState(false)
  const inputAvatarRef = useRef<HTMLInputElement>(null)

  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      try {
        const res = await fetch("/api/perfil")
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Falha ao carregar perfil")
        if (!ativo) return

        const usuario: PerfilUsuario = data.usuario
        setPerfil(usuario)
        setNome(usuario.nome)
        setSobrenome(usuario.sobrenome)
        setTelefone(usuario.telefone ? formatarTelefone(usuario.telefone) : "")
        setAvatarUrlAtual(usuario.image)
      } catch (err) {
        if (ativo) setErroGeral(err instanceof Error ? err.message : "Erro ao carregar perfil.")
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  const handleSelecionarAvatar = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const arquivo = e.target.files?.[0]
      e.target.value = ""
      if (!arquivo) return

      if (!arquivo.type.startsWith("image/")) {
        setErroGeral("Selecione um arquivo de imagem.")
        return
      }
      if (arquivo.size > TAMANHO_MAXIMO_ORIGINAL) {
        setErroGeral("Essa imagem é grande demais (máx. 15MB).")
        return
      }

      setErroGeral(null)
      setProcessandoAvatar(true)
      try {
        const blob = await processarAvatar(arquivo)
        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
        const novaUrl = URL.createObjectURL(blob)

        setAvatarBlobComprimido(blob)
        setAvatarPreviewUrl(novaUrl)
        setAvatarRemovido(false)
      } catch (err) {
        setErroGeral(err instanceof Error ? err.message : "Falha ao processar a imagem.")
      } finally {
        setProcessandoAvatar(false)
      }
    },
    [avatarPreviewUrl]
  )

  function removerAvatar() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarBlobComprimido(null)
    setAvatarPreviewUrl(null)
    setAvatarRemovido(true)
  }

  function validar(): boolean {
    const erros: Record<string, string> = {}

    if (nome.trim().length < 2) erros.nome = "Nome muito curto."
    if (sobrenome.trim().length < 1) erros.sobrenome = "Informe o sobrenome."

    const trocandoSenha = senhaAtual || novaSenha || confirmarNovaSenha
    if (trocandoSenha) {
      if (!senhaAtual) erros.senhaAtual = "Informe a senha atual."
      if (novaSenha.length < 8) erros.novaSenha = "Nova senha precisa ter pelo menos 8 caracteres."
      if (novaSenha !== confirmarNovaSenha) erros.confirmarNovaSenha = "As senhas não coincidem."
    }

    setErrosCampo(erros)
    return Object.keys(erros).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErroGeral(null)
    setSucesso(null)
    if (!validar()) return

    setSalvando(true)
    try {
      let avatarUrlParaEnviar: string | undefined = undefined // undefined = não mudou

      if (avatarBlobComprimido) {
        const formData = new FormData()
        formData.append("avatar", avatarBlobComprimido, "avatar.jpg")
        const resUpload = await fetch("/api/perfil/avatar", { method: "POST", body: formData })
        const dadosUpload = await resUpload.json()
        if (!resUpload.ok) throw new Error(dadosUpload.error ?? "Falha ao enviar o avatar.")
        avatarUrlParaEnviar = dadosUpload.url
      } else if (avatarRemovido) {
        avatarUrlParaEnviar = ""
      }

      const payloadPerfil: Record<string, unknown> = {
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        telefone: telefone.trim() || null,
      }
      if (avatarUrlParaEnviar !== undefined) payloadPerfil.avatarUrl = avatarUrlParaEnviar

      const resPerfil = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadPerfil),
      })
      const dadosPerfil = await resPerfil.json()
      if (!resPerfil.ok) throw new Error(dadosPerfil.error ?? "Erro ao salvar perfil.")

      if (senhaAtual && novaSenha) {
        const resSenha = await fetch("/api/perfil/senha", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senhaAtual, novaSenha }),
        })
        const dadosSenha = await resSenha.json()
        if (!resSenha.ok) throw new Error(dadosSenha.error ?? "Erro ao trocar senha.")
      }

      // atualiza a sessão do NextAuth pra sidebar refletir nome/avatar
      // novos sem precisar deslogar
      await atualizarSessao({
        name: dadosPerfil.usuario.name,
        image: dadosPerfil.usuario.image,
      })

      setSenhaAtual("")
      setNovaSenha("")
      setConfirmarNovaSenha("")
      setSucesso("Perfil atualizado com sucesso.")
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Erro ao salvar alterações.")
    } finally {
      setSalvando(false)
    }
  }

  const bloqueado = salvando || carregando
  const previewExibido = avatarPreviewUrl ?? (!avatarRemovido ? avatarUrlAtual : null)

  return (
    <ModalOverlay onClick={() => !salvando && onClose()}>
      <ModalCard onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <ModalTopo>
          <ModalTitle>Meu perfil</ModalTitle>
          <FecharButton type="button" onClick={onClose} title="Fechar">
            <X size={18} />
          </FecharButton>
        </ModalTopo>

        {erroGeral && (
          <AvisoErro>
            <AlertTriangle size={16} />
            <span>{erroGeral}</span>
          </AvisoErro>
        )}
        {sucesso && <AvisoSucesso>{sucesso}</AvisoSucesso>}

        {carregando ? (
          <>
            <SkeletonLinha style={{ height: 88, width: 88, borderRadius: "50%", margin: "0 auto" }} />
            <SkeletonLinha />
            <SkeletonLinha />
          </>
        ) : (
          <>
            <AvatarSecao>
              <AvatarPreviewWrapper
                type="button"
                onClick={() => inputAvatarRef.current?.click()}
                disabled={processandoAvatar}
              >
                {processandoAvatar ? (
                  <Loader2 size={20} style={{ animation: "spin 0.7s linear infinite" }} />
                ) : previewExibido ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewExibido} alt="Avatar" />
                ) : perfil ? (
                  getInitials(perfil.nome, perfil.sobrenome)
                ) : (
                  <UserIcon size={28} />
                )}
                <AvatarOverlayHover>
                  <Camera size={20} color="#fff" />
                </AvatarOverlayHover>
              </AvatarPreviewWrapper>

              <InputFileOculto
                ref={inputAvatarRef}
                type="file"
                accept="image/*"
                onChange={handleSelecionarAvatar}
              />

              {previewExibido ? (
                <ActionButton type="button" $variant="ghost" onClick={removerAvatar} style={{ padding: "4px 10px" }}>
                  Remover foto
                </ActionButton>
              ) : (
                <AvatarInfoTexto>Clique no avatar pra adicionar uma foto</AvatarInfoTexto>
              )}
            </AvatarSecao>

            <Secao>
              <SecaoTitulo>Dados pessoais</SecaoTitulo>

              <Grid2>
                <FieldGroup>
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={60}
                    disabled={bloqueado}
                  />
                  {errosCampo.nome && <ErrorText>{errosCampo.nome}</ErrorText>}
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="sobrenome">Sobrenome</Label>
                  <Input
                    id="sobrenome"
                    value={sobrenome}
                    onChange={(e) => setSobrenome(e.target.value)}
                    maxLength={60}
                    disabled={bloqueado}
                  />
                  {errosCampo.sobrenome && <ErrorText>{errosCampo.sobrenome}</ErrorText>}
                </FieldGroup>
              </Grid2>

              <FieldGroup>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 0 0000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                  inputMode="numeric"
                  maxLength={17}
                  disabled={bloqueado}
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="email">E-mail</Label>
                <InputSomenteLeitura id="email" value={perfil?.email ?? ""} disabled readOnly />
              </FieldGroup>
            </Secao>

            <Secao>
              <SecaoTitulo>
                <Lock size={12} style={{ display: "inline", marginRight: 4 }} />
                Trocar senha (opcional)
              </SecaoTitulo>

              <FieldGroup>
                <Label htmlFor="senhaAtual">Senha atual</Label>
                <Input
                  id="senhaAtual"
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  disabled={bloqueado}
                  autoComplete="current-password"
                />
                {errosCampo.senhaAtual && <ErrorText>{errosCampo.senhaAtual}</ErrorText>}
              </FieldGroup>

              <Grid2>
                <FieldGroup>
                  <Label htmlFor="novaSenha">Nova senha</Label>
                  <Input
                    id="novaSenha"
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    disabled={bloqueado}
                    autoComplete="new-password"
                  />
                  {errosCampo.novaSenha && <ErrorText>{errosCampo.novaSenha}</ErrorText>}
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="confirmarNovaSenha">Confirmar nova senha</Label>
                  <Input
                    id="confirmarNovaSenha"
                    type="password"
                    value={confirmarNovaSenha}
                    onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                    disabled={bloqueado}
                    autoComplete="new-password"
                  />
                  {errosCampo.confirmarNovaSenha && <ErrorText>{errosCampo.confirmarNovaSenha}</ErrorText>}
                </FieldGroup>
              </Grid2>
            </Secao>
          </>
        )}

        <ModalActions>
          <ActionButton type="button" $variant="ghost" disabled={salvando} onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" $variant="primary" disabled={bloqueado || processandoAvatar}>
            {salvando ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            Salvar alterações
          </ActionButton>
        </ModalActions>
      </ModalCard>
    </ModalOverlay>
  )
}