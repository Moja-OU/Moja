const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'test@moja.com' },
    include: {
      sessions: { orderBy: { startedAt: 'desc' }, take: 3 },
      bookings: { orderBy: { createdAt: 'desc' }, take: 5 },
      activities: { orderBy: { createdAt: 'desc' }, take: 5 },
      goals: true,
      budgets: true
    }
  });
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log('📊 User Data Summary:');
  console.log('   Email:', user.email);
  console.log('   Sessions:', user.sessions.length);
  console.log('   Bookings:', user.bookings.length);
  console.log('   Activities:', user.activities.length);
  console.log('   Goals:', user.goals.length);
  console.log('   Budgets:', user.budgets.length);
  console.log('');
  
  if (user.sessions.length > 0) {
    console.log('Recent Sessions:');
    user.sessions.forEach(s => {
      console.log(`   - ${s.channel} session at ${s.startedAt.toLocaleString()}`);
    });
    console.log('');
  }
  
  if (user.bookings.length > 0) {
    console.log('Recent Bookings:');
    user.bookings.forEach(b => {
      console.log(`   - ${b.businessName} at ${b.datetimeLocal} (${b.status})`);
    });
  } else {
    console.log('❌ No bookings found');
  }
  console.log('');
  
  if (user.activities.length > 0) {
    console.log('Recent Activities:');
    user.activities.forEach(a => {
      console.log(`   - ${a.name} at ${a.datetimeLocal} (${a.status})`);
    });
  } else {
    console.log('❌ No activities found');
  }
}

main()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
