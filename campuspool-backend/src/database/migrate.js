import initializeDatabase from './schema.js';

const migrate = async () => {
  try {
    await initializeDatabase();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
