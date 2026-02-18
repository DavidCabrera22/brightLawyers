
const prisma = require('../src/loaders/prisma');

async function main() {
    const searchTerm = process.argv[2] || 'jorgecabreracera@hotmail.com';
    console.log(`--- Checking User matching: ${searchTerm} ---`);

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: { contains: searchTerm } },
                { fullName: { contains: searchTerm } }
            ]
        },
        include: {
            userRoles: {
                include: {
                    role: true
                }
            },
            profile: true
        }
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    console.log('User found:', {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        roles: user.userRoles.map(ur => ur.role.name)
    });

    console.log('\n--- Checking Alerts for User ---');
    const alerts = await prisma.alert.findMany({
        where: {
            recipientUserId: user.id
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 5
    });

    console.log(`Found ${alerts.length} recent alerts.`);
    alerts.forEach(alert => {
        console.log({
            id: alert.id,
            type: alert.alertType,
            status: alert.status,
            phone: user.phone,
            createdAt: alert.createdAt,
            payload: alert.payload,
            sentAt: alert.sentAt
        });
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
