const prisma = require('./db-client');

async function testConnection() {
  console.log('🔌 Testing database connection...\n');

  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully!\n');

    // Query roles
    console.log('📋 Roles in database:');
    const roles = await prisma.role.findMany({
      orderBy: { id: 'asc' }
    });
    console.table(roles);

    // Query lawyers
    console.log('\n👥 Lawyers in database:');
    const lawyers = await prisma.lawyer.findMany({
      include: {
        role: true
      }
    });
    
    lawyers.forEach(lawyer => {
      console.log(`\n🧑‍💼 ${lawyer.name}`);
      console.log(`   Email: ${lawyer.email}`);
      console.log(`   Role: ${lawyer.role.name}`);
      console.log(`   Phone: ${lawyer.phone || 'N/A'}`);
      console.log(`   Active: ${lawyer.active ? 'Yes' : 'No'}`);
    });

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
