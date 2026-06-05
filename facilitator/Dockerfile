# Self-hosted x402 Hedera facilitator
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies first for better layer caching (includes tsx).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

ENV PORT=4020
EXPOSE 4020

# Drop root privileges.
USER node

CMD ["npx", "tsx", "src/server.ts"]
