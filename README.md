# CampusPool - Ride Sharing MVP

A complete mobile and backend solution for college students to share rides.

## Project Structure

```
campuspool-mobile/        # Flutter mobile app
├── lib/
│   ├── main.dart
│   ├── src/
│   │   ├── models/       # Data models (User, Ride, RideRequest)
│   │   ├── providers/    # State management (AuthProvider)
│   │   ├── services/     # API integration
│   │   └── screens/      # UI screens
│   └── pubspec.yaml      # Flutter dependencies
│
campuspool-backend/       # Node.js/Express backend
├── src/
│   ├── database/         # Database setup & schema
│   ├── middleware/       # Authentication middleware
│   ├── routes/           # API endpoints
│   ├── utils/            # JWT & validators
│   └── index.js          # Server entry point
├── package.json
└── .env.example
```

## Features

### Authentication
- Email/password signup and login
- College email domain validation
- JWT-based authentication
- Persistent sessions

### User Profiles
- User name and role (Rider/Driver)
- Profile view screen

### Ride Posting (Drivers)
- Source and destination (text input)
- Date and time selection
- Available seats
- Estimated cost

### Ride Discovery (Riders)
- List all active rides
- Filter by destination
- Filter by time
- View ride details

### Ride Requests
- Send ride requests
- Accept/reject requests
- Automatic seat availability updates

### Cost Splitting
- Driver enters estimated cost
- Automatic cost-per-rider calculation
- Cost displayed before confirmation

## Setup

### Backend Setup

1. Install Node.js dependencies:
```bash
cd campuspool-backend
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Set up PostgreSQL database:
- Create a database named `campuspool`
- Update `.env` with database credentials

4. Run migrations:
```bash
npm run db:migrate
```

5. Start the backend:
```bash
npm run dev
```

### Flutter Setup

1. Ensure Flutter SDK is installed:
```bash
flutter --version
```

2. Get dependencies:
```bash
cd campuspool-mobile
flutter pub get
```

3. Update API endpoint in `lib/src/services/api_service.dart` if needed

4. Run the app:
```bash
flutter run
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login

### Rides
- `GET /api/rides` - List rides (with filtering)
- `GET /api/rides/:id` - Get ride details
- `POST /api/rides` - Post new ride (driver only)
- `PATCH /api/rides/:id/status` - Update ride status

### Ride Requests
- `GET /api/requests/ride/:rideId` - Get requests for a ride (driver only)
- `POST /api/requests` - Request a ride (rider only)
- `PATCH /api/requests/:id/accept` - Accept request (driver only)
- `PATCH /api/requests/:id/reject` - Reject request (driver only)

### Admin
- `GET /api/admin/users` - View all users
- `GET /api/admin/rides` - View all rides
- `GET /api/admin/stats` - Get system stats

## Tech Stack

### Frontend
- **Flutter** - Cross-platform mobile framework
- **Provider** - State management
- **Dio** - HTTP client
- **Google Fonts** - Typography
- **SharedPreferences** - Local storage

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## Demo Flow

1. **Signup**: User creates account with college email
2. **Choose Role**: Select Rider or Driver
3. **Driver Posts Ride**: Enters route, time, seats, and cost
4. **Rider Browses**: Views available rides
5. **Rider Requests**: Sends request for a ride
6. **Driver Accepts**: Accepts request, seat count decreases
7. **Ride Complete**: Status updated to completed
8. **Cost Display**: Rider sees final cost per seat

## Next Steps (Phase 2+)

- Live location tracking
- In-app chat
- User ratings and reviews
- Payments integration
- Emergency/SOS features
- AI-based ride matching
