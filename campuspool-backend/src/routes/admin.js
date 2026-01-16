import express from 'express';
import supabase from '../database/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      message: 'Users retrieved successfully',
      users: (data || []).map((user) => ({
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
    const { data, error } = await supabase
      .from('rides')
      .select(
        `id, driver_id, source, destination, departure_time, 
         total_seats, available_seats, estimated_cost, status, created_at,
         users!driver_id(name)`
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      message: 'Rides retrieved successfully',
      rides: (data || []).map((ride) => ({
        id: ride.id,
        driverId: ride.driver_id,
        driverName: ride.users?.name || 'Unknown',
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
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    const { count: rideCount } = await supabase
      .from('rides')
      .select('*', { count: 'exact' });

    const { count: requestCount } = await supabase
      .from('ride_requests')
      .select('*', { count: 'exact' });

    res.json({
      message: 'Stats retrieved successfully',
      stats: {
        totalUsers: userCount || 0,
        totalRides: rideCount || 0,
        totalRequests: requestCount || 0,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
