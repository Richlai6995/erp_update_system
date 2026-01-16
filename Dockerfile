# Build Stage (Frontend)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy client package files
COPY client/package*.json ./client/
# Install client dependencies
WORKDIR /app/client
RUN npm install

# Copy client source code
COPY client ./

# Build Frontend (Vite)
RUN npm run build

# Production Stage (Server)
FROM node:20-alpine AS runner

# Install Timezone Data
RUN apk add --no-cache tzdata
ENV TZ=Asia/Taipei

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install ONLY production dependencies
RUN npm install --only=production

# Copy server source code
# Copy server source code
COPY server ./
# Copy docs for manual viewer (Must match relative path ../../docs from routes)
COPY docs /docs

# Copy built frontend assets from builder to 'public' folder in server
# server.js is configured to serve static files from ./public
COPY --from=builder /app/client/dist ./public

# Create directory for uploads/data to ensure permissions
# We expect volumes to be mounted here
RUN mkdir -p local_storage data logs

ENV PORT=3002
ENV NODE_ENV=production
# Default DB path if not overridden
ENV DB_PATH=/app/data/system.db
# Files root
ENV FILES_ROOT_DIR=/app/local_storage

EXPOSE 3002

# Start script
CMD ["node", "server.js"]
