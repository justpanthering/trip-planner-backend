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
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id",...}'
PORT=3000
HOST=0.0.0.0
```

3. Generate Prisma client:
```bash
npx prisma generate
```

4. Run database migrations:
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
    └── auth.ts       # Authentication routes
```
