# ─── Stage 1: Build the Vite frontend ───────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Empty string means API calls go to the same origin (no CORS needed)
ENV VITE_API_URL=""
RUN npm run build

# ─── Stage 2: Backend + serve built frontend ─────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Copy the compiled React app into /app/public so Express can serve it
COPY --from=frontend-build /app/frontend/dist ./public

# Render injects $PORT at runtime; we expose 5000 as the fallback default
EXPOSE 5000

CMD ["node", "src/server.js"]
