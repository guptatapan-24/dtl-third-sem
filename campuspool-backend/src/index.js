import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import ridesRoutes from './routes/rides.js';
import requestsRoutes from './routes/requests.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(','),
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'CampusPool API is running' });
});

// Start server
const startServer = () => {
  try {
    console.log('Starting CampusPool API...');
    console.log('Supabase URL:', process.env.SUPABASE_URL ? '✓ Configured' : '✗ Not configured');
    console.log('JWT Secret:', process.env.JWT_SECRET ? '✓ Configured' : '✗ Not configured');

    app.listen(PORT, () => {
      console.log(`CampusPool API running on http://localhost:${PORT}`);
      console.log('Database: Supabase (configured via environment variables)');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
