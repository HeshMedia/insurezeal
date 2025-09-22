# syntax=docker/dockerfile:1.7

# ------------------------
# 1) Builder: install deps and build Next.js app
# ------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Install libc compat for some native packages
RUN apk add --no-cache libc6-compat

# Copy only lockfiles and package manifest first for better caching
COPY package.json bun.lock* ./

# Use corepack to ensure correct package manager (bun) if needed, else npm
RUN corepack enable && \
    if [ -f bun.lock ]; then \
      corepack prepare bun@latest --activate && bun install --frozen-lockfile; \
    else \
      npm ci; \
    fi

# Copy the rest of the app
COPY . .

# Build the Next.js app
RUN bun run build

# ------------------------
# 2) Runner: use Next.js standalone output
# ------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone output includes all production node_modules in .next/standalone
COPY --from=deps /app/.next/standalone ./
COPY --from=deps /app/.next/static ./.next/static
COPY --from=deps /app/public ./public

# Expose default Next.js port
EXPOSE 3000

# Coolify will use this default start command
CMD ["node", "server.js"]


