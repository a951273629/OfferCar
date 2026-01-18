// Jest setup file
// Add custom matchers or global test configuration here

// Mock environment variables for tests
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '3306';
process.env.DATABASE_USER = 'test_user';
process.env.DATABASE_PASSWORD = 'test_password';
process.env.DATABASE_NAME = 'test_db';
process.env.JWT_SECRET = 'test-jwt-secret';


