# Trip Planner Backend

A Fastify backend application with Firebase authentication and Prisma database.

## Features

- 🔐 Firebase Authentication (Email/Password)
- 🛡️ Authentication middleware for protected routes
- 💾 Prisma ORM for database operations
- ⚡ Fastify web framework

## Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Firebase project with Admin SDK credentials

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/trip_planner?schema=public"
PORT=3000
HOST=0.0.0.0
```

3. Set up Firebase service account:
Place your Firebase service account JSON file as `firebase-service.json` in the root directory of the project.

4. Generate Prisma client:
```bash
npx prisma generate
```

5. Run database migrations:
```bash
npx prisma migrate dev
```

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### Authentication

- `GET /api/auth/me` - Get current user (protected)
  - Headers: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
  - Returns: Current user object
  - Note: User is automatically created/updated in database on first authenticated request

### Trips

- `GET /api/trips` - Get paginated list of trips for the authenticated user (protected)
  - Headers: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
  - Query Parameters:
    - `page` (optional): Page number (default: 1, minimum: 1)
    - `limit` (optional): Number of items per page (default: 20, minimum: 1, maximum: 100)
    - `status` (optional): Filter trips by status - `upcoming` (startDate > today), `ongoing` (startDate <= today AND endDate >= today), or `past` (endDate < today)
  - Returns: Paginated array of trips with basic information and members
  - Response format:
    ```json
    {
      "trips": [
        {
          "id": "uuid",
          "name": "Trip Name",
          "startDate": "2024-01-01T00:00:00.000Z",
          "endDate": "2024-01-07T00:00:00.000Z",
          "members": [
            {
              "id": "user-uuid",
              "email": "user@example.com"
            }
          ]
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "totalCount": 45,
        "totalPages": 3,
        "hasNextPage": true,
        "hasPreviousPage": false
      }
    }
    ```
  - Returns trips ordered by creation date (newest first)
  - Examples:
    - `GET /api/trips?page=1&limit=20` - Get all trips
    - `GET /api/trips?status=upcoming` - Get upcoming trips
    - `GET /api/trips?status=ongoing` - Get ongoing trips
    - `GET /api/trips?status=past` - Get past trips
    - `GET /api/trips?status=upcoming&page=1&limit=10` - Get paginated upcoming trips

- `GET /api/trips/:tripId` - Get trip details by ID (protected)
  - Headers: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
  - Path Parameters:
    - `tripId`: Trip UUID
  - Returns: Complete trip details including members, destinations, days, and itinerary items
  - Response format:
    ```json
    {
      "id": "uuid",
      "name": "Trip Name",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-07T00:00:00.000Z",
      "currency": "USD",
      "budget": "5000.00",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "members": [
        {
          "id": "user-uuid",
          "email": "user@example.com",
          "role": "OWNER",
          "joinedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "destinations": [
        {
          "id": "destination-uuid",
          "name": "Paris",
          "country": "France",
          "order": 1,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "days": [
        {
          "id": "day-uuid",
          "date": "2024-01-05T00:00:00.000Z",
          "dayNumber": 5,
          "destinationId": "destination-uuid",
          "destination": {
            "id": "destination-uuid",
            "name": "Paris",
            "country": "France"
          },
          "createdAt": "2024-01-05T00:00:00.000Z",
          "items": [
            {
              "id": "item-uuid",
              "type": "ACTIVITY",
              "title": "Visit Museum",
              "description": "Explore the local museum",
              "startTime": "2024-01-05T10:00:00.000Z",
              "endTime": "2024-01-05T12:00:00.000Z",
              "order": 1,
              "createdAt": "2024-01-05T00:00:00.000Z"
            }
          ]
        }
      ]
    }
    ```
  - Returns 404 if trip not found or user doesn't have access

- `POST /api/trips` - Create a new trip (protected)
  - Headers: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
  - Request Body:
    ```json
    {
      "name": "Summer Vacation",
      "startDate": "2024-07-01T00:00:00.000Z",
      "endDate": "2024-07-15T00:00:00.000Z",
      "members": ["user-uuid-1", "user-uuid-2"],
      "currency": "USD",
      "budget": 5000.00
    }
    ```
  - Required Fields:
    - `name`: Trip name (string)
    - `startDate`: Start date (ISO date string)
    - `endDate`: End date (ISO date string, must be after startDate)
    - `members`: Array of user UUIDs (non-empty array)
  - Optional Fields:
    - `currency`: Currency code (defaults to "USD")
    - `budget`: Budget amount (number, nullable)
  - Returns: Created trip with all members
  - Response format:
    ```json
    {
      "id": "trip-uuid",
      "name": "Summer Vacation",
      "startDate": "2024-07-01T00:00:00.000Z",
      "endDate": "2024-07-15T00:00:00.000Z",
      "currency": "USD",
      "budget": "5000.00",
      "createdAt": "2024-07-01T00:00:00.000Z",
      "members": [
        {
          "userId": "user-uuid",
          "userEmail": "user@example.com",
          "role": "OWNER",
          "joinedAt": "2024-07-01T00:00:00.000Z"
        }
      ]
    }
    ```
  - Note: The authenticated user is automatically added as OWNER, other members are added as EDITOR
  - Returns 400 for validation errors (invalid dates, missing fields, invalid user IDs)

- `POST /api/trips/:tripId/days` - Create a trip day with itinerary items (protected)
  - Headers: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
  - Path Parameters:
    - `tripId`: Trip UUID
  - Request Body:
    ```json
    {
      "date": "2024-07-05T00:00:00.000Z",
      "itineraryItems": [
        {
          "type": "ACTIVITY",
          "title": "Visit Museum",
          "description": "Explore the local museum",
          "startTime": "2024-07-05T10:00:00.000Z",
          "endTime": "2024-07-05T12:00:00.000Z",
          "order": 1
        },
        {
          "type": "FOOD",
          "title": "Lunch at Restaurant",
          "order": 2
        }
      ]
    }
    ```
  - Required Fields:
    - `date`: Day date (ISO date string, must be within trip date range)
    - `itineraryItems`: Array of itinerary items
  - Itinerary Item Fields:
    - `type`: Item type - `TRAVEL`, `STAY`, `ACTIVITY`, `FOOD`, or `NOTE` (required)
    - `title`: Item title (required)
    - `order`: Display order (required, number)
    - `description`: Item description (optional)
    - `startTime`: Start time (optional, ISO date string)
    - `endTime`: End time (optional, ISO date string)
  - Returns: Created trip day with all itinerary items
  - Response format:
    ```json
    {
      "id": "day-uuid",
      "date": "2024-07-05T00:00:00.000Z",
      "dayNumber": 5,
      "tripId": "trip-uuid",
      "createdAt": "2024-07-05T00:00:00.000Z",
      "items": [
        {
          "id": "item-uuid",
          "type": "ACTIVITY",
          "title": "Visit Museum",
          "description": "Explore the local museum",
          "startTime": "2024-07-05T10:00:00.000Z",
          "endTime": "2024-07-05T12:00:00.000Z",
          "order": 1,
          "createdAt": "2024-07-05T00:00:00.000Z"
        }
      ]
    }
    ```
  - Note: `dayNumber` is automatically calculated based on trip startDate
  - Returns 400 for validation errors (date out of range, invalid item types, missing fields)
  - Returns 404 if trip not found or user doesn't have access

### Health Check

- `GET /health` - Health check endpoint

## Authentication Flow

This backend is designed to work with frontend applications (Next.js, Flutter, etc.) that use Firebase Client SDK for authentication.

1. **Frontend Authentication**: User registers/logs in using Firebase Client SDK on the frontend
2. **Get ID Token**: Frontend obtains Firebase ID token after successful authentication
3. **API Requests**: Frontend sends ID token in `Authorization: Bearer <ID_TOKEN>` header to backend
4. **Middleware Processing**: 
   - `authMiddleware` verifies the Firebase ID token
   - Automatically creates/updates user in database (using `upsert`)
   - Attaches user information to request object
5. **Protected Routes**: Routes can access authenticated user via `request.user`

### Frontend Integration Example

**Next.js (React):**
```typescript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
const idToken = await user?.getIdToken();

fetch('http://localhost:3000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});
```

**Flutter:**
```dart
import 'package:firebase_auth/firebase_auth.dart';

final user = FirebaseAuth.instance.currentUser;
final idToken = await user?.getIdToken();

final response = await http.get(
  Uri.parse('http://localhost:3000/api/auth/me'),
  headers: {
    'Authorization': 'Bearer $idToken',
  },
);
```

## Project Structure

```
src/
├── index.ts          # Application entry point
├── app.ts            # Fastify app configuration
├── lib/
│   ├── prisma.ts     # Prisma client instance
│   └── firebase.ts   # Firebase Admin initialization
├── middleware/
│   └── auth.ts       # Authentication middleware
└── routes/
    ├── auth.ts       # Authentication routes
    └── trips.ts      # Trip routes
```
