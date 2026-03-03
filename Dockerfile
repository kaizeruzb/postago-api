FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY package.json ./
# For monorepo setup we need to copy shared package or link it. 
# Since it's linked via Git URL in package.json, standard install will work.
RUN pnpm install

COPY . .
RUN pnpm db:generate
RUN pnpm build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000
# Start with migrations for safety
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
