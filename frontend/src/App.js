import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import { Toaster, toast } from 'sonner';
import { 
  Car, MapPin, Calendar, Clock, Users, DollarSign, 
  LogOut, User, Home, Search, Plus, CheckCircle, 
  XCircle, ChevronRight, Menu, X, Shield, Activity
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

// API Helper
const api = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'Something went wrong');
  }
  
  return data;
};

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api('/api/auth/me')
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const signup = async (email, password, name, role) => {
    const data = await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Navigation Component
const Navigation = ({ currentPage, setCurrentPage }) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = user?.is_admin
    ? [
        { id: 'admin', label: 'Dashboard', icon: Shield },
        { id: 'profile', label: 'Profile', icon: User },
      ]
    : user?.role === 'driver'
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'post-ride', label: 'Post Ride', icon: Plus },
        { id: 'requests', label: 'Requests', icon: Activity },
        { id: 'profile', label: 'Profile', icon: User },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'browse', label: 'Browse Rides', icon: Search },
        { id: 'my-requests', label: 'My Requests', icon: Activity },
        { id: 'profile', label: 'Profile', icon: User },
      ];

  return (
    <nav className="bg-black border-b border-[#333] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentPage('dashboard')}>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <Car className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-bold text-white">CampusPool</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
            <div className="h-6 w-px bg-[#333]" />
            <button
              onClick={logout}
              className="nav-link text-red-400 hover:text-red-300"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[#333] animate-fade-in">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left py-3 px-4 ${
                  currentPage === item.id ? 'text-white bg-[#1A1A1A]' : 'text-gray-400'
                } flex items-center gap-3 rounded-lg`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
            <button
              onClick={logout}
              className="w-full text-left py-3 px-4 text-red-400 flex items-center gap-3 rounded-lg mt-2"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

// Login Page
const LoginPage = ({ onSwitch }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 map-decoration" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black" />
        <div className="relative z-10 flex flex-col justify-center p-16">
          <div className="animate-slide-up">
            <h1 className="text-5xl font-bold text-white mb-4">CampusPool</h1>
            <p className="text-xl text-gray-400 max-w-md">
              Share rides with fellow students. Save money, reduce carbon footprint, make friends.
            </p>
          </div>
          <div className="mt-12 flex items-center gap-6">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-12 h-12 rounded-full bg-[#1A1A1A] border-2 border-black flex items-center justify-center"
                >
                  <User className="w-5 h-5 text-gray-500" />
                </div>
              ))}
            </div>
            <p className="text-gray-400">Join hundreds of RVCE students</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <Car className="w-7 h-7 text-black" />
            </div>
            <span className="text-2xl font-bold text-white">CampusPool</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-gray-400 mb-8">Sign in to continue to CampusPool</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-uber"
                placeholder="you@rvce.edu.in"
                required
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-uber"
                placeholder="••••••••"
                required
                data-testid="login-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-uber mt-6"
              data-testid="login-submit"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={onSwitch}
              className="text-white hover:underline font-medium"
              data-testid="switch-to-signup"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Signup Page
const SignupPage = ({ onSwitch }) => {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'rider',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(formData.email, formData.password, formData.name, formData.role);
      toast.success('Account created successfully!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 map-decoration" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black" />
        <div className="relative z-10 flex flex-col justify-center p-16">
          <div className="animate-slide-up">
            <h1 className="text-5xl font-bold text-white mb-4">Join CampusPool</h1>
            <p className="text-xl text-gray-400 max-w-md">
              Create an account with your RVCE email and start sharing rides today.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
              <Car className="w-8 h-8 text-[#06C167] mb-3" />
              <h3 className="text-white font-semibold mb-1">As a Driver</h3>
              <p className="text-gray-400 text-sm">Post rides and split costs</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
              <Users className="w-8 h-8 text-[#06C167] mb-3" />
              <h3 className="text-white font-semibold mb-1">As a Rider</h3>
              <p className="text-gray-400 text-sm">Find affordable rides</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <Car className="w-7 h-7 text-black" />
            </div>
            <span className="text-2xl font-bold text-white">CampusPool</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Create account</h2>
          <p className="text-gray-400 mb-8">Sign up with your RVCE email</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-uber"
                placeholder="John Doe"
                required
                data-testid="signup-name"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-uber"
                placeholder="you@rvce.edu.in"
                required
                data-testid="signup-email"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-uber"
                placeholder="••••••••"
                required
                minLength={6}
                data-testid="signup-password"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">I want to</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'rider' })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.role === 'rider'
                      ? 'border-white bg-white/5'
                      : 'border-[#333] hover:border-[#555]'
                  }`}
                  data-testid="role-rider"
                >
                  <Users className={`w-6 h-6 mx-auto mb-2 ${formData.role === 'rider' ? 'text-white' : 'text-gray-500'}`} />
                  <span className={formData.role === 'rider' ? 'text-white' : 'text-gray-500'}>
                    Find Rides
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'driver' })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.role === 'driver'
                      ? 'border-white bg-white/5'
                      : 'border-[#333] hover:border-[#555]'
                  }`}
                  data-testid="role-driver"
                >
                  <Car className={`w-6 h-6 mx-auto mb-2 ${formData.role === 'driver' ? 'text-white' : 'text-gray-500'}`} />
                  <span className={formData.role === 'driver' ? 'text-white' : 'text-gray-500'}>
                    Offer Rides
                  </span>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-uber mt-6"
              data-testid="signup-submit"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-8 text-center text-gray-400">
            Already have an account?{' '}
            <button
              onClick={onSwitch}
              className="text-white hover:underline font-medium"
              data-testid="switch-to-login"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Ride Card Component
const RideCard = ({ ride, onRequest, onViewDetails, showRequestButton = true, userRequests = [] }) => {
  const hasRequested = userRequests.some((r) => r.ride_id === ride.id);
  const requestStatus = userRequests.find((r) => r.ride_id === ride.id)?.status;

  return (
    <div className="ride-card animate-fade-in" data-testid={`ride-card-${ride.id}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#06C167]" />
            <span className="text-gray-400 text-sm">From</span>
          </div>
          <h3 className="text-white font-semibold text-lg">{ride.source}</h3>
        </div>
        <span className={`status-badge status-${ride.status}`}>
          {ride.status}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-px h-8 bg-[#333] ml-1" />
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-white" />
          <span className="text-gray-400 text-sm">To</span>
        </div>
        <h3 className="text-white font-semibold text-lg">{ride.destination}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-y border-[#333]">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm">{ride.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm">{ride.time}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm">{ride.seats_available} seats left</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm">₹{ride.cost_per_rider}/person</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center">
            <User className="w-4 h-4 text-gray-400" />
          </div>
          <span className="text-gray-300 text-sm">{ride.driver_name}</span>
        </div>

        {showRequestButton && (
          hasRequested ? (
            <span className={`status-badge status-${requestStatus}`}>
              {requestStatus === 'requested' ? 'Pending' : requestStatus}
            </span>
          ) : (
            <button
              onClick={() => onRequest(ride.id)}
              className="btn-uber-green py-2 px-4 text-sm flex items-center gap-2"
              data-testid={`request-ride-${ride.id}`}
            >
              Request <ChevronRight className="w-4 h-4" />
            </button>
          )
        )}
      </div>
    </div>
  );
};

// Driver Dashboard
const DriverDashboard = ({ setCurrentPage }) => {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, completed: 0, total: 0 });

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    try {
      const data = await api('/api/rides/driver/my-rides');
      setRides(data.rides);
      setStats({
        active: data.rides.filter((r) => r.status === 'active').length,
        completed: data.rides.filter((r) => r.status === 'completed').length,
        total: data.rides.length,
      });
    } catch (error) {
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async (rideId) => {
    try {
      await api(`/api/rides/${rideId}/complete`, { method: 'PUT' });
      toast.success('Ride marked as completed');
      loadRides();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteRide = async (rideId) => {
    try {
      await api(`/api/rides/${rideId}`, { method: 'DELETE' });
      toast.success('Ride deleted');
      loadRides();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="driver-dashboard">
      <Navigation currentPage="dashboard" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.name}
          </h1>
          <p className="text-gray-400">Manage your rides and requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Active Rides', value: stats.active, color: 'bg-[#06C167]' },
            { label: 'Completed', value: stats.completed, color: 'bg-blue-500' },
            { label: 'Total Rides', value: stats.total, color: 'bg-white' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`bg-[#1A1A1A] rounded-xl p-6 border border-[#333] animate-slide-up stagger-${i + 1}`}
            >
              <div className={`w-3 h-3 rounded-full ${stat.color} mb-4`} />
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setCurrentPage('post-ride')}
            className="btn-uber flex items-center gap-2"
            data-testid="post-ride-btn"
          >
            <Plus className="w-5 h-5" /> Post New Ride
          </button>
          <button
            onClick={() => setCurrentPage('requests')}
            className="btn-uber-dark flex items-center gap-2"
            data-testid="view-requests-btn"
          >
            <Activity className="w-5 h-5" /> View Requests
          </button>
        </div>

        {/* Rides List */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Your Rides</h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="ride-card">
                  <div className="skeleton h-6 w-32 mb-4 rounded" />
                  <div className="skeleton h-4 w-48 mb-2 rounded" />
                  <div className="skeleton h-4 w-40 rounded" />
                </div>
              ))}
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No rides posted yet</p>
              <button
                onClick={() => setCurrentPage('post-ride')}
                className="btn-uber-green"
              >
                Post Your First Ride
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rides.map((ride) => (
                <div key={ride.id} className="ride-card" data-testid={`driver-ride-${ride.id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold">{ride.source}</h3>
                      <p className="text-gray-400 text-sm">to {ride.destination}</p>
                    </div>
                    <span className={`status-badge status-${ride.status}`}>
                      {ride.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4" /> {ride.date}
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" /> {ride.time}
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Users className="w-4 h-4" /> {ride.seats_taken}/{ride.available_seats} booked
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <DollarSign className="w-4 h-4" /> ₹{ride.estimated_cost} total
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {ride.status === 'active' && (
                      <>
                        <button
                          onClick={() => completeRide(ride.id)}
                          className="flex-1 btn-uber-green py-2 text-sm"
                          data-testid={`complete-ride-${ride.id}`}
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => deleteRide(ride.id)}
                          className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition"
                          data-testid={`delete-ride-${ride.id}`}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Rider Dashboard
const RiderDashboard = ({ setCurrentPage }) => {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ridesData, requestsData] = await Promise.all([
        api('/api/rides'),
        api('/api/ride-requests/my-requests'),
      ]);
      setRides(ridesData.rides.slice(0, 4));
      setRequests(requestsData.requests);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const requestRide = async (rideId) => {
    try {
      await api('/api/ride-requests', {
        method: 'POST',
        body: JSON.stringify({ ride_id: rideId }),
      });
      toast.success('Ride requested!');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const stats = {
    pending: requests.filter((r) => r.status === 'requested').length,
    accepted: requests.filter((r) => r.status === 'accepted').length,
    completed: requests.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-black" data-testid="rider-dashboard">
      <Navigation currentPage="dashboard" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">
            Hey, {user?.name}! 👋
          </h1>
          <p className="text-gray-400">Find your next ride</p>
        </div>

        {/* Quick Search */}
        <div
          className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] mb-8 cursor-pointer card-hover"
          onClick={() => setCurrentPage('browse')}
          data-testid="quick-search"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Where are you going?</p>
              <p className="text-gray-500 text-sm">Find available rides</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Pending', value: stats.pending, color: 'bg-yellow-500' },
            { label: 'Accepted', value: stats.accepted, color: 'bg-[#06C167]' },
            { label: 'Completed', value: stats.completed, color: 'bg-blue-500' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`bg-[#1A1A1A] rounded-xl p-4 border border-[#333] animate-slide-up stagger-${i + 1}`}
            >
              <div className={`w-2 h-2 rounded-full ${stat.color} mb-2`} />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Available Rides */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Available Rides</h2>
            <button
              onClick={() => setCurrentPage('browse')}
              className="text-[#06C167] hover:underline text-sm flex items-center gap-1"
            >
              See all <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="ride-card">
                  <div className="skeleton h-6 w-32 mb-4 rounded" />
                  <div className="skeleton h-4 w-48 mb-2 rounded" />
                </div>
              ))}
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-8 bg-[#1A1A1A] rounded-xl border border-[#333]">
              <Car className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No rides available right now</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onRequest={requestRide}
                  userRequests={requests}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Post Ride Page
const PostRidePage = ({ setCurrentPage }) => {
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    date: '',
    time: '',
    available_seats: 3,
    estimated_cost: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/api/rides', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          available_seats: parseInt(formData.available_seats),
          estimated_cost: parseFloat(formData.estimated_cost),
        }),
      });
      toast.success('Ride posted successfully!');
      setCurrentPage('dashboard');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="post-ride-page">
      <Navigation currentPage="post-ride" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Post a Ride</h1>
          <p className="text-gray-400">Share your journey and split costs</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#06C167]" /> Route
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Pickup Location</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="input-uber"
                  placeholder="e.g., RVCE Campus"
                  required
                  data-testid="ride-source"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Drop Location</label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="input-uber"
                  placeholder="e.g., Majestic Bus Stand"
                  required
                  data-testid="ride-destination"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#06C167]" /> Schedule
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input-uber"
                  required
                  data-testid="ride-date"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="input-uber"
                  required
                  data-testid="ride-time"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#06C167]" /> Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Available Seats</label>
                <select
                  value={formData.available_seats}
                  onChange={(e) => setFormData({ ...formData, available_seats: e.target.value })}
                  className="input-uber"
                  data-testid="ride-seats"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? 'seat' : 'seats'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Total Cost (₹)</label>
                <input
                  type="number"
                  value={formData.estimated_cost}
                  onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                  className="input-uber"
                  placeholder="500"
                  min="0"
                  required
                  data-testid="ride-cost"
                />
              </div>
            </div>
            {formData.estimated_cost && formData.available_seats && (
              <div className="mt-4 p-4 bg-[#06C167]/10 rounded-lg border border-[#06C167]/30">
                <p className="text-[#06C167] text-sm">
                  Cost per rider: ₹{Math.round(parseFloat(formData.estimated_cost) / parseInt(formData.available_seats))}
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-uber text-lg py-4"
            data-testid="submit-ride"
          >
            {loading ? 'Posting...' : 'Post Ride'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Browse Rides Page
const BrowseRidesPage = ({ setCurrentPage }) => {
  const [rides, setRides] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ destination: '', date: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.destination) params.append('destination', filters.destination);
      if (filters.date) params.append('date', filters.date);
      
      const [ridesData, requestsData] = await Promise.all([
        api(`/api/rides?${params.toString()}`),
        api('/api/ride-requests/my-requests'),
      ]);
      setRides(ridesData.rides);
      setRequests(requestsData.requests);
    } catch (error) {
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  const requestRide = async (rideId) => {
    try {
      await api('/api/ride-requests', {
        method: 'POST',
        body: JSON.stringify({ ride_id: rideId }),
      });
      toast.success('Ride requested successfully!');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="min-h-screen bg-black" data-testid="browse-rides-page">
      <Navigation currentPage="browse" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Browse Rides</h1>
          <p className="text-gray-400">Find available rides to your destination</p>
        </div>

        {/* Search Filters */}
        <form onSubmit={handleSearch} className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333] mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={filters.destination}
                onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
                className="input-uber"
                placeholder="Search destination..."
                data-testid="search-destination"
              />
            </div>
            <div className="md:w-48">
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="input-uber"
                data-testid="search-date"
              />
            </div>
            <button type="submit" className="btn-uber flex items-center justify-center gap-2" data-testid="search-btn">
              <Search className="w-5 h-5" /> Search
            </button>
          </div>
        </form>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ride-card">
                <div className="skeleton h-6 w-32 mb-4 rounded" />
                <div className="skeleton h-4 w-48 mb-2 rounded" />
                <div className="skeleton h-4 w-40 rounded" />
              </div>
            ))}
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No rides found</h3>
            <p className="text-gray-400">Try adjusting your search filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onRequest={requestRide}
                userRequests={requests}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// My Requests Page (Rider)
const MyRequestsPage = ({ setCurrentPage }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await api('/api/ride-requests/my-requests');
      setRequests(data.requests);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="my-requests-page">
      <Navigation currentPage="my-requests" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">My Ride Requests</h1>
          <p className="text-gray-400">Track your ride requests</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="ride-card">
                <div className="skeleton h-6 w-32 mb-4 rounded" />
                <div className="skeleton h-4 w-48 rounded" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No requests yet</h3>
            <p className="text-gray-400 mb-4">Start by browsing available rides</p>
            <button
              onClick={() => setCurrentPage('browse')}
              className="btn-uber-green"
            >
              Browse Rides
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="ride-card animate-fade-in" data-testid={`request-${request.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold">{request.ride_source}</h3>
                    <p className="text-gray-400 text-sm">to {request.ride_destination}</p>
                  </div>
                  <span className={`status-badge status-${request.status}`}>
                    {request.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> {request.ride_date}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {request.ride_time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Driver Requests Page
const DriverRequestsPage = ({ setCurrentPage }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await api('/api/ride-requests/driver/pending');
      setRequests(data.requests);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId, action) => {
    try {
      await api(`/api/ride-requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
      toast.success(`Request ${action}ed`);
      loadRequests();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="driver-requests-page">
      <Navigation currentPage="requests" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Ride Requests</h1>
          <p className="text-gray-400">Manage incoming ride requests</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="ride-card">
                <div className="skeleton h-6 w-32 mb-4 rounded" />
                <div className="skeleton h-4 w-48 rounded" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No pending requests</h3>
            <p className="text-gray-400">Check back later for new ride requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="ride-card animate-fade-in" data-testid={`pending-request-${request.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold">{request.rider_name}</h3>
                    <p className="text-gray-400 text-sm">{request.rider_email}</p>
                  </div>
                  <span className="status-badge status-requested">Pending</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                  <span>{request.ride_source} → {request.ride_destination}</span>
                  <span>{request.ride_date} at {request.ride_time}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequest(request.id, 'accept')}
                    className="flex-1 btn-uber-green py-2 flex items-center justify-center gap-2"
                    data-testid={`accept-request-${request.id}`}
                  >
                    <CheckCircle className="w-4 h-4" /> Accept
                  </button>
                  <button
                    onClick={() => handleRequest(request.id, 'reject')}
                    className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center gap-2 hover:bg-red-500/30 transition"
                    data-testid={`reject-request-${request.id}`}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Profile Page
const ProfilePage = ({ setCurrentPage }) => {
  const { user, updateUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    role: user?.role || 'rider',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      updateUser(data.user);
      toast.success('Profile updated!');
      setEditing(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="profile-page">
      <Navigation currentPage="profile" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
          <p className="text-gray-400">Manage your account</p>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] mb-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-[#333] flex items-center justify-center">
              <User className="w-10 h-10 text-gray-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user?.name}</h2>
              <p className="text-gray-400">{user?.email}</p>
              <span className={`status-badge mt-2 ${user?.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                {user?.role}
              </span>
            </div>
          </div>

          {!user?.is_admin && (
            editing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-uber"
                    data-testid="profile-name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input-uber"
                    data-testid="profile-role"
                  >
                    <option value="rider">Rider</option>
                    <option value="driver">Driver</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="flex-1 btn-uber-green" data-testid="save-profile">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="btn-uber-dark"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="btn-uber-dark w-full"
                data-testid="edit-profile-btn"
              >
                Edit Profile
              </button>
            )
          )}
        </div>

        <button
          onClick={logout}
          className="w-full py-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition flex items-center justify-center gap-2"
          data-testid="logout-profile-btn"
        >
          <LogOut className="w-5 h-5" /> Sign Out
        </button>
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = ({ setCurrentPage }) => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, usersData, ridesData] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/users'),
        api('/api/admin/rides'),
      ]);
      setStats(statsData.stats);
      setUsers(usersData.users);
      setRides(ridesData.rides);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-dashboard">
      <Navigation currentPage="admin" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Monitor and manage CampusPool</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {['overview', 'users', 'rides'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-xl font-medium capitalize transition ${
                activeTab === tab
                  ? 'bg-white text-black'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
              }`}
              data-testid={`admin-tab-${tab}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
                <div className="skeleton h-8 w-16 mb-2 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'overview' && stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                {[
                  { label: 'Total Users', value: stats.total_users, color: 'bg-white' },
                  { label: 'Riders', value: stats.total_riders, color: 'bg-blue-500' },
                  { label: 'Drivers', value: stats.total_drivers, color: 'bg-[#06C167]' },
                  { label: 'Total Rides', value: stats.total_rides, color: 'bg-purple-500' },
                  { label: 'Active Rides', value: stats.active_rides, color: 'bg-yellow-500' },
                  { label: 'Completed', value: stats.completed_rides, color: 'bg-gray-500' },
                  { label: 'Total Requests', value: stats.total_requests, color: 'bg-orange-500' },
                  { label: 'Pending', value: stats.pending_requests, color: 'bg-red-500' },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    className={`bg-[#1A1A1A] rounded-xl p-6 border border-[#333] animate-slide-up`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className={`w-3 h-3 rounded-full ${stat.color} mb-3`} />
                    <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                    <p className="text-gray-500 text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0D0D0D]">
                      <tr>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Name</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Email</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Role</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-t border-[#333]" data-testid={`admin-user-${user.id}`}>
                          <td className="px-6 py-4 text-white">{user.name}</td>
                          <td className="px-6 py-4 text-gray-400">{user.email}</td>
                          <td className="px-6 py-4">
                            <span className={`status-badge ${user.is_admin ? 'bg-purple-500/20 text-purple-400' : user.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                              {user.is_admin ? 'admin' : user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-sm">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'rides' && (
              <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0D0D0D]">
                      <tr>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Route</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Driver</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Date</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Seats</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rides.map((ride) => (
                        <tr key={ride.id} className="border-t border-[#333]" data-testid={`admin-ride-${ride.id}`}>
                          <td className="px-6 py-4">
                            <p className="text-white">{ride.source}</p>
                            <p className="text-gray-500 text-sm">to {ride.destination}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-400">{ride.driver_name}</td>
                          <td className="px-6 py-4 text-gray-400">{ride.date} {ride.time}</td>
                          <td className="px-6 py-4 text-gray-400">{ride.seats_taken}/{ride.available_seats}</td>
                          <td className="px-6 py-4">
                            <span className={`status-badge status-${ride.status}`}>
                              {ride.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Main App Component
const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Car className="w-8 h-8 text-black" />
          </div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return authMode === 'login' ? (
      <LoginPage onSwitch={() => setAuthMode('signup')} />
    ) : (
      <SignupPage onSwitch={() => setAuthMode('login')} />
    );
  }

  // Admin routes
  if (user.is_admin) {
    switch (currentPage) {
      case 'profile':
        return <ProfilePage setCurrentPage={setCurrentPage} />;
      default:
        return <AdminDashboard setCurrentPage={setCurrentPage} />;
    }
  }

  // Driver routes
  if (user.role === 'driver') {
    switch (currentPage) {
      case 'post-ride':
        return <PostRidePage setCurrentPage={setCurrentPage} />;
      case 'requests':
        return <DriverRequestsPage setCurrentPage={setCurrentPage} />;
      case 'profile':
        return <ProfilePage setCurrentPage={setCurrentPage} />;
      default:
        return <DriverDashboard setCurrentPage={setCurrentPage} />;
    }
  }

  // Rider routes
  switch (currentPage) {
    case 'browse':
      return <BrowseRidesPage setCurrentPage={setCurrentPage} />;
    case 'my-requests':
      return <MyRequestsPage setCurrentPage={setCurrentPage} />;
    case 'profile':
      return <ProfilePage setCurrentPage={setCurrentPage} />;
    default:
      return <RiderDashboard setCurrentPage={setCurrentPage} />;
  }
};

function App() {
  return (
    <AuthProvider>
      <div className="dark">
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#fff',
              border: '1px solid #333',
            },
          }}
        />
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;
