import pool from './pool.js';

const initializeDatabase = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('rider', 'driver')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Rides table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        departure_time TIMESTAMP NOT NULL,
        total_seats INTEGER NOT NULL CHECK (total_seats > 0),
        available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
        estimated_cost DECIMAL(10, 2) NOT NULL CHECK (estimated_cost >= 0),
        status VARCHAR(50) NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'in_progress', 'completed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ride requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ride_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
        rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ride_id, rider_id)
      );
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ride_requests_ride_id ON ride_requests(ride_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ride_requests_rider_id ON ride_requests(rider_id);');

    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default initializeDatabase;
