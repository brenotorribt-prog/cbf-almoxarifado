// Máscara (00) 0 0000-0000 — formata progressivamente enquanto o usuário
// digita, sem depender de lib externa. Baseado só na contagem de dígitos
// já digitados, então funciona tanto pra formatar do zero quanto pra
// reformatar um valor colado de uma vez.
export function formatarTelefone(valorBruto: string): string {
  const digitos = valorBruto.replace(/\D/g, "").slice(0, 11)

  let resultado = ""
  if (digitos.length > 0) resultado += `(${digitos.slice(0, 2)}`
  if (digitos.length >= 2) resultado += ") "
  if (digitos.length > 2) resultado += digitos.slice(2, 3)
  if (digitos.length > 3) resultado += ` ${digitos.slice(3, 7)}`
  if (digitos.length > 7) resultado += `-${digitos.slice(7, 11)}`

  return resultado
}