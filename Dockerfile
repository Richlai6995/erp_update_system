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
FROM node:20-slim AS runner

# Install Oracle Client dependencies (libaio1 is required for Thick Mode)
RUN apt-get update && apt-get install -y libaio1 && rm -rf /var/lib/apt/lists/*

# Install Timezone Data (Debian uses tzdata too, but installation is different usually, but node:20-slim might have it or standard way)
ENV TZ=Asia/Taipei

# Oracle Environment Variables
ENV ORACLE_HOME=/opt/oracle/instantclient_19_26
ENV LD_LIBRARY_PATH=${ORACLE_HOME}
ENV PATH=${ORACLE_HOME}:${PATH}
# Config ldconfig (Debian way)
RUN mkdir -p /etc/ld.so.conf.d && echo "${ORACLE_HOME}" > /etc/ld.so.conf.d/oracle-instantclient.conf

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install ONLY production dependencies
RUN npm install --only=production

# Copy server source code
COPY server ./
# Copy docs for manual viewer (Must match relative path ../../docs from routes)
COPY docs ./docs

# Copy built frontend assets from builder to 'public' folder in server
# server.js is configured to serve static files from ./public
COPY --from=builder /app/client/dist ./public

# Create directory for uploads/data to ensure permissions
# We expect volumes to be mounted here
RUN mkdir -p local_storage data logs

ENV PORT=3003
ENV NODE_ENV=production
# Default DB path if not overridden
ENV DB_PATH=/app/data/system.db
# Files root
ENV FILES_ROOT_DIR=/app/local_storage

EXPOSE 3003

# Start script
CMD ["node", "server.js"]
