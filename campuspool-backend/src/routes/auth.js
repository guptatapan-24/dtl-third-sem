import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../database/supabaseClient.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmail, validateCollegeEmail, validatePassword } from '../utils/validators.js';

const router = express.Router();

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Validation
    if (!email || !password || !name || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!validateCollegeEmail(email)) {
      return res.status(400).json({
        message: `Only ${process.env.COLLEGE_EMAIL_DOMAIN || 'college.edu'} emails are allowed`,
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (!['rider', 'driver'].includes(role)) {
      return res.status(400).json({ message: 'Role must be either "rider" or "driver"' });
    }

    // Create auth user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({ message: authError.message });
    }

    const userId = authData.user?.id;

    // Create user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          email,
          name,
          role,
        },
      ])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ message: userError.message });
    }

    const token = generateToken(userId);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        createdAt: userData.created_at,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user?.id)
      .single();

    if (userError) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = generateToken(authData.user?.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        createdAt: userData.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
