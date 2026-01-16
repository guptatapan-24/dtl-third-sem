# CampusPool - React Native Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- React Native CLI
- Android Studio (for Android) or Xcode (for iOS)
- Supabase account

## Installation Steps

### 1. Backend Setup

```bash
cd campuspool-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your credentials:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - JWT_SECRET

# Start the server
npm run dev
```

### 2. Supabase Database Setup

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and run the SQL from `campuspool-backend/src/database/schema.sql`
4. This creates tables: users, rides, ride_requests with RLS policies

### 3. React Native App Setup

```bash
cd campuspool-rn

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with:
# REACT_APP_SUPABASE_URL=https://your-project.supabase.co
# REACT_APP_SUPABASE_ANON_KEY=your_anon_key

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios
```

## Troubleshooting

### Common Issues

1. **Metro bundler cache issues**
   ```bash
   npm start -- --reset-cache
   ```

2. **Android build fails**
   ```bash
   cd android && ./gradlew clean && cd ..
   npm run android
   ```

3. **iOS build fails**
   ```bash
   cd ios && pod deintegrate && pod install && cd ..
   npm run ios
   ```

4. **Dependency conflicts**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## Package Versions

### Backend
- Express: 4.18.2
- Supabase JS: 2.39.0
- JWT: 9.0.2

### React Native App
- React Native: 0.72.10
- React Navigation: 6.x
- Supabase JS: 2.39.0
- TypeScript: 5.3.3

## Features

✅ Email/Password Authentication with Supabase Auth
✅ Role-based access (Rider/Driver)
✅ Browse and filter rides
✅ Post rides (drivers)
✅ Request rides (riders)
✅ Accept/Reject ride requests
✅ Cost splitting calculation
✅ User profile management

## Project Structure

```
campuspool-rn/
├── src/
│   ├── context/          # AuthContext
│   ├── navigation/       # Navigation setup
│   ├── screens/          # All screen components
│   │   ├── auth/         # Login, Signup
│   │   ├── rides/        # Browse, Post
│   │   └── profile/      # Profile screen
│   └── services/         # Supabase client
├── App.tsx               # Root component
└── package.json

campuspool-backend/
├── src/
│   ├── database/         # Supabase client, schema
│   ├── middleware/       # Auth middleware
│   ├── routes/           # API routes
│   └── utils/            # JWT, validators
└── package.json
```

## API Endpoints

- `POST /api/auth/signup` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/rides` - List rides (with filters)
- `POST /api/rides` - Create ride (driver)
- `POST /api/requests` - Request ride (rider)
- `PATCH /api/requests/:id/accept` - Accept request (driver)
- `PATCH /api/requests/:id/reject` - Reject request (driver)
- `GET /api/admin/users` - List users (admin)
- `GET /api/admin/rides` - List all rides (admin)
