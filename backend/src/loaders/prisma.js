const { PrismaClient } = require('@prisma/client');

// Fix for BigInt serialization
BigInt.prototype.toJSON = function () {       
  return this.toString();
};

const prisma = new PrismaClient();

module.exports = prisma;
