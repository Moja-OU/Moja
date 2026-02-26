const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@moja.com' },
    update: {
      name: 'test',
      passwordHash,
      phone: '+10000000000',
      voicePin: '1234',
      timezone: 'America/Oklahoma_City',
    },
    create: {
      email: 'test@moja.com',
      name: 'test',
      passwordHash,
      phone: '+10000000000',
      voicePin: '1234',
      timezone: 'America/Chicago',
    },
  });

  console.log('✅ User ready:');
  console.log('   ID:', user.id);
  console.log('   Name:', user.name);
  console.log('   Email:', user.email);
  console.log('   Phone:', user.phone);
  console.log('   VoicePin:', user.voicePin);
  console.log('');
  console.log('🌐 Web Login:  test@moja.com / password123');
  console.log('📞 Voice PIN:  1234');
}

main()
  .catch(e => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
