# Awards Voting System

A mobile-first web-based voting system for an in-person awards event.

## Features

### Voter Experience

- **Mobile-first design** optimized for iOS Safari/Chrome
- **5-screen voting flow**:
  1. Welcome screen
  2. Mark movies seen
  3. Choose up to 5 favorites
  4. Rank favorites (1-5)
  5. Optional extra questions (under-seen, scary, funny, best time)
- **Real-time data storage** to Firebase Firestore
- **Client ID tracking** via localStorage (honesty-based)

### Admin Dashboard

- **Password-protected** (passcode: HOST)
- **Real-time results** with auto-refresh
- **Multiple views**:
  - Overview statistics
  - Best Picture results (Borda count)
  - Under-Seen/Hidden Gem award
  - Fun categories (scary, funny, best time)
  - Raw ballots with pagination
  - Export tools (JSON/CSV)

## Setup

### Backend

1. Navigate to `backend/` directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file (copy from `.env.example`):
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
   JWT_SECRET=your-secret-key-change-in-production
   PORT=3001
   CORS_ORIGIN=http://localhost:5173
   ```
4. Start the server:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

### Frontend

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` file (optional, for custom API URL):
   ```
   VITE_API_URL=http://localhost:3001/api
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

## Configuration

### Movie List

Edit `src/data/movies.json` to update the list of films. Format:

```json
[
  { "id": "movie-1", "title": "Movie Title" },
  ...
]
```

## Deployment

### Backend

- Deploy to any Node.js hosting (Railway, Render, Fly.io, etc.)
- Set environment variables in your hosting platform
- Ensure Firebase credentials are properly configured

### Frontend

- Build for production:
  ```bash
  npm run build
  ```
- Deploy `dist/` folder to static hosting (Vercel, Netlify, etc.)
- Update `VITE_API_URL` environment variable to point to your backend

## API Endpoints

- `POST /api/ballots` - Submit a ballot
- `GET /api/ballots` - Get all ballots (admin only)
- `GET /api/results/best-picture` - Get Borda score results
- `GET /api/results/overview` - Get dashboard overview
- `GET /api/results/under-seen` - Get under-seen award results
- `GET /api/results/fun-categories` - Get fun category results
- `POST /api/admin/auth` - Admin authentication

## Scoring System

### Best Picture

- Uses Borda count method:
  - #1 rank = 5 points
  - #2 rank = 4 points
  - #3 rank = 3 points
  - #4 rank = 2 points
  - #5 rank = 1 point
- Results include:
  - Total points
  - Number of #1 votes
  - Seen count and fraction
  - Average points per viewer

### Under-Seen Award

- Films with seen fraction ≤ 40%
- Winner determined by highest average points per viewer
- Secondary metric: most under-seen recommendation votes

### Fun Categories

- Simple vote counting
- Most votes wins

## Routes

- `/vote` - Public voting flow
- `/admin/login` - Admin login
- `/admin` - Admin dashboard
