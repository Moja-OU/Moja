const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: 'test@moja.com' },
    data: { voicePin: '1234' }
  });
  
  console.log('✅ Set voice PIN to 1234 for', user.email);
}

main()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
