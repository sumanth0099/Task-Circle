# Stage 1: Build the Vite frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm ci
# Copy the rest of the frontend source
COPY frontend/ ./
# Build the frontend (VITE_API_URL should be relative for single-origin)
ENV VITE_API_URL=""
RUN npm run build

# Stage 2: Build the Node.js backend and serve the application
FROM node:20-alpine
WORKDIR /app
# Copy backend package files and install dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev
# Copy the rest of the backend source
COPY backend/ ./
# Copy the built frontend files from the first stage into a public folder
COPY --from=frontend-build /app/frontend/dist ./public

# Expose port 5000 (Render provides PORT environment variable at runtime)
EXPOSE 5000
CMD ["npm", "start"]
