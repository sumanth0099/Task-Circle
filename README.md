# TaskCircle

A collaborative task management application built with a React frontend and Node/Express backend. Includes real-time progress tracking, role-based access, and an integrated AI assistant powered by Groq.

## Architecture

- **Frontend**: React 19, Vite, React Router, plain CSS
- **Backend**: Node.js, Express, PostgreSQL, Redis
- **Auth**: Google OAuth via Passport.js (Server-side sessions)
- **AI**: Groq API (Llama 3.1)

## Local Development Setup

1. **Prerequisites**
   - Node.js v20+
   - PostgreSQL
   - Redis

2. **Environment Variables**
   - Copy `.env.example` to `backend/src/.env`
   - Fill in your Google OAuth credentials and Groq API key

3. **Install Dependencies**
   \`\`\`bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd frontend
   npm install
   \`\`\`

4. **Run Locally**
   Start the backend and frontend development servers:
   \`\`\`bash
   # Terminal 1: Backend (runs on port 5000)
   cd backend
   npm start

   # Terminal 2: Frontend (runs on port 5173)
   cd frontend
   npm run dev
   \`\`\`

## Deployment (Docker & Render)

This project is fully Dockerized and ready to be deployed to [Render.com](https://render.com).

### 1. Database Setup (Render or Upstash)
- Create a PostgreSQL database on Render.
- Create a Redis instance on Upstash or Render.
- Save the connection URLs.

### 2. Backend Deployment
- Create a new **Web Service** on Render.
- Connect your GitHub repository.
- Build Type: **Docker**
- Root Directory: `backend`
- Environment Variables:
  - `NODE_ENV=production`
  - `DATABASE_URL` = your postgres url
  - `REDIS_URL` = your rediss url
  - `SESSION_SECRET` = a random long string
  - `GOOGLE_CLIENT_ID` = your google client id
  - `GOOGLE_CLIENT_SECRET` = your google secret
  - `FRONTEND_URL` = `https://your-frontend-url.onrender.com`
  - `GOOGLE_CALLBACK_URL` = `https://your-backend-url.onrender.com/api/auth/google/callback`
  - `GROQ_API_KEY` = your groq api key (optional)

### 3. Frontend Deployment
- Create a new **Web Service** on Render (not a static site, because it uses Nginx for routing).
- Connect your GitHub repository.
- Build Type: **Docker**
- Root Directory: `frontend`
- Environment Variables:
  - `VITE_API_URL` = `https://your-backend-url.onrender.com`

### 4. Important: Google OAuth Setup
After deploying, update your Google Cloud Console Credentials:
- **Authorized JavaScript origins**: Add your frontend URL
- **Authorized redirect URIs**: Add your backend callback URL (`https://your-backend-url.onrender.com/api/auth/google/callback`)
