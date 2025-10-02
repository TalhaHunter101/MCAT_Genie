import { pool } from './connection';

async function migrateColumns() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running column length migrations...');
    
    // Update title columns to VARCHAR(1000)
    const titleTables = [
      'khan_academy_resources',
      'kaplan_resources', 
      'jack_westin_resources',
      'uworld_resources',
      'aamc_resources'
    ];
    
    for (const table of titleTables) {
      console.log(`📝 Updating ${table}.title column...`);
      await client.query(`ALTER TABLE ${table} ALTER COLUMN title TYPE VARCHAR(1000);`);
      console.log(`✅ Updated ${table}.title`);
    }
    
    // Update resource_uid column
    console.log('📝 Updating used_resources.resource_uid column...');
    await client.query(`ALTER TABLE used_resources ALTER COLUMN resource_uid TYPE VARCHAR(1000);`);
    console.log('✅ Updated used_resources.resource_uid');
    
    console.log('✅ All column migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Column migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateColumns()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateColumns };
