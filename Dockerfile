# syntax=docker/dockerfile:1
# Self-hosted (VPS) image. Vercel doesn't use this file.
#   docker build -t perks .                         # app
#   docker build -t perks-migrate --target migrate .  # one-off migrations
#   docker run --rm --env-file .env.production perks-migrate
#   docker run -d -p 3000:3000 --env-file .env.production perks

FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
# prisma.config reads DATABASE_URL even for `generate`; a placeholder is enough at build time.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Migrations: needs the Prisma CLI + migrations, not the app.
FROM node:24-alpine AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma7.config.ts ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
