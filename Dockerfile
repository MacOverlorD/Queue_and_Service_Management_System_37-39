# One image serves the API and the built React client on $PORT (Cloud Run injects it).
# Build from the repo root: docker build .
# No secret is baked in: DATABASE_URL and SEED_PASSWORD arrive at run time.

FROM node:24-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:24-alpine AS server-builder
WORKDIR /app/server
RUN apk add --no-cache openssl
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate && npm run build

FROM node:24-alpine
RUN apk add --no-cache openssl
# cwd must be /app/server: the API finds the client at ../client/dist.
WORKDIR /app/server
# node_modules keeps the prisma CLI and tsx: the migration job runs migrate + seed from this image.
COPY --from=server-builder /app/server/package*.json ./
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/prisma ./prisma
COPY --from=client-builder /app/client/dist /app/client/dist
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node
CMD ["node", "dist/src/index.js"]
