import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import * as schema from './schema';
import { logger } from '../utils/logger';

// Load environment variables first
dotenv.config();

// Database URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

logger.info('Connecting to PostgreSQL database', { service: 'database' });

// Create PostgreSQL connection
const queryClient = postgres(connectionString, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Export raw postgres client for advanced operations
export { queryClient };

// Cleanup function
export const closeDatabase = async () => {
  await queryClient.end();
};
