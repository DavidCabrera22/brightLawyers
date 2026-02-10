const cron = require('node-cron');
const prisma = require('../loaders/prisma');

// Run every day at 9:00 AM
// Schedule: "0 9 * * *"
// For testing purposes, we can log startup.
console.log('Document reminder cron initialized (Schedule: 0 9 * * *)');

const task = cron.schedule('0 9 * * *', async () => {
    console.log('Running document reminder cron job...');
    try {
        const cases = await prisma.case.findMany({
            where: {
                documentRequestActive: true,
                caseStatus: { notIn: ['closed', 'archived'] }
            }
        });

        console.log(`Found ${cases.length} cases with pending document requests.`);

        for (const c of cases) {
            // Check if we should send a reminder today
            // If lastReminderSentAt is null, send it.
            // If lastReminderSentAt was > 23 hours ago, send it.
            
            const now = new Date();
            const lastSent = c.lastReminderSentAt ? new Date(c.lastReminderSentAt) : null;
            const hoursDiff = lastSent ? (now - lastSent) / (1000 * 60 * 60) : 999;

            if (hoursDiff >= 23) {
                // Send system message
                await prisma.caseMessage.create({
                    data: {
                        caseId: c.id,
                        senderRole: 'system',
                        messageText: 'Recordatorio: Su abogado está esperando que suba los documentos solicitados. Por favor, cárguelos a la brevedad para continuar con su proceso.',
                        isRead: false
                    }
                });

                // Update lastReminderSentAt
                await prisma.case.update({
                    where: { id: c.id },
                    data: { lastReminderSentAt: now }
                });
                
                console.log(`Sent reminder for case ${c.caseNumberInternal}`);
            }
        }
    } catch (error) {
        console.error('Error in document reminder cron:', error);
    }
});

module.exports = task;
