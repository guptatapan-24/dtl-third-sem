import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../database/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all rides (with filtering)
router.get('/', async (req, res) => {
  try {
    const { destination, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT 
        r.id, r.driver_id, u.name as driver_name, r.source, r.destination,
        r.departure_time, r.total_seats, r.available_seats, r.estimated_cost,
        r.status, r.created_at
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      WHERE r.status = 'posted'
    `;
    const params = [];

    if (destination) {
      query += ' AND r.destination ILIKE $1';
      params.push(`%${destination}%`);
    }

    query += ' ORDER BY r.departure_time ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit);
    params.push(offset);

    const result = await pool.query(query, params);

    res.json({
      message: 'Rides retrieved successfully',
      rides: result.rows.map(ride => ({
        ...ride,
        departureTime: ride.departure_time,
        driverId: ride.driver_id,
        driverName: ride.driver_name,
        totalSeats: ride.total_seats,
        availableSeats: ride.available_seats,
        estimatedCost: parseFloat(ride.estimated_cost),
        costPerRider: ride.available_seats > 0 
          ? (parseFloat(ride.estimated_cost) / (ride.total_seats - ride.available_seats || 1)).toFixed(2)
          : parseFloat(ride.estimated_cost),
      })),
    });
  } catch (error) {
    console.error('Get rides error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get ride by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        r.id, r.driver_id, u.name as driver_name, r.source, r.destination,
        r.departure_time, r.total_seats, r.available_seats, r.estimated_cost,
        r.status, r.created_at
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    const ride = result.rows[0];
    res.json({
      message: 'Ride retrieved successfully',
      ride: {
        ...ride,
        departureTime: ride.departure_time,
        driverId: ride.driver_id,
        driverName: ride.driver_name,
        totalSeats: ride.total_seats,
        availableSeats: ride.available_seats,
        estimatedCost: parseFloat(ride.estimated_cost),
        costPerRider: ride.available_seats > 0
          ? (parseFloat(ride.estimated_cost) / (ride.total_seats - ride.available_seats || 1)).toFixed(2)
          : parseFloat(ride.estimated_cost),
      },
    });
  } catch (error) {
    console.error('Get ride error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create ride (driver only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { source, destination, departureTime, totalSeats, estimatedCost } = req.body;

    if (req.user.role !== 'driver') {
      return res.status(403).json({ message: 'Only drivers can post rides' });
    }

    if (!source || !destination || !departureTime || !totalSeats || estimatedCost === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (totalSeats < 1 || estimatedCost < 0) {
      return res.status(400).json({ message: 'Invalid seat count or cost' });
    }

    const rideId = uuidv4();
    const result = await pool.query(
      `INSERT INTO rides (id, driver_id, source, destination, departure_time, total_seats, available_seats, estimated_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, driver_id, source, destination, departure_time, total_seats, available_seats, estimated_cost, status, created_at`,
      [rideId, req.user.id, source, destination, departureTime, totalSeats, totalSeats, estimatedCost]
    );

    const ride = result.rows[0];
    res.status(201).json({
      message: 'Ride posted successfully',
      ride: {
        id: ride.id,
        driverId: ride.driver_id,
        driverName: req.user.name,
        source: ride.source,
        destination: ride.destination,
        departureTime: ride.departure_time,
        totalSeats: ride.total_seats,
        availableSeats: ride.available_seats,
        estimatedCost: parseFloat(ride.estimated_cost),
        status: ride.status,
        createdAt: ride.created_at,
      },
    });
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update ride status (driver only)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const ride = await pool.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (ride.rows.length === 0) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.rows[0].driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this ride' });
    }

    if (!['posted', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const result = await pool.query(
      'UPDATE rides SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    res.json({
      message: 'Ride status updated successfully',
      ride: result.rows[0],
    });
  } catch (error) {
    console.error('Update ride error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
