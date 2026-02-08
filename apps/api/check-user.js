const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'test@moja.com' }
  });
  
  if (!user) {
    console.log('❌ User not found');
  } else {
    console.log('✅ User found:');
    console.log('   Email:', user.email);
    console.log('   Name:', user.name);
    console.log('   Phone:', user.phone);
    console.log('   Voice PIN:', user.voicePin);
    console.log('   Password Hash:', user.passwordHash);
    console.log('   Hash starts with $2:', user.passwordHash.startsWith('$2'));
  }
}

main()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
