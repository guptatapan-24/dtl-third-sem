import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../database/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all ride requests for a ride (driver only)
router.get('/ride/:rideId', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;

    // Verify the ride belongs to the driver
    const ride = await pool.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    if (ride.rows.length === 0) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.rows[0].driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const result = await pool.query(
      `SELECT 
        rr.id, rr.ride_id, rr.rider_id, u.name as rider_name,
        rr.status, rr.created_at
      FROM ride_requests rr
      JOIN users u ON rr.rider_id = u.id
      WHERE rr.ride_id = $1
      ORDER BY rr.created_at DESC`,
      [rideId]
    );

    res.json({
      message: 'Ride requests retrieved successfully',
      requests: result.rows.map(req => ({
        id: req.id,
        rideId: req.ride_id,
        riderId: req.rider_id,
        riderName: req.rider_name,
        status: req.status,
        createdAt: req.created_at,
      })),
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create ride request (rider only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.body;

    if (req.user.role !== 'rider') {
      return res.status(403).json({ message: 'Only riders can request rides' });
    }

    if (!rideId) {
      return res.status(400).json({ message: 'Ride ID is required' });
    }

    // Check if ride exists and has available seats
    const ride = await pool.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    if (ride.rows.length === 0) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.rows[0].available_seats <= 0) {
      return res.status(400).json({ message: 'No available seats' });
    }

    // Check if already requested
    const existing = await pool.query(
      'SELECT id FROM ride_requests WHERE ride_id = $1 AND rider_id = $2',
      [rideId, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'You already requested this ride' });
    }

    const requestId = uuidv4();
    const result = await pool.query(
      `INSERT INTO ride_requests (id, ride_id, rider_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, ride_id, rider_id, status, created_at`,
      [requestId, rideId, req.user.id]
    );

    const request = result.rows[0];
    res.status(201).json({
      message: 'Ride request sent successfully',
      request: {
        id: request.id,
        rideId: request.ride_id,
        riderId: request.rider_id,
        riderName: req.user.name,
        status: request.status,
        createdAt: request.created_at,
      },
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Accept ride request (driver only)
router.patch('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await pool.query(
      'SELECT * FROM ride_requests WHERE id = $1',
      [id]
    );

    if (request.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const rideReq = request.rows[0];
    const ride = await pool.query('SELECT * FROM rides WHERE id = $1', [rideReq.ride_id]);

    if (ride.rows[0].driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update request status
    await pool.query(
      'UPDATE ride_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['accepted', id]
    );

    // Decrease available seats
    await pool.query(
      'UPDATE rides SET available_seats = available_seats - 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [rideReq.ride_id]
    );

    res.json({ message: 'Ride request accepted successfully' });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject ride request (driver only)
router.patch('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await pool.query(
      'SELECT * FROM ride_requests WHERE id = $1',
      [id]
    );

    if (request.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const rideReq = request.rows[0];
    const ride = await pool.query('SELECT * FROM rides WHERE id = $1', [rideReq.ride_id]);

    if (ride.rows[0].driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update request status
    await pool.query(
      'UPDATE ride_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['rejected', id]
    );

    res.json({ message: 'Ride request rejected successfully' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
