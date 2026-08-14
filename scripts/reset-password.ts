// scripts/reset-password.ts
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function resetPassword() {
  const email = 'admin@cbf.com.br' // ← Use o email exato que está no banco
  const newPassword = 'Admin@123'
  
  console.log('🔍 Resetando senha para:', email)
  
  // Verifica se o usuário existe
  const user = await prisma.user.findUnique({
    where: { email }
  })
  
  if (!user) {
    console.log('❌ Usuário não encontrado:', email)
    console.log('💡 Verifique se o email está correto')
    return
  }
  
  console.log('✅ Usuário encontrado:', user.email)
  
  // Gera o novo hash
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  console.log('🔐 Novo hash gerado:', hashedPassword)
  
  // Atualiza a senha
  await prisma.user.update({
    where: { email },
    data: { 
      password: hashedPassword,
      updatedAt: new Date()
    }
  })
  
  console.log('✅ Senha resetada com sucesso!')
  console.log('📧 Email:', email)
  console.log('🔑 Nova senha:', newPassword)
  console.log('📋 Status:', user.status)
  console.log('📋 Ativo:', user.ativo)
}

resetPassword()
  .catch(console.error)
  .finally(() => prisma.$disconnect())