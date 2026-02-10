const { PrismaClient } = require('@prisma/client');

// Fix for BigInt serialization
BigInt.prototype.toJSON = function () {       
  return this.toString();
};

// Singleton pattern for Prisma Client
// This ensures we don't create multiple instances in development
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
