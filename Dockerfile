# syntax=docker/dockerfile:1.6

# --- Stage 1: build frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: install backend deps ---
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# --- Stage 3: runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=4000
ENV SERVE_FRONTEND=1

EXPOSE 4000
WORKDIR /app/backend
CMD ["npm", "start"]
