// src/components/relatorios/pessoas-estoque.tsx
//
// Seção "Estoque por Pessoa" da página de Relatórios.
// Mostra, para cada pessoa que retirou materiais no período, o que ela
// pegou, o que devolveu e o saldo em posse ("estoque pessoal").
//
// Cada pessoa é um bloco expansível com a lista de materiais; os totais
// da pessoa ficam visíveis no cabeçalho do bloco mesmo fechado.

"use client"

import { useMemo, useState } from "react"
import styled from "styled-components"
import { ChevronDown, Users } from "lucide-react"
import { theme, hexToRgba } from "@/styles/theme"
// Importa do módulo client-safe (sem prisma) — NÃO importar de
// @/lib/exportacoes/relatorios/relatorios aqui, isso puxaria o driver do banco pro bundle.
import {
  agruparEstoquePorPessoa,
  type EstoquePessoaRow,
} from "@/lib/exportacoes/relatorios/relatorios-shared"

interface PessoasEstoqueProps {
  pessoas: EstoquePessoaRow[]
}

/** Formata número removendo zeros à direita (2,5 -> "2,5" / 3 -> "3"). */
function fmtQtd(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
}

export default function PessoasEstoque({ pessoas }: PessoasEstoqueProps) {
  const grupos = useMemo(() => agruparEstoquePorPessoa(pessoas), [pessoas])
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())

  function alternar(chave: string) {
    setAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  const totalEmPosse = grupos.reduce((acc, g) => acc + g.totalSaldo, 0)
  const totalConsumido = grupos.reduce((acc, g) => acc + g.totalConsumido, 0)

  return (
    <CardWrapper>
      <CardHeader>
        <CardTitle>
          <Users size={16} />
          Estoque por Pessoa
        </CardTitle>
        <ResumoChips>
          <Chip>{grupos.length} pessoa{grupos.length !== 1 ? "s" : ""}</Chip>
          <Chip $cor={theme.colors.status.purple}>
            {fmtQtd(totalConsumido)} consumido{Math.abs(totalConsumido) !== 1 ? "s" : ""}
          </Chip>
          <Chip $cor={theme.colors.status.warning}>
            {fmtQtd(totalEmPosse)} em posse
          </Chip>
        </ResumoChips>
      </CardHeader>

      <Hint>
        Baseado nas movimentações do período selecionado — saídas com solicitante identificado,
        devoluções (empréstimo ou avulsa) e a marcação de retorno feita na entrega.
      </Hint>

      <ListaPessoas>
        {grupos.map((grupo) => {
          const chave = `${grupo.nome}|${grupo.setor ?? ""}|${grupo.funcao ?? ""}`
          const aberto = abertos.has(chave)

          return (
            <BlocoPessoa key={chave}>
              <BotaoPessoa
                type="button"
                onClick={() => alternar(chave)}
                aria-expanded={aberto}
              >
                <Chevron size={16} className={aberto ? "aberto" : undefined} />
                <Identificacao>
                  <NomePessoa>{grupo.nome}</NomePessoa>
                  {(grupo.setor || grupo.funcao) && (
                    <DetalhePessoa>
                      {[grupo.setor, grupo.funcao].filter(Boolean).join(" · ")}
                    </DetalhePessoa>
                  )}
                </Identificacao>

                <TotaisPessoa>
                  <TotalItem>
                    <span>Retirado</span>
                    <strong>{fmtQtd(grupo.totalRetirado)}</strong>
                  </TotalItem>
                  <TotalItem>
                    <span>Devolvido</span>
                    <strong>{fmtQtd(grupo.totalDevolvido)}</strong>
                  </TotalItem>
                  <TotalItem>
                    <span>Consumido</span>
                    <strong>{fmtQtd(grupo.totalConsumido)}</strong>
                  </TotalItem>
                  <TotalItem $destaque>
                    <span>Em posse</span>
                    <strong>{fmtQtd(grupo.totalSaldo)}</strong>
                  </TotalItem>
                </TotaisPessoa>
              </BotaoPessoa>

              {aberto && (
                <TabelaItens>
                  <LinhaItens $cabecalho>
                    <CelMaterial>Material</CelMaterial>
                    <CelCodigo>Código</CelCodigo>
                    <CelNum>Retirado</CelNum>
                    <CelNum>Devolvido</CelNum>
                    <CelNum>Consumido</CelNum>
                    <CelNum>Em posse</CelNum>
                  </LinhaItens>
                  {grupo.itens.map((item) => (
                    <LinhaItens key={`${item.materialId}-${item.codigoInterno}`}>
                      <CelMaterial>
                        {item.materialNome}
                        <Unidade> ({item.unidadeSigla})</Unidade>
                      </CelMaterial>
                      <CelCodigo>{item.codigoInterno}</CelCodigo>
                      <CelNum>{fmtQtd(item.retirado)}</CelNum>
                      <CelNum>{fmtQtd(item.devolvido)}</CelNum>
                      <CelNum>{fmtQtd(item.consumido)}</CelNum>
                      <CelNum $saldoNegativo={item.saldo < 0}>{fmtQtd(item.saldo)}</CelNum>
                    </LinhaItens>
                  ))}
                </TabelaItens>
              )}
            </BlocoPessoa>
          )
        })}
      </ListaPessoas>
    </CardWrapper>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const CardWrapper = styled.div`
  background: ${({ theme }) => theme.colors.surface.card};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
`

const CardTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};

  svg { color: ${({ theme }) => theme.colors.primary.vivid}; flex-shrink: 0; }
`

const ResumoChips = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-wrap: wrap;
`

const Chip = styled.span<{ $cor?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $cor, theme }) => $cor ?? theme.colors.text.secondary};
  background: ${({ $cor, theme }) =>
    hexToRgba($cor ?? theme.colors.primary.vivid, 0.12)};
`

const Hint = styled.p`
  margin-top: -${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const ListaPessoas = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const BlocoPessoa = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
  background: ${hexToRgba("#ffffff", 0.02)};
`

const BotaoPessoa = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[4]}`};
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover { background: ${hexToRgba("#ffffff", 0.04)}; }
`

const Chevron = styled(ChevronDown)`
  color: ${({ theme }) => theme.colors.text.muted};
  flex-shrink: 0;
  transition: transform ${({ theme }) => theme.transitions.fast};

  &.aberto { transform: rotate(180deg); }
`

const Identificacao = styled.div`
  min-width: 0;
  flex: 1;
`

const NomePessoa = styled.span`
  display: block;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const DetalhePessoa = styled.span`
  display: block;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const TotaisPessoa = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    display: none;
  }
`

const TotalItem = styled.div<{ $destaque?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.muted};
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-variant-numeric: tabular-nums;
    color: ${({ $destaque, theme }) =>
      $destaque ? theme.colors.status.warning : theme.colors.text.primary};
  }
`

const TabelaItens = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]} ${theme.spacing[3]}`};
  display: flex;
  flex-direction: column;
`

const LinhaItens = styled.div<{ $cabecalho?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 100px repeat(4, 80px);
  gap: ${({ theme }) => theme.spacing[3]};
  align-items: center;
  padding: ${({ theme }) => theme.spacing[2]} 0;
  border-bottom: 1px solid ${hexToRgba("#ffffff", 0.05)};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};

  &:last-child { border-bottom: none; }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: minmax(0, 1fr) repeat(4, 64px);
    /* esconde código em telas pequenas */
    > :nth-child(2) { display: none; }
  }

  ${({ $cabecalho, theme }) =>
    $cabecalho &&
    `
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${theme.colors.text.muted};
    font-weight: 600;
  `}
`

const CelMaterial = styled.span`
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;

  svg { color: ${({ theme }) => theme.colors.text.muted}; flex-shrink: 0; }
`

const Unidade = styled.span`
  color: ${({ theme }) => theme.colors.text.muted};
`

const CelCodigo = styled.span`
  color: ${({ theme }) => theme.colors.text.muted};
  font-variant-numeric: tabular-nums;
`

const CelNum = styled.span<{ $saldoNegativo?: boolean }>`
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${({ $saldoNegativo, theme }) =>
    $saldoNegativo ? theme.colors.status.error : theme.colors.text.secondary};
`
