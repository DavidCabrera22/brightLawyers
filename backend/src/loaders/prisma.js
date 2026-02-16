const { PrismaClient } = require('@prisma/client');

// Fix for BigInt serialization
BigInt.prototype.toJSON = function () {       
  return this.toString();
};

// Singleton pattern to prevent multiple instances
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=5'
        }
    },
    log: ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
