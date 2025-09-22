FROM oven/bun:1.2-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies (cached)
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --ci

# Build the Next.js app (standalone)
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_SHEETS_ID
ARG NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL
ARG NEXT_PUBLIC_GOOGLE_PRIVATE_KEY
ARG GOOGLE_SHEETS_ID
ARG GOOGLE_CLIENT_EMAIL
ARG GOOGLE_PRIVATE_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_SHEETS_ID=$NEXT_PUBLIC_GOOGLE_SHEETS_ID \
    NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL=$NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL \
    NEXT_PUBLIC_GOOGLE_PRIVATE_KEY=$NEXT_PUBLIC_GOOGLE_PRIVATE_KEY \
    GOOGLE_SHEETS_ID=$GOOGLE_SHEETS_ID \
    GOOGLE_CLIENT_EMAIL=$GOOGLE_CLIENT_EMAIL \
    GOOGLE_PRIVATE_KEY=$GOOGLE_PRIVATE_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Runtime image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set correct ownership and prepare .next directory
RUN mkdir -p ./.next && chown -R nextjs:nodejs ./.next

# Copy standalone server and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["bun", "server.js"]
