import express from 'express';
import pool from '../database/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({
      message: 'Users retrieved successfully',
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at,
      })),
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all rides (admin view)
router.get('/rides', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        r.id, r.driver_id, u.name as driver_name, r.source, r.destination,
        r.departure_time, r.total_seats, r.available_seats, r.estimated_cost,
        r.status, r.created_at
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      ORDER BY r.created_at DESC`
    );

    res.json({
      message: 'Rides retrieved successfully',
      rides: result.rows.map(ride => ({
        id: ride.id,
        driverId: ride.driver_id,
        driverName: ride.driver_name,
        source: ride.source,
        destination: ride.destination,
        departureTime: ride.departure_time,
        totalSeats: ride.total_seats,
        availableSeats: ride.available_seats,
        estimatedCost: parseFloat(ride.estimated_cost),
        status: ride.status,
        createdAt: ride.created_at,
      })),
    });
  } catch (error) {
    console.error('Get rides error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const rideCount = await pool.query('SELECT COUNT(*) as count FROM rides');
    const requestCount = await pool.query('SELECT COUNT(*) as count FROM ride_requests');

    res.json({
      message: 'Stats retrieved successfully',
      stats: {
        totalUsers: parseInt(userCount.rows[0].count),
        totalRides: parseInt(rideCount.rows[0].count),
        totalRequests: parseInt(requestCount.rows[0].count),
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
