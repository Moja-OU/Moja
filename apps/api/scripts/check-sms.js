const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const sessions = await p.session.findMany({
        where: { channel: 'SMS' },
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: { id: true, channel: true, startedAt: true, transcript: true, summary: true }
    });

    if (!sessions.length) {
        console.log('No SMS sessions found in database.');
    } else {
        sessions.forEach(s => {
            console.log('--- Session ' + s.id + ' ---');
            console.log('Started:', s.startedAt);
            console.log('Summary:', s.summary);
            try {
                const t = JSON.parse(s.transcript || '[]');
                t.forEach(m => console.log('  [' + m.role + '] ' + m.content));
            } catch (e) {
                console.log('Raw:', s.transcript);
            }
            console.log();
        });
    }

    await p['$disconnect']();
}

main();
