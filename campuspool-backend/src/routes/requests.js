import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../database/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all ride requests for a ride (driver only)
router.get('/ride/:rideId', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;

    // Verify the ride belongs to the driver
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .single();

    if (rideError || !ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { data, error } = await supabase
      .from('ride_requests')
      .select(
        `id, ride_id, rider_id, status, created_at,
         users!rider_id(name)`
      )
      .eq('ride_id', rideId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      message: 'Ride requests retrieved successfully',
      requests: (data || []).map((req: any) => ({
        id: req.id,
        rideId: req.ride_id,
        riderId: req.rider_id,
        riderName: req.users?.name || 'Unknown',
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
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .single();

    if (rideError || !ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.available_seats <= 0) {
      return res.status(400).json({ message: 'No available seats' });
    }

    // Check if already requested
    const { data: existing, error: existingError } = await supabase
      .from('ride_requests')
      .select('id')
      .eq('ride_id', rideId)
      .eq('rider_id', req.user.id);

    if (!existingError && existing && existing.length > 0) {
      return res.status(409).json({ message: 'You already requested this ride' });
    }

    const { data, error } = await supabase
      .from('ride_requests')
      .insert([
        {
          ride_id: rideId,
          rider_id: req.user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Ride request sent successfully',
      request: {
        id: data.id,
        rideId: data.ride_id,
        riderId: data.rider_id,
        riderName: req.user.name,
        status: data.status,
        createdAt: data.created_at,
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

    const { data: request, error: requestError } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', request.ride_id)
      .single();

    if (rideError || !ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update request status
    await supabase
      .from('ride_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', id);

    // Decrease available seats
    await supabase
      .from('rides')
      .update({
        available_seats: ride.available_seats - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.ride_id);

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

    const { data: request, error: requestError } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', request.ride_id)
      .single();

    if (rideError || !ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update request status
    await supabase
      .from('ride_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);

    res.json({ message: 'Ride request rejected successfully' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
