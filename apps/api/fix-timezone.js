require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.user.update({
    where: { email: 'test@moja.com' },
    data: { timezone: 'America/Chicago' }
}).then(u => {
    console.log('Updated timezone to:', u.timezone);
    return p.$disconnect();
}).catch(e => {
    console.error(e.message);
    return p.$disconnect();
});
