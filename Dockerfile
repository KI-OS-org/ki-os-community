FROM node:20-alpine

LABEL org.opencontainers.image.title="KI-OS Community Edition"
LABEL org.opencontainers.image.description="Das Betriebssystem fuer die KI-Aera — Multi-Agent, Multi-Model, On-Premise"
LABEL org.opencontainers.image.url="https://ki-os.org"
LABEL org.opencontainers.image.source="https://github.com/KI-OS-org/ki-os"
LABEL org.opencontainers.image.version="1.6.0"
LABEL org.opencontainers.image.licenses="AGPL-3.0"

# Runtime dependencies
RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy application
COPY . .

# Persistent data directory
RUN mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE 3000

ENV NODE_ENV=production
ENV KI_OS_EDITION=community
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["node", "index.js"]
