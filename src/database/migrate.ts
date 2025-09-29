import { initializeDatabase, testConnection } from './connection';

async function migrate() {
  try {
    console.log('🔄 Running database migrations...');
    
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    // Initialize schema
    await initializeDatabase();
    
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
