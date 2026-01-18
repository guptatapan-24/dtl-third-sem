import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import './App.css';
import { Toaster, toast } from 'sonner';
import { 
  Car, MapPin, Calendar, Clock, Users, DollarSign, 
  LogOut, User, Home, Search, Plus, CheckCircle, 
  XCircle, ChevronRight, Menu, X, Shield, Activity,
  Upload, AlertCircle, Check, FileCheck, BadgeCheck,
  MessageCircle, Send, Key, Play, Navigation as NavigationIcon,
  Phone, AlertTriangle, CheckCircle2, Eye, EyeOff, MapPinned, Crosshair
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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

// Map Location Picker Component - Click on map to select location
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
};

// Component to fly to location
const FlyToLocation = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 14);
    }
  }, [center, map]);
  return null;
};

// Map Location Picker Modal
const MapLocationPicker = ({ isOpen, onClose, onSelect, title, initialPosition }) => {
  const [selectedPosition, setSelectedPosition] = useState(initialPosition);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [flyToCenter, setFlyToCenter] = useState(null);
  
  // Default center: Bangalore (RVCE area)
  const defaultCenter = [12.9230, 77.4993];
  
  const handleLocationSelect = (latlng) => {
    setSelectedPosition(latlng);
  };
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      // Using Nominatim (free OpenStreetMap geocoding)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=in`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      toast.error('Search failed. Try again.');
    } finally {
      setIsSearching(false);
    }
  };
  
  const selectSearchResult = (result) => {
    const position = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setSelectedPosition(position);
    setFlyToCenter([position.lat, position.lng]);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
  };
  
  const handleConfirm = async () => {
    if (!selectedPosition) {
      toast.error('Please select a location on the map');
      return;
    }
    
    // Reverse geocode to get address
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedPosition.lat}&lon=${selectedPosition.lng}`
      );
      const data = await response.json();
      const address = data.display_name || `${selectedPosition.lat.toFixed(4)}, ${selectedPosition.lng.toFixed(4)}`;
      const shortAddress = address.split(',').slice(0, 3).join(', ');
      
      onSelect({
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        address: shortAddress
      });
      onClose();
    } catch (error) {
      // Use coordinates as address fallback
      onSelect({
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        address: `${selectedPosition.lat.toFixed(4)}, ${selectedPosition.lng.toFixed(4)}`
      });
      onClose();
    }
  };
  
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
          setSelectedPosition(pos);
          setFlyToCenter([pos.lat, pos.lng]);
          toast.success('Location found!');
        },
        (error) => {
          toast.error('Could not get your location');
        }
      );
    } else {
      toast.error('Geolocation not supported');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] rounded-xl w-full max-w-2xl border border-[#333] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="map-picker-modal"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#333]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input-uber flex-1"
              placeholder="Search location..."
              data-testid="map-search-input"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="btn-uber-dark px-4"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={getCurrentLocation}
              className="btn-uber-green px-4"
              title="Use current location"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-2 bg-[#0D0D0D] rounded-lg border border-[#333] max-h-40 overflow-y-auto">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => selectSearchResult(result)}
                  className="w-full text-left px-3 py-2 hover:bg-[#333] text-white text-sm border-b border-[#333] last:border-b-0"
                >
                  <MapPin className="w-4 h-4 inline mr-2 text-[#06C167]" />
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Map */}
        <div className="h-80">
          <MapContainer
            center={initialPosition ? [initialPosition.lat, initialPosition.lng] : defaultCenter}
            zoom={13}
            className="h-full w-full"
            style={{ background: '#0D0D0D' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="map-tiles-dark"
            />
            <MapClickHandler onLocationSelect={handleLocationSelect} />
            {flyToCenter && <FlyToLocation center={flyToCenter} />}
            {selectedPosition && (
              <Marker position={[selectedPosition.lat, selectedPosition.lng]} icon={greenIcon} />
            )}
          </MapContainer>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-[#333]">
          {selectedPosition && (
            <p className="text-gray-400 text-sm mb-3">
              Selected: {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 btn-uber-dark py-3">
              Cancel
            </button>
            <button 
              onClick={handleConfirm} 
              className="flex-1 btn-uber-green py-3"
              disabled={!selectedPosition}
              data-testid="confirm-location-btn"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Route Map Component - Displays route between two points
const RouteMap = ({ sourceLat, sourceLng, destLat, destLng, sourceLabel, destLabel }) => {
  const [route, setRoute] = useState([]);
  
  useEffect(() => {
    const fetchRoute = async () => {
      if (!sourceLat || !sourceLng || !destLat || !destLng) return;
      
      try {
        // Use OSRM for routing (free)
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${sourceLng},${sourceLat};${destLng},${destLat}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          setRoute(coords);
        }
      } catch (error) {
        console.error('Failed to fetch route:', error);
        // Fallback to straight line
        setRoute([[sourceLat, sourceLng], [destLat, destLng]]);
      }
    };
    
    fetchRoute();
  }, [sourceLat, sourceLng, destLat, destLng]);
  
  if (!sourceLat || !sourceLng || !destLat || !destLng) {
    return (
      <div className="h-64 bg-[#0D0D0D] rounded-xl flex items-center justify-center">
        <p className="text-gray-500">No route coordinates available</p>
      </div>
    );
  }
  
  const center = [(sourceLat + destLat) / 2, (sourceLng + destLng) / 2];
  
  return (
    <div className="h-64 rounded-xl overflow-hidden">
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full"
        style={{ background: '#0D0D0D' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[sourceLat, sourceLng]} icon={greenIcon} />
        <Marker position={[destLat, destLng]} icon={redIcon} />
        {route.length > 0 && (
          <Polyline 
            positions={route} 
            color="#06C167" 
            weight={4}
            opacity={0.8}
          />
        )}
      </MapContainer>
    </div>
  );
};

// Verified Badge Component
const VerifiedBadge = ({ status, size = 'sm' }) => {
  if (status !== 'verified') return null;
  
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-white flex items-center justify-center flex-shrink-0`}
      title="Verified Student"
      data-testid="verified-badge"
    >
      <Check className={`${size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} text-black`} />
    </div>
  );
};

// Verification Status Badge
const VerificationStatusBadge = ({ status }) => {
  const statusConfig = {
    verified: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Verified' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
    unverified: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Unverified' }
  };
  
  const config = statusConfig[status] || statusConfig.unverified;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {status === 'verified' && <Check className="w-3 h-3" />}
      {status === 'pending' && <Clock className="w-3 h-3" />}
      {status === 'rejected' && <XCircle className="w-3 h-3" />}
      {status === 'unverified' && <AlertCircle className="w-3 h-3" />}
      {config.label}
    </span>
  );
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

  const refreshUser = async () => {
    try {
      const data = await api('/api/auth/me');
      setUser(data.user);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, updateUser, refreshUser }}>
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
        { id: 'sos', label: 'SOS Alerts', icon: AlertTriangle },
        { id: 'verifications', label: 'Verifications', icon: FileCheck },
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

// Profile Modal Component
const ProfileModal = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await api(`/api/users/${userId}/profile`);
        setProfile(data.profile);
      } catch (error) {
        toast.error('Failed to load profile');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [userId, onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-[#1A1A1A] rounded-xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="animate-pulse">
            <div className="w-20 h-20 rounded-full bg-[#333] mx-auto mb-4" />
            <div className="h-6 bg-[#333] rounded w-32 mx-auto mb-2" />
            <div className="h-4 bg-[#333] rounded w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] rounded-xl p-8 max-w-md w-full mx-4 border border-[#333] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="profile-modal"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[#333] flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-gray-400" />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <h3 className="text-xl font-semibold text-white">{profile?.name}</h3>
            <VerifiedBadge status={profile?.verification_status} size="sm" />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className={`status-badge ${profile?.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
              {profile?.role}
            </span>
            <VerificationStatusBadge status={profile?.verification_status} />
          </div>

          <div className="bg-[#0D0D0D] rounded-lg p-4 mt-4">
            <p className="text-gray-400 text-sm mb-1">Completed Rides</p>
            <p className="text-2xl font-bold text-white">{profile?.ride_count || 0}</p>
          </div>

          <p className="text-gray-500 text-sm mt-4">
            Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full btn-uber-dark mt-6"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// Chat Modal Component - Phase 3
const ChatModal = ({ requestId, otherUserName, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const data = await api(`/api/chat/${requestId}/messages`);
      setMessages(data.messages);
      setChatEnabled(data.chat_enabled);
    } catch (error) {
      if (error.message.includes('only available after')) {
        setChatEnabled(false);
      }
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 3 seconds
    pollIntervalRef.current = setInterval(loadMessages, 3000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [requestId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !chatEnabled) return;

    setSending(true);
    try {
      await api(`/api/chat/${requestId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: newMessage.trim() }),
      });
      setNewMessage('');
      loadMessages();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] rounded-xl w-full max-w-lg h-[600px] mx-4 border border-[#333] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="chat-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">{otherUserName}</h3>
              <p className="text-xs text-gray-500">
                {chatEnabled ? 'Chat active' : 'Chat disabled'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
            data-testid="close-chat-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-gray-500">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No messages yet</p>
                <p className="text-gray-600 text-sm">Start the conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`chat-message ${msg.sender_id === user?.id ? 'chat-message-own' : 'chat-message-other'}`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  {msg.sender_id !== user?.id && (
                    <p className="text-xs text-gray-400 mb-1">{msg.sender_name}</p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="chat-input-container">
          {chatEnabled ? (
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="input-uber flex-1"
                placeholder="Type a message..."
                maxLength={1000}
                data-testid="chat-input"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="btn-uber-green px-4 disabled:opacity-50"
                data-testid="send-message-btn"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          ) : (
            <div className="text-center text-gray-500 py-2">
              <p className="text-sm">Chat is disabled after ride completion</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Live Ride Screen Component - Phase 4
const LiveRideScreen = ({ requestId, onBack }) => {
  const { user } = useAuth();
  const [rideData, setRideData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [reachingLoading, setReachingLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const loadRideData = async () => {
    try {
      const data = await api(`/api/ride-requests/${requestId}/live`);
      setRideData(data.ride);
      setSosTriggered(data.ride.has_active_sos);
    } catch (error) {
      toast.error('Failed to load ride details');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRideData();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadRideData, 10000);
    return () => clearInterval(interval);
  }, [requestId]);

  const handleSOS = async () => {
    setSosLoading(true);
    try {
      // Try to get user's location
      let latitude = null;
      let longitude = null;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (e) {
          console.log('Could not get location:', e);
        }
      }

      await api('/api/sos', {
        method: 'POST',
        body: JSON.stringify({
          ride_request_id: requestId,
          latitude,
          longitude,
          message: 'Emergency SOS triggered'
        }),
      });
      
      toast.success('🚨 SOS Alert Sent! Help is on the way.');
      setSosTriggered(true);
      setShowSosConfirm(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSosLoading(false);
    }
  };

  const handleReachedSafely = async () => {
    setReachingLoading(true);
    try {
      await api(`/api/ride-requests/${requestId}/reached-safely`, {
        method: 'POST',
      });
      toast.success('🎉 You\'ve arrived safely! Ride completed.');
      onBack();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setReachingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Car className="w-8 h-8 text-black" />
          </div>
          <p className="text-gray-400">Loading ride details...</p>
        </div>
      </div>
    );
  }

  if (!rideData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-white mb-4">Ride not found</p>
          <button onClick={onBack} className="btn-uber">Go Back</button>
        </div>
      </div>
    );
  }

  const isRider = rideData.rider_id === user?.id;
  const isDriver = rideData.driver_id === user?.id;
  const isOngoing = rideData.status === 'ongoing';

  // Check if coordinates are available for route visualization
  const hasCoordinates = rideData.source_lat && rideData.source_lng && 
                         rideData.destination_lat && rideData.destination_lng;

  return (
    <div className="min-h-screen bg-black" data-testid="live-ride-screen">
      {/* Header */}
      <div className="bg-black border-b border-[#333] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white flex items-center gap-2"
              data-testid="back-btn"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <span className={`status-badge ${isOngoing ? 'bg-purple-500/20 text-purple-400' : 'status-' + rideData.status}`}>
                {isOngoing ? '🚗 Ongoing' : rideData.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Map Section - Using RouteMap component for actual route visualization */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden mb-6">
          <div className="relative">
            {/* Route Map with actual coordinates */}
            {hasCoordinates ? (
              <RouteMap
                sourceLat={rideData.source_lat}
                sourceLng={rideData.source_lng}
                destLat={rideData.destination_lat}
                destLng={rideData.destination_lng}
                sourceLabel={rideData.ride_source}
                destLabel={rideData.ride_destination}
              />
            ) : (
              <div className="h-64 bg-[#0D0D0D] flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Route visualization unavailable</p>
                  <p className="text-gray-600 text-xs">Coordinates not available for this ride</p>
                </div>
              </div>
            )}
            {/* Live Route Badge */}
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#333] z-[1000]">
              <div className="flex items-center gap-2 text-[#06C167]">
                <NavigationIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Live Route</span>
              </div>
            </div>
          </div>
          {/* Route Summary Bar */}
          <div className="bg-[#0D0D0D] px-4 py-3 border-t border-[#333]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#06C167]" />
                <span className="text-white text-sm truncate max-w-[120px] md:max-w-none">{rideData.ride_source}</span>
              </div>
              <div className="flex-1 mx-4 h-px bg-[#333] relative">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <Car className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white text-sm truncate max-w-[120px] md:max-w-none">{rideData.ride_destination}</span>
                <div className="w-3 h-3 rounded-full bg-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Ride Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Driver/Rider Info */}
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333]">
            <h3 className="text-gray-400 text-sm mb-3">{isRider ? 'Your Driver' : 'Your Rider'}</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="text-white font-semibold flex items-center gap-2">
                  {isRider ? rideData.driver_name : rideData.rider_name}
                  {(isRider ? rideData.driver_verification_status : rideData.rider_verification_status) === 'verified' && (
                    <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-black" />
                    </span>
                  )}
                </p>
                <p className="text-gray-500 text-sm">{isRider ? 'Driver' : 'Rider'} • Verified</p>
              </div>
            </div>
            
            {/* Vehicle Details - Only shown to rider */}
            {isRider && (rideData.driver_vehicle_model || rideData.driver_vehicle_number || rideData.driver_vehicle_color) && (
              <div className="mt-4 p-3 bg-[#0D0D0D] rounded-lg border border-[#333]" data-testid="vehicle-details">
                <p className="text-gray-500 text-xs mb-2 flex items-center gap-1">
                  <Car className="w-3 h-3" /> VEHICLE
                </p>
                <div className="space-y-1">
                  {rideData.driver_vehicle_model && (
                    <p className="text-white text-sm font-medium">{rideData.driver_vehicle_model}</p>
                  )}
                  {rideData.driver_vehicle_number && (
                    <p className="text-[#06C167] text-sm font-mono">{rideData.driver_vehicle_number}</p>
                  )}
                  {rideData.driver_vehicle_color && (
                    <p className="text-gray-400 text-xs">{rideData.driver_vehicle_color}</p>
                  )}
                </div>
              </div>
            )}
            
            <button
              onClick={() => setShowChat(true)}
              className="w-full mt-4 btn-uber-dark py-2 flex items-center justify-center gap-2"
              data-testid="live-chat-btn"
            >
              <MessageCircle className="w-4 h-4" />
              Message
            </button>
          </div>

          {/* Time Info */}
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333]">
            <h3 className="text-gray-400 text-sm mb-3">Ride Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Date
                </span>
                <span className="text-white">{rideData.ride_date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Scheduled Time
                </span>
                <span className="text-white">{rideData.ride_time}</span>
              </div>
              {rideData.ride_started_at && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <Play className="w-4 h-4" /> Started
                  </span>
                  <span className="text-[#06C167]">
                    {new Date(rideData.ride_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {rideData.estimated_arrival && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <MapPinned className="w-4 h-4" /> ETA
                  </span>
                  <span className="text-white">
                    {new Date(rideData.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {rideData.estimated_duration_minutes && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Duration
                  </span>
                  <span className="text-white">~{rideData.estimated_duration_minutes} mins</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Route Summary Card */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333] mb-6">
          <h3 className="text-gray-400 text-sm mb-4">Route Summary</h3>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-[#06C167] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <div className="w-0.5 h-12 bg-[#333]" />
              <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-black" />
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-4">
                <p className="text-gray-500 text-xs mb-1">PICKUP</p>
                <p className="text-white font-medium">{rideData.ride_source}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">DROP-OFF</p>
                <p className="text-white font-medium">{rideData.ride_destination}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs mb-1">COST</p>
              <p className="text-white font-semibold">₹{rideData.ride_estimated_cost}</p>
            </div>
          </div>
        </div>

        {/* SOS Active Alert */}
        {sosTriggered && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-red-400 font-semibold">SOS Alert Active</p>
                <p className="text-red-400/70 text-sm">Emergency services have been notified</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons for Ongoing Ride */}
        {isOngoing && (
          <div className="space-y-4">
            {/* Reached Safely Button - Only for Rider */}
            {isRider && (
              <button
                onClick={handleReachedSafely}
                disabled={reachingLoading}
                className="w-full bg-[#06C167] hover:bg-[#05a857] text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition disabled:opacity-50"
                data-testid="reached-safely-btn"
              >
                <CheckCircle2 className="w-6 h-6" />
                {reachingLoading ? 'Confirming...' : 'I\'ve Reached Safely'}
              </button>
            )}

            {/* SOS Button */}
            {!sosTriggered ? (
              <button
                onClick={() => setShowSosConfirm(true)}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold py-4 rounded-xl flex items-center justify-center gap-3 border border-red-500/50 transition"
                data-testid="sos-btn"
              >
                <AlertTriangle className="w-6 h-6" />
                Emergency SOS
              </button>
            ) : (
              <div className="w-full bg-red-500/10 text-red-400/70 font-medium py-4 rounded-xl flex items-center justify-center gap-3 border border-red-500/30">
                <Check className="w-5 h-5" />
                SOS Alert Already Sent
              </div>
            )}
          </div>
        )}

        {/* Ride Completed Message */}
        {rideData.status === 'completed' && (
          <div className="bg-[#06C167]/20 border border-[#06C167]/50 rounded-xl p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#06C167] mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Ride Completed!</p>
            {rideData.reached_safely_at && (
              <p className="text-gray-400 text-sm">
                Arrived safely at {new Date(rideData.reached_safely_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* SOS Confirmation Modal */}
      {showSosConfirm && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowSosConfirm(false)}>
          <div 
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-sm w-full border border-red-500/50 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            data-testid="sos-confirm-modal"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Trigger Emergency SOS?</h3>
              <p className="text-gray-400 text-sm">
                This will alert the admin and log your current location. Use only in genuine emergencies.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleSOS}
                disabled={sosLoading}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                data-testid="confirm-sos-btn"
              >
                {sosLoading ? 'Sending Alert...' : 'Yes, Send SOS Alert'}
              </button>
              <button
                onClick={() => setShowSosConfirm(false)}
                className="w-full btn-uber-dark py-3"
                data-testid="cancel-sos-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChat && (
        <ChatModal
          requestId={requestId}
          otherUserName={isRider ? rideData.driver_name : rideData.rider_name}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};

// Admin SOS Monitoring Page - Phase 4
const AdminSOSPage = ({ setCurrentPage }) => {
  const [sosEvents, setSosEvents] = useState([]);
  const [counts, setCounts] = useState({ active: 0, reviewed: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedSOS, setSelectedSOS] = useState(null);

  const loadSOS = async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const data = await api(`/api/admin/sos${params}`);
      setSosEvents(data.sos_events);
      setCounts(data.counts);
    } catch (error) {
      toast.error('Failed to load SOS events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSOS();
    // Poll for updates every 15 seconds
    const interval = setInterval(loadSOS, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleAction = async (sosId, action, notes = '') => {
    setActionLoading(sosId);
    try {
      await api(`/api/admin/sos/${sosId}`, {
        method: 'PUT',
        body: JSON.stringify({ action, notes }),
      });
      toast.success(`SOS ${action === 'review' ? 'marked as reviewed' : 'resolved'}!`);
      loadSOS();
      setSelectedSOS(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'reviewed': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'resolved': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-sos-page">
      <Navigation currentPage="sos" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">SOS Monitoring</h1>
          <p className="text-gray-400">Monitor and respond to emergency alerts</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active', value: counts.active, color: 'bg-red-500', urgent: counts.active > 0 },
            { label: 'Reviewed', value: counts.reviewed, color: 'bg-yellow-500' },
            { label: 'Resolved', value: counts.resolved, color: 'bg-green-500' },
            { label: 'Total', value: counts.total, color: 'bg-white' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`bg-[#1A1A1A] rounded-xl p-4 border ${stat.urgent ? 'border-red-500 animate-pulse' : 'border-[#333]'}`}
            >
              <div className={`w-3 h-3 rounded-full ${stat.color} mb-2`} />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'active', 'reviewed', 'resolved'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition whitespace-nowrap ${
                filter === f
                  ? 'bg-white text-black'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-[#333]'
              }`}
              data-testid={`filter-${f}`}
            >
              {f === 'all' ? 'All SOS' : f}
              {f === 'active' && counts.active > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {counts.active}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* SOS List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
                <div className="skeleton h-6 w-32 mb-4 rounded" />
                <div className="skeleton h-4 w-48 rounded" />
              </div>
            ))}
          </div>
        ) : sosEvents.length === 0 ? (
          <div className="text-center py-16 bg-[#1A1A1A] rounded-xl border border-[#333]">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {filter === 'all' ? 'No SOS Events' : `No ${filter} SOS events`}
            </h3>
            <p className="text-gray-400">
              {filter === 'active' ? 'Great! No active emergencies right now.' : 'No events to display.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sosEvents.map((sos) => (
              <div
                key={sos.id}
                className={`bg-[#1A1A1A] rounded-xl p-6 border ${
                  sos.status === 'active' ? 'border-red-500/50 animate-pulse-subtle' : 'border-[#333]'
                }`}
                data-testid={`sos-event-${sos.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      sos.status === 'active' ? 'bg-red-500/20' : sos.status === 'reviewed' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        sos.status === 'active' ? 'text-red-500' : sos.status === 'reviewed' ? 'text-yellow-500' : 'text-green-500'
                      }`} />
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        SOS from {sos.triggered_by_name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {new Date(sos.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(sos.status)}`}>
                    {sos.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#0D0D0D] rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-2">ROUTE</p>
                    <p className="text-white text-sm">{sos.ride_source}</p>
                    <p className="text-gray-400 text-xs my-1">to</p>
                    <p className="text-white text-sm">{sos.ride_destination}</p>
                  </div>
                  <div className="bg-[#0D0D0D] rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-2">PARTICIPANTS</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Driver:</span>
                        <span className="text-white text-sm">{sos.driver_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Rider:</span>
                        <span className="text-white text-sm">{sos.rider_name}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {sos.latitude && sos.longitude && (
                  <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4">
                    <p className="text-gray-500 text-xs mb-2">LOCATION</p>
                    <p className="text-white text-sm">
                      Lat: {sos.latitude.toFixed(6)}, Long: {sos.longitude.toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${sos.latitude},${sos.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#06C167] text-sm hover:underline inline-flex items-center gap-1 mt-2"
                    >
                      <MapPin className="w-4 h-4" /> View on Google Maps
                    </a>
                  </div>
                )}

                {sos.admin_notes && (
                  <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4">
                    <p className="text-gray-500 text-xs mb-2">ADMIN NOTES</p>
                    <p className="text-white text-sm">{sos.admin_notes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {sos.status === 'active' && (
                    <button
                      onClick={() => setSelectedSOS({ ...sos, actionType: 'review' })}
                      disabled={actionLoading === sos.id}
                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium py-2 rounded-lg flex items-center justify-center gap-2 border border-yellow-500/50 transition"
                      data-testid={`review-sos-${sos.id}`}
                    >
                      <Eye className="w-4 h-4" />
                      Mark as Reviewed
                    </button>
                  )}
                  {(sos.status === 'active' || sos.status === 'reviewed') && (
                    <button
                      onClick={() => setSelectedSOS({ ...sos, actionType: 'resolve' })}
                      disabled={actionLoading === sos.id}
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium py-2 rounded-lg flex items-center justify-center gap-2 border border-green-500/50 transition"
                      data-testid={`resolve-sos-${sos.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Resolve
                    </button>
                  )}
                  {sos.status === 'resolved' && (
                    <div className="flex-1 text-center text-green-400 py-2">
                      ✓ Resolved {sos.resolved_at && `at ${new Date(sos.resolved_at).toLocaleString()}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {selectedSOS && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSOS(null)}>
          <div 
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full border border-[#333] animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">
              {selectedSOS.actionType === 'review' ? 'Mark SOS as Reviewed' : 'Resolve SOS'}
            </h3>
            <p className="text-gray-400 mb-4">
              {selectedSOS.actionType === 'review' 
                ? 'Confirm that you have reviewed this SOS alert.'
                : 'Mark this SOS as resolved after taking appropriate action.'}
            </p>
            <textarea
              className="input-uber mb-4 h-24"
              placeholder="Add notes (optional)..."
              id="admin-notes"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedSOS(null)}
                className="flex-1 btn-uber-dark py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const notes = document.getElementById('admin-notes').value;
                  handleAction(selectedSOS.id, selectedSOS.actionType, notes);
                }}
                disabled={actionLoading === selectedSOS.id}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  selectedSOS.actionType === 'review'
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                    : 'bg-green-500 hover:bg-green-600 text-black'
                } transition disabled:opacity-50`}
              >
                {actionLoading === selectedSOS.id ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Verification Required Banner
const VerificationBanner = ({ setCurrentPage }) => {
  const { user } = useAuth();
  
  if (user?.verification_status === 'verified' || user?.is_admin) return null;

  const messages = {
    unverified: "Verify your student ID to post or join rides",
    pending: "Your verification is pending review",
    rejected: "Your verification was rejected. Please resubmit."
  };

  const colors = {
    unverified: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    pending: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    rejected: "bg-red-500/10 border-red-500/30 text-red-400"
  };

  return (
    <div className={`${colors[user?.verification_status]} border rounded-xl p-4 mb-6 flex items-center justify-between`} data-testid="verification-banner">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">{messages[user?.verification_status]}</span>
      </div>
      {(user?.verification_status === 'unverified' || user?.verification_status === 'rejected') && (
        <button
          onClick={() => setCurrentPage('profile')}
          className="text-sm font-medium hover:underline flex items-center gap-1"
        >
          Verify Now <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Ride Card Component
const RideCard = ({ ride, onRequest, onViewDetails, showRequestButton = true, userRequests = [] }) => {
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const hasRequested = userRequests.some((r) => r.ride_id === ride.id);
  const requestStatus = userRequests.find((r) => r.ride_id === ride.id)?.status;
  const isVerified = user?.verification_status === 'verified';

  return (
    <>
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
          <button 
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 hover:bg-[#333] rounded-lg px-2 py-1 -ml-2 transition"
            data-testid={`view-driver-${ride.id}`}
          >
            <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center">
              <User className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-gray-300 text-sm">{ride.driver_name}</span>
            <VerifiedBadge status={ride.driver_verification_status} size="xs" />
          </button>

          {showRequestButton && (
            hasRequested ? (
              <span className={`status-badge status-${requestStatus}`}>
                {requestStatus === 'requested' ? 'Pending' : requestStatus}
              </span>
            ) : isVerified ? (
              <button
                onClick={() => onRequest(ride.id)}
                className="btn-uber-green py-2 px-4 text-sm flex items-center gap-2"
                data-testid={`request-ride-${ride.id}`}
              >
                Request <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-gray-500 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Verify to request
              </span>
            )
          )}
        </div>
      </div>

      {showProfile && (
        <ProfileModal userId={ride.driver_id} onClose={() => setShowProfile(false)} />
      )}
    </>
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

  const isVerified = user?.verification_status === 'verified';

  return (
    <div className="min-h-screen bg-black" data-testid="driver-dashboard">
      <Navigation currentPage="dashboard" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-white">
              Welcome back, {user?.name}
            </h1>
            <VerifiedBadge status={user?.verification_status} size="md" />
          </div>
          <p className="text-gray-400">Manage your rides and requests</p>
        </div>

        <VerificationBanner setCurrentPage={setCurrentPage} />

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
          {isVerified ? (
            <button
              onClick={() => setCurrentPage('post-ride')}
              className="btn-uber flex items-center gap-2"
              data-testid="post-ride-btn"
            >
              <Plus className="w-5 h-5" /> Post New Ride
            </button>
          ) : (
            <button
              onClick={() => setCurrentPage('profile')}
              className="btn-uber-dark flex items-center gap-2 opacity-80"
              data-testid="verify-to-post-btn"
            >
              <AlertCircle className="w-5 h-5" /> Verify to Post Rides
            </button>
          )}
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
              {isVerified ? (
                <button
                  onClick={() => setCurrentPage('post-ride')}
                  className="btn-uber-green"
                >
                  Post Your First Ride
                </button>
              ) : (
                <button
                  onClick={() => setCurrentPage('profile')}
                  className="btn-uber-dark"
                >
                  Verify to Start Posting
                </button>
              )}
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
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-white">
              Hey, {user?.name}! 👋
            </h1>
            <VerifiedBadge status={user?.verification_status} size="md" />
          </div>
          <p className="text-gray-400">Find your next ride</p>
        </div>

        <VerificationBanner setCurrentPage={setCurrentPage} />

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
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    source_lat: null,
    source_lng: null,
    destination_lat: null,
    destination_lng: null,
    date: '',
    time: '',
    available_seats: 3,
    estimated_cost: '',
  });
  const [loading, setLoading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);

  // Redirect if not verified
  if (user?.verification_status !== 'verified') {
    return (
      <div className="min-h-screen bg-black" data-testid="post-ride-page">
        <Navigation currentPage="post-ride" setCurrentPage={setCurrentPage} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Verification Required</h2>
          <p className="text-gray-400 mb-6">You need to verify your student ID before posting rides.</p>
          <button
            onClick={() => setCurrentPage('profile')}
            className="btn-uber"
          >
            Complete Verification
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate coordinates are selected
    if (!formData.source_lat || !formData.destination_lat) {
      toast.error('Please select locations from the map for accurate route display');
      return;
    }
    
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
  
  const handleSourceSelect = (location) => {
    setFormData({
      ...formData,
      source: location.address,
      source_lat: location.lat,
      source_lng: location.lng
    });
  };
  
  const handleDestSelect = (location) => {
    setFormData({
      ...formData,
      destination: location.address,
      destination_lat: location.lat,
      destination_lng: location.lng
    });
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="input-uber flex-1"
                    placeholder="Select from map..."
                    readOnly
                    required
                    data-testid="ride-source"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSourcePicker(true)}
                    className="btn-uber-green px-4 flex items-center gap-2"
                    data-testid="select-source-btn"
                  >
                    <MapPinned className="w-4 h-4" />
                    Select
                  </button>
                </div>
                {formData.source_lat && (
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Location selected
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Drop Location</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="input-uber flex-1"
                    placeholder="Select from map..."
                    readOnly
                    required
                    data-testid="ride-destination"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDestPicker(true)}
                    className="btn-uber-green px-4 flex items-center gap-2"
                    data-testid="select-dest-btn"
                  >
                    <MapPinned className="w-4 h-4" />
                    Select
                  </button>
                </div>
                {formData.destination_lat && (
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Location selected
                  </p>
                )}
              </div>
            </div>
            
            {/* Route Preview */}
            {formData.source_lat && formData.destination_lat && (
              <div className="mt-4">
                <p className="text-gray-400 text-sm mb-2">Route Preview:</p>
                <RouteMap 
                  sourceLat={formData.source_lat}
                  sourceLng={formData.source_lng}
                  destLat={formData.destination_lat}
                  destLng={formData.destination_lng}
                  sourceLabel={formData.source}
                  destLabel={formData.destination}
                />
              </div>
            )}
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
            disabled={loading || !formData.source_lat || !formData.destination_lat}
            className="w-full btn-uber text-lg py-4 disabled:opacity-50"
            data-testid="submit-ride"
          >
            {loading ? 'Posting...' : 'Post Ride'}
          </button>
        </form>
      </div>
      
      {/* Map Picker Modals */}
      <MapLocationPicker
        isOpen={showSourcePicker}
        onClose={() => setShowSourcePicker(false)}
        onSelect={handleSourceSelect}
        title="Select Pickup Location"
        initialPosition={formData.source_lat ? { lat: formData.source_lat, lng: formData.source_lng } : null}
      />
      
      <MapLocationPicker
        isOpen={showDestPicker}
        onClose={() => setShowDestPicker(false)}
        onSelect={handleDestSelect}
        title="Select Drop Location"
        initialPosition={formData.destination_lat ? { lat: formData.destination_lat, lng: formData.destination_lng } : null}
      />
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

        <VerificationBanner setCurrentPage={setCurrentPage} />

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

// My Requests Page (Rider) - Updated for Phase 3
const MyRequestsPage = ({ setCurrentPage }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(null);

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

  // Group requests by status for better organization
  const activeRequests = requests.filter(r => ['accepted', 'ongoing'].includes(r.status));
  const pendingRequests = requests.filter(r => r.status === 'requested');
  const pastRequests = requests.filter(r => ['completed', 'rejected'].includes(r.status));

  return (
    <div className="min-h-screen bg-black" data-testid="my-requests-page">
      <Navigation currentPage="my-requests" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">My Ride Requests</h1>
          <p className="text-gray-400">Track your ride requests and communicate with drivers</p>
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
          <div className="space-y-8">
            {/* Active Rides (Accepted/Ongoing) */}
            {activeRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-[#06C167]" />
                  Active Rides
                </h2>
                <div className="space-y-4">
                  {activeRequests.map((request) => (
                    <div key={request.id} className="ride-card animate-fade-in border-[#06C167]/50" data-testid={`request-${request.id}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-semibold">{request.ride_source}</h3>
                          <p className="text-gray-400 text-sm">to {request.ride_destination}</p>
                        </div>
                        <span className={`status-badge status-${request.status}`}>
                          {request.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> {request.ride_date}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" /> {request.ride_time}
                        </div>
                      </div>

                      {/* PIN Display for Accepted Rides */}
                      {request.status === 'accepted' && request.ride_pin && (
                        <div className="mb-4 p-4 bg-[#0D0D0D] rounded-lg border border-[#333]">
                          <div className="flex items-center gap-2 mb-2">
                            <Key className="w-4 h-4 text-[#06C167]" />
                            <p className="text-gray-400 text-sm">Your Ride PIN (share with driver)</p>
                          </div>
                          <div className="pin-display" data-testid={`ride-pin-${request.id}`}>
                            {request.ride_pin}
                          </div>
                          <p className="text-gray-500 text-xs mt-2 text-center">
                            Give this PIN to your driver to start the ride
                          </p>
                        </div>
                      )}

                      {/* Ride Started Info - Show View Live Ride Button */}
                      {request.status === 'ongoing' && (
                        <div className="mb-4">
                          {request.ride_started_at && (
                            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-4">
                              <p className="text-purple-400 text-sm flex items-center gap-2">
                                <Play className="w-4 h-4" />
                                Ride started at {new Date(request.ride_started_at).toLocaleTimeString()}
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => setCurrentPage(`live-ride:${request.id}`)}
                            className="w-full bg-[#06C167] hover:bg-[#05a857] text-black font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
                            data-testid={`view-live-ride-${request.id}`}
                          >
                            <NavigationIcon className="w-5 h-5" />
                            View Live Ride
                          </button>
                        </div>
                      )}

                      {/* Chat Button */}
                      <button
                        onClick={() => setShowChat(request)}
                        className="w-full btn-uber-dark py-3 flex items-center justify-center gap-2"
                        data-testid={`chat-btn-${request.id}`}
                      >
                        <MessageCircle className="w-5 h-5" />
                        Chat with Driver
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Pending Requests
                </h2>
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="ride-card animate-fade-in" data-testid={`request-${request.id}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-semibold">{request.ride_source}</h3>
                          <p className="text-gray-400 text-sm">to {request.ride_destination}</p>
                        </div>
                        <span className="status-badge status-requested">
                          Pending
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
                      <p className="text-gray-500 text-sm mt-3">Waiting for driver approval...</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Rides */}
            {pastRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-gray-500" />
                  Past Rides
                </h2>
                <div className="space-y-4">
                  {pastRequests.map((request) => (
                    <div key={request.id} className="ride-card animate-fade-in opacity-75" data-testid={`request-${request.id}`}>
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
              </div>
            )}
          </div>
        )}

        {/* Chat Modal */}
        {showChat && (
          <ChatModal
            requestId={showChat.id}
            otherUserName="Driver"
            onClose={() => setShowChat(null)}
          />
        )}
      </div>
    </div>
  );
};

// Driver Requests Page - Updated for Phase 3
const DriverRequestsPage = ({ setCurrentPage }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(null);
  const [showChat, setShowChat] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [pinInput, setPinInput] = useState({});
  const [startingRide, setStartingRide] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const [pendingData, acceptedData] = await Promise.all([
        api('/api/ride-requests/driver/pending'),
        api('/api/ride-requests/driver/accepted'),
      ]);
      setPendingRequests(pendingData.requests);
      setAcceptedRequests(acceptedData.requests);
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

  const handleStartRide = async (requestId) => {
    const pin = pinInput[requestId];
    if (!pin || pin.length !== 4) {
      toast.error('Please enter a valid 4-digit PIN');
      return;
    }

    setStartingRide(requestId);
    try {
      await api(`/api/ride-requests/${requestId}/start`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      toast.success('Ride started successfully!');
      setPinInput({ ...pinInput, [requestId]: '' });
      loadRequests();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setStartingRide(null);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="driver-requests-page">
      <Navigation currentPage="requests" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Ride Requests</h1>
          <p className="text-gray-400">Manage incoming requests and active rides</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 rounded-xl font-medium transition flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-white text-black'
                : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
            }`}
            data-testid="tab-pending"
          >
            <Clock className="w-4 h-4" />
            Pending
            {pendingRequests.length > 0 && (
              <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`px-6 py-3 rounded-xl font-medium transition flex items-center gap-2 ${
              activeTab === 'accepted'
                ? 'bg-white text-black'
                : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
            }`}
            data-testid="tab-accepted"
          >
            <CheckCircle className="w-4 h-4" />
            Active Rides
            {acceptedRequests.length > 0 && (
              <span className="bg-[#06C167] text-black text-xs px-2 py-0.5 rounded-full">
                {acceptedRequests.length}
              </span>
            )}
          </button>
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
        ) : (
          <>
            {/* Pending Requests Tab */}
            {activeTab === 'pending' && (
              pendingRequests.length === 0 ? (
                <div className="text-center py-16">
                  <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No pending requests</h3>
                  <p className="text-gray-400">Check back later for new ride requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="ride-card animate-fade-in" data-testid={`pending-request-${request.id}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <button 
                            onClick={() => setShowProfile(request.rider_id)}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <h3 className="text-white font-semibold">{request.rider_name}</h3>
                            <VerifiedBadge status={request.rider_verification_status} size="xs" />
                          </button>
                          <p className="text-gray-400 text-sm">{request.rider_email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <VerificationStatusBadge status={request.rider_verification_status} />
                          <span className="status-badge status-requested">Pending</span>
                        </div>
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
              )
            )}

            {/* Accepted/Active Rides Tab */}
            {activeTab === 'accepted' && (
              acceptedRequests.length === 0 ? (
                <div className="text-center py-16">
                  <Car className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No active rides</h3>
                  <p className="text-gray-400">Accept ride requests to see them here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {acceptedRequests.map((request) => (
                    <div 
                      key={request.id} 
                      className={`ride-card animate-fade-in ${request.status === 'ongoing' ? 'border-purple-500/50' : 'border-[#06C167]/50'}`}
                      data-testid={`accepted-request-${request.id}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <button 
                            onClick={() => setShowProfile(request.rider_id)}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <h3 className="text-white font-semibold">{request.rider_name}</h3>
                            <VerifiedBadge status={request.rider_verification_status} size="xs" />
                          </button>
                          <p className="text-gray-400 text-sm">{request.rider_email}</p>
                        </div>
                        <span className={`status-badge status-${request.status}`}>
                          {request.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                        <span>{request.ride_source} → {request.ride_destination}</span>
                        <span>{request.ride_date} at {request.ride_time}</span>
                      </div>

                      {/* PIN Verification Section - Only for Accepted (not started) rides */}
                      {request.status === 'accepted' && (
                        <div className="mb-4 p-4 bg-[#0D0D0D] rounded-lg border border-[#333]">
                          <div className="flex items-center gap-2 mb-3">
                            <Key className="w-4 h-4 text-[#06C167]" />
                            <p className="text-white font-medium">Verify Rider PIN to Start</p>
                          </div>
                          <p className="text-gray-500 text-sm mb-3">
                            Ask the rider for their 4-digit PIN to confirm their identity
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={pinInput[request.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setPinInput({ ...pinInput, [request.id]: val });
                              }}
                              className="input-uber pin-input flex-1"
                              placeholder="Enter PIN"
                              maxLength={4}
                              data-testid={`pin-input-${request.id}`}
                            />
                            <button
                              onClick={() => handleStartRide(request.id)}
                              disabled={startingRide === request.id || (pinInput[request.id]?.length !== 4)}
                              className="btn-uber-green px-6 flex items-center gap-2 disabled:opacity-50"
                              data-testid={`start-ride-btn-${request.id}`}
                            >
                              {startingRide === request.id ? (
                                'Starting...'
                              ) : (
                                <>
                                  <Play className="w-4 h-4" /> Start Ride
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Ride Started Info with View Live Ride button for drivers */}
                      {request.status === 'ongoing' && (
                        <div className="mb-4">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-3">
                            <p className="text-purple-400 text-sm flex items-center gap-2">
                              <Play className="w-4 h-4" />
                              Ride in progress
                              {request.ride_started_at && (
                                <span className="text-purple-300">
                                  • Started at {new Date(request.ride_started_at).toLocaleTimeString()}
                                </span>
                              )}
                            </p>
                          </div>
                          {/* View Live Ride Button for Driver */}
                          <button
                            onClick={() => setCurrentPage(`live-ride:${request.id}`)}
                            className="w-full bg-[#06C167] hover:bg-[#05a857] text-black font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
                            data-testid={`driver-view-live-ride-${request.id}`}
                          >
                            <NavigationIcon className="w-5 h-5" />
                            View Live Ride
                          </button>
                        </div>
                      )}

                      {/* Chat Button */}
                      <button
                        onClick={() => setShowChat(request)}
                        className="w-full btn-uber-dark py-3 flex items-center justify-center gap-2"
                        data-testid={`chat-btn-${request.id}`}
                      >
                        <MessageCircle className="w-5 h-5" />
                        Chat with Rider
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {showProfile && (
          <ProfileModal userId={showProfile} onClose={() => setShowProfile(null)} />
        )}

        {showChat && (
          <ChatModal
            requestId={showChat.id}
            otherUserName={showChat.rider_name}
            onClose={() => setShowChat(null)}
          />
        )}
      </div>
    </div>
  );
};

// Verification Section Component (for Profile Page)
const VerificationSection = () => {
  const { user, refreshUser } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const loadVerificationStatus = async () => {
    try {
      const data = await api('/api/verification/status');
      setVerificationStatus(data);
    } catch (error) {
      console.error('Failed to load verification status');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await api('/api/verification/upload', {
          method: 'POST',
          body: JSON.stringify({ student_id_image: base64Image }),
        });
        toast.success('Student ID uploaded successfully!');
        setSelectedImage(null);
        setPreviewUrl(null);
        loadVerificationStatus();
        refreshUser();
      };
      reader.readAsDataURL(selectedImage);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const canUpload = user?.verification_status === 'unverified' || user?.verification_status === 'rejected';

  return (
    <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] mb-6" data-testid="verification-section">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-[#06C167]" />
        Identity Verification
      </h3>

      {/* Current Status */}
      <div className="flex items-center justify-between mb-4 p-4 bg-[#0D0D0D] rounded-lg">
        <div>
          <p className="text-gray-400 text-sm mb-1">Verification Status</p>
          <VerificationStatusBadge status={user?.verification_status} />
        </div>
        {user?.verification_status === 'verified' && (
          <div className="flex items-center gap-2 text-green-400">
            <BadgeCheck className="w-6 h-6" />
            <span className="text-sm">Verified</span>
          </div>
        )}
      </div>

      {/* Rejection Reason */}
      {user?.verification_status === 'rejected' && verificationStatus?.rejection_reason && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-medium mb-1">Rejection Reason:</p>
          <p className="text-gray-300 text-sm">{verificationStatus.rejection_reason}</p>
        </div>
      )}

      {/* Upload Section */}
      {canUpload && (
        <div className="border-2 border-dashed border-[#333] rounded-lg p-6">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            ref={fileInputRef}
            data-testid="id-upload-input"
          />
          
          {previewUrl ? (
            <div className="text-center">
              <img 
                src={previewUrl} 
                alt="ID Preview" 
                className="max-h-48 mx-auto rounded-lg mb-4"
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="btn-uber-green py-2 px-6"
                  data-testid="upload-id-btn"
                >
                  {uploading ? 'Uploading...' : 'Submit for Verification'}
                </button>
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setPreviewUrl(null);
                  }}
                  className="btn-uber-dark py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div 
              className="text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">Upload Student ID</p>
              <p className="text-gray-500 text-sm mb-4">Click to select your college ID card (front side)</p>
              <button className="btn-uber-dark py-2 px-4" data-testid="select-id-btn">
                Select Image
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Status */}
      {user?.verification_status === 'pending' && (
        <div className="text-center py-6">
          <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-3 animate-pulse" />
          <p className="text-white font-medium mb-1">Verification Pending</p>
          <p className="text-gray-400 text-sm">Your student ID is being reviewed by admin</p>
        </div>
      )}

      {/* Verified Status */}
      {user?.verification_status === 'verified' && (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-3">
            <Check className="w-8 h-8 text-black" />
          </div>
          <p className="text-white font-medium mb-1">You're Verified!</p>
          <p className="text-gray-400 text-sm">You have full access to all CampusPool features</p>
        </div>
      )}

      {/* Instructions */}
      {canUpload && (
        <div className="mt-4 p-4 bg-[#0D0D0D] rounded-lg">
          <p className="text-gray-400 text-sm">
            <strong className="text-white">Instructions:</strong> Upload a clear photo of your college-issued student ID card (front side). 
            This helps us ensure that only genuine students use CampusPool.
          </p>
        </div>
      )}
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
    vehicle_model: user?.vehicle_model || '',
    vehicle_number: user?.vehicle_number || '',
    vehicle_color: user?.vehicle_color || '',
  });
  const [loading, setLoading] = useState(false);

  // Update formData when user data changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        role: user.role || 'rider',
        vehicle_model: user.vehicle_model || '',
        vehicle_number: user.vehicle_number || '',
        vehicle_color: user.vehicle_color || '',
      });
    }
  }, [user]);

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
            <div className="w-20 h-20 rounded-full bg-[#333] flex items-center justify-center relative">
              <User className="w-10 h-10 text-gray-400" />
              {user?.verification_status === 'verified' && (
                <div className="absolute -bottom-1 -right-1">
                  <VerifiedBadge status="verified" size="md" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">{user?.name}</h2>
              </div>
              <p className="text-gray-400">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`status-badge ${user?.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                  {user?.role}
                </span>
                <VerificationStatusBadge status={user?.verification_status} />
              </div>
            </div>
          </div>

          {/* Ride Count */}
          {user?.ride_count !== undefined && (
            <div className="bg-[#0D0D0D] rounded-lg p-4 mb-6">
              <p className="text-gray-400 text-sm">Completed Rides</p>
              <p className="text-2xl font-bold text-white">{user.ride_count}</p>
            </div>
          )}

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
                
                {/* Vehicle Details Section - Only for drivers */}
                {(formData.role === 'driver' || user?.role === 'driver') && (
                  <div className="pt-4 border-t border-[#333]">
                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                      <Car className="w-4 h-4 text-[#06C167]" />
                      Vehicle Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Vehicle Model</label>
                        <input
                          type="text"
                          value={formData.vehicle_model}
                          onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                          className="input-uber"
                          placeholder="e.g., Honda City, Maruti Swift"
                          data-testid="vehicle-model"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Vehicle Number</label>
                        <input
                          type="text"
                          value={formData.vehicle_number}
                          onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                          className="input-uber"
                          placeholder="e.g., KA-01-AB-1234"
                          data-testid="vehicle-number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Vehicle Color</label>
                        <input
                          type="text"
                          value={formData.vehicle_color}
                          onChange={(e) => setFormData({ ...formData, vehicle_color: e.target.value })}
                          className="input-uber"
                          placeholder="e.g., White, Silver, Black"
                          data-testid="vehicle-color"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
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
              <>
                {/* Vehicle Details Display - Only for drivers */}
                {user?.role === 'driver' && (
                  <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4">
                    <p className="text-gray-500 text-xs mb-2 flex items-center gap-1">
                      <Car className="w-3 h-3" /> VEHICLE DETAILS
                    </p>
                    {(user?.vehicle_model || user?.vehicle_number || user?.vehicle_color) ? (
                      <div className="space-y-1">
                        {user?.vehicle_model && (
                          <p className="text-white text-sm font-medium">{user.vehicle_model}</p>
                        )}
                        {user?.vehicle_number && (
                          <p className="text-[#06C167] text-sm font-mono">{user.vehicle_number}</p>
                        )}
                        {user?.vehicle_color && (
                          <p className="text-gray-400 text-xs">{user.vehicle_color}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No vehicle details added. Click Edit Profile to add.</p>
                    )}
                  </div>
                )}
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

        {/* Verification Section (only for non-admin users) */}
        {!user?.is_admin && <VerificationSection />}

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

// Admin Verifications Page
const AdminVerificationsPage = ({ setCurrentPage }) => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    loadVerifications();
  }, [filter]);

  const loadVerifications = async () => {
    setLoading(true);
    try {
      const endpoint = filter === 'pending' ? '/api/admin/verifications' : '/api/admin/verifications/all';
      const data = await api(endpoint);
      let items = data.verifications;
      
      if (filter !== 'pending' && filter !== 'all') {
        items = items.filter(v => v.verification_status === filter);
      }
      
      setVerifications(items);
    } catch (error) {
      toast.error('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    setActionLoading(true);
    try {
      await api(`/api/admin/verifications/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      });
      toast.success('User verified successfully');
      loadVerifications();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    
    setActionLoading(true);
    try {
      await api(`/api/admin/verifications/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      });
      toast.success('Verification rejected');
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedUser(null);
      loadVerifications();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-verifications-page">
      <Navigation currentPage="verifications" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">ID Verifications</h1>
          <p className="text-gray-400">Review and manage student verification requests</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'pending', label: 'Pending' },
            { id: 'verified', label: 'Verified' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'all', label: 'All' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === tab.id
                  ? 'bg-white text-black'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
              }`}
              data-testid={`filter-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
                <div className="flex gap-4">
                  <div className="skeleton w-32 h-32 rounded-lg" />
                  <div className="flex-1">
                    <div className="skeleton h-6 w-32 mb-2 rounded" />
                    <div className="skeleton h-4 w-48 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : verifications.length === 0 ? (
          <div className="text-center py-16">
            <FileCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No {filter} verifications</h3>
            <p className="text-gray-400">
              {filter === 'pending' ? 'All verification requests have been processed' : 'No records found'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {verifications.map((verification) => (
              <div 
                key={verification.id} 
                className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] animate-fade-in"
                data-testid={`verification-item-${verification.id}`}
              >
                <div className="flex flex-col md:flex-row gap-6">
                  {/* ID Image */}
                  {verification.student_id_image && (
                    <div className="md:w-64 flex-shrink-0">
                      <p className="text-gray-400 text-sm mb-2">Student ID</p>
                      <img 
                        src={verification.student_id_image} 
                        alt="Student ID"
                        className="w-full rounded-lg border border-[#333] cursor-pointer hover:opacity-80 transition"
                        onClick={() => window.open(verification.student_id_image, '_blank')}
                        data-testid={`id-image-${verification.id}`}
                      />
                    </div>
                  )}
                  
                  {/* User Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-white">{verification.name}</h3>
                        <p className="text-gray-400">{verification.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`status-badge ${verification.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                          {verification.role}
                        </span>
                        <VerificationStatusBadge status={verification.verification_status || 'pending'} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500">Submitted</p>
                        <p className="text-gray-300">
                          {verification.submitted_at 
                            ? new Date(verification.submitted_at).toLocaleString() 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Member Since</p>
                        <p className="text-gray-300">
                          {verification.created_at 
                            ? new Date(verification.created_at).toLocaleDateString() 
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {verification.rejection_reason && (
                      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-400 text-sm">
                          <strong>Rejection Reason:</strong> {verification.rejection_reason}
                        </p>
                      </div>
                    )}

                    {/* Actions (only for pending) */}
                    {(verification.verification_status === 'pending' || !verification.verification_status) && verification.student_id_image && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(verification.id)}
                          disabled={actionLoading}
                          className="flex-1 btn-uber-green py-2 flex items-center justify-center gap-2"
                          data-testid={`approve-${verification.id}`}
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(verification);
                            setShowRejectModal(true);
                          }}
                          disabled={actionLoading}
                          className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center gap-2 hover:bg-red-500/30 transition"
                          data-testid={`reject-${verification.id}`}
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
          <div 
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full mx-4 border border-[#333]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-white mb-4">Reject Verification</h3>
            <p className="text-gray-400 mb-4">
              Please provide a reason for rejecting {selectedUser?.name}'s verification:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-uber h-24 resize-none mb-4"
              placeholder="e.g., ID photo is unclear, incorrect document..."
              data-testid="reject-reason-input"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                data-testid="confirm-reject-btn"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="btn-uber-dark"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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

        {/* Quick Action - Pending Verifications */}
        {stats?.pending_verifications > 0 && (
          <div 
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-center justify-between cursor-pointer hover:bg-yellow-500/20 transition"
            onClick={() => setCurrentPage('verifications')}
            data-testid="pending-verifications-banner"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400">
                {stats.pending_verifications} pending verification{stats.pending_verifications > 1 ? 's' : ''} to review
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-yellow-400" />
          </div>
        )}

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
                  { label: 'Verified Users', value: stats.verified_users, color: 'bg-green-500' },
                  { label: 'Pending Verifications', value: stats.pending_verifications, color: 'bg-yellow-500' },
                  { label: 'Unverified', value: stats.unverified_users, color: 'bg-gray-500' },
                  { label: 'Riders', value: stats.total_riders, color: 'bg-blue-500' },
                  { label: 'Drivers', value: stats.total_drivers, color: 'bg-[#06C167]' },
                  { label: 'Active Rides', value: stats.active_rides, color: 'bg-purple-500' },
                  { label: 'Completed Rides', value: stats.completed_rides, color: 'bg-orange-500' },
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
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Verification</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Rides</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-t border-[#333]" data-testid={`admin-user-${user.id}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white">{user.name}</span>
                              <VerifiedBadge status={user.verification_status} size="xs" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-400">{user.email}</td>
                          <td className="px-6 py-4">
                            <span className={`status-badge ${user.is_admin ? 'bg-purple-500/20 text-purple-400' : user.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                              {user.is_admin ? 'admin' : user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <VerificationStatusBadge status={user.verification_status} />
                          </td>
                          <td className="px-6 py-4 text-gray-400">{user.ride_count || 0}</td>
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
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{ride.driver_name}</span>
                              <VerifiedBadge status={ride.driver_verification_status} size="xs" />
                            </div>
                          </td>
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
      case 'verifications':
        return <AdminVerificationsPage setCurrentPage={setCurrentPage} />;
      case 'sos':
        return <AdminSOSPage setCurrentPage={setCurrentPage} />;
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
      case 'live-ride':
        return <LiveRideScreen requestId={currentPage.split(':')[1] || localStorage.getItem('liveRideId')} onBack={() => setCurrentPage('requests')} />;
      case 'profile':
        return <ProfilePage setCurrentPage={setCurrentPage} />;
      default:
        if (currentPage.startsWith('live-ride:')) {
          return <LiveRideScreen requestId={currentPage.split(':')[1]} onBack={() => setCurrentPage('requests')} />;
        }
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
      if (currentPage.startsWith('live-ride:')) {
        return <LiveRideScreen requestId={currentPage.split(':')[1]} onBack={() => setCurrentPage('my-requests')} />;
      }
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
