import supabase from './supabaseClient.js';

const initializeDatabase = async () => {
  try {
    // Supabase tables are created via dashboard/SQL editor
    // This function just verifies the connection
    const { data, error } = await supabase.from('users').select('count');

    if (error) {
      console.log('Database initialization note:', error.message);
      console.log('Please ensure you have created the following tables in Supabase:');
      console.log('1. users');
      console.log('2. rides');
      console.log('3. ride_requests');
    } else {
      console.log('Supabase connection verified');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default initializeDatabase;
