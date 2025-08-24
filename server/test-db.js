const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const client = new PrismaClient();

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test connection
    await client.$connect();
    console.log('✅ Database connected successfully');
    
    // Try to create a test user
    const testUser = await client.users.create({
      data: {
        name: 'Test User',
        email: 'test@example.edu'
      }
    });
    console.log('✅ User created:', testUser);
    
    // Try to find the user
    const foundUser = await client.users.findUnique({
      where: { email: 'test@example.edu' }
    });
    console.log('✅ User found:', foundUser);
    
    // List all users
    const allUsers = await client.users.findMany();
    console.log('✅ All users:', allUsers);
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await client.$disconnect();
    console.log('Database disconnected');
  }
}

testDatabase();
