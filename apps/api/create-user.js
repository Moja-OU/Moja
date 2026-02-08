const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: 'test@moja.com' },
    data: { phone: '+14052238806' },
  });
  console.log('✅ Updated user phone to:', user.phone);
}

main()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
