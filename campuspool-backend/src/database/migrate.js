import supabase from './supabaseClient.js';

const migrate = async () => {
  try {
    console.log('Connecting to Supabase...');
    
    // Test connection
    const { data, error } = await supabase.from('users').select('count');
    
    if (error) {
      console.log('Note: Supabase tables need to be created manually');
      console.log('1. Go to your Supabase project dashboard');
      console.log('2. Open the SQL editor');
      console.log('3. Run the SQL commands in src/database/schema.sql');
    } else {
      console.log('Supabase connection verified');
    }

    console.log('Migration setup completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
