const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  // Hash the password 'password123'
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const user = await prisma.user.update({
    where: { email: 'test@moja.com' },
    data: { 
      name: 'Luc',
      passwordHash: passwordHash,
      phone: '+14052238806'
    },  
  });
  
  console.log('✅ Updated user credentials:');
  console.log('   Name:', user.name);
  console.log('   Email:', user.email);
  console.log('   Phone:', user.phone);
  console.log('');
  console.log('🌐 Web Login:');
  console.log('   Email: test@moja.com');
  console.log('   Password: password123');
  console.log('');
  console.log('📞 Voice Call (from', user.phone + '):');
  console.log('   PIN: 1234');
}

main()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
