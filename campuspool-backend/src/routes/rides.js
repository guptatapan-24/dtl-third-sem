import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../database/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all rides (with filtering)
router.get('/', async (req, res) => {
  try {
    const { destination, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('rides')
      .select(
        `id, driver_id, source, destination, departure_time, total_seats, 
         available_seats, estimated_cost, status, created_at, 
         users!driver_id(name)`
      )
      .eq('status', 'posted')
      .order('departure_time', { ascending: true })
      .range(offset, offset + limit - 1);

    if (destination) {
      query = query.ilike('destination', `%${destination}%`);
    }

    const { data, error } = await query;

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
        costPerRider:
          ride.available_seats > 0
            ? (
                parseFloat(ride.estimated_cost) /
                (ride.total_seats - ride.available_seats || 1)
              ).toFixed(2)
            : parseFloat(ride.estimated_cost),
        status: ride.status,
        createdAt: ride.created_at,
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

    const { data, error } = await supabase
      .from('rides')
      .select(
        `id, driver_id, source, destination, departure_time, total_seats,
         available_seats, estimated_cost, status, created_at,
         users!driver_id(name)`
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    res.json({
      message: 'Ride retrieved successfully',
      ride: {
        id: data.id,
        driverId: data.driver_id,
        driverName: data.users?.name || 'Unknown',
        source: data.source,
        destination: data.destination,
        departureTime: data.departure_time,
        totalSeats: data.total_seats,
        availableSeats: data.available_seats,
        estimatedCost: parseFloat(data.estimated_cost),
        costPerRider:
          data.available_seats > 0
            ? (
                parseFloat(data.estimated_cost) /
                (data.total_seats - data.available_seats || 1)
              ).toFixed(2)
            : parseFloat(data.estimated_cost),
        status: data.status,
        createdAt: data.created_at,
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

    const { data, error } = await supabase
      .from('rides')
      .insert([
        {
          driver_id: req.user.id,
          source,
          destination,
          departure_time: departureTime,
          total_seats: totalSeats,
          available_seats: totalSeats,
          estimated_cost: estimatedCost,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Ride posted successfully',
      ride: {
        id: data.id,
        driverId: data.driver_id,
        driverName: req.user.name,
        source: data.source,
        destination: data.destination,
        departureTime: data.departure_time,
        totalSeats: data.total_seats,
        availableSeats: data.available_seats,
        estimatedCost: parseFloat(data.estimated_cost),
        status: data.status,
        createdAt: data.created_at,
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

    const { data: ride, error: fetchError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this ride' });
    }

    if (!['posted', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('rides')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Ride status updated successfully',
      ride: data,
    });
  } catch (error) {
    console.error('Update ride error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
