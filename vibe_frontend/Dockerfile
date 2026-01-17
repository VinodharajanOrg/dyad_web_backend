# Stage 1: Dependencies
#FROM artifacts.mastercard.int/mcr-stable/mastercard/node:22-alpine AS deps
FROM node:24-alpine AS deps
USER root
WORKDIR /app
 
# ENV NODE_TLS_REJECT_UNAUTHORIZED=0
# RUN npm config set registry https://artifacts.mastercard.int/artifactory/api/npm/npm-all/ \
#  && npm config set strict-ssl false
 
# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile --loglevel verbose || npm install --loglevel verbose
 
# Stage 2: Builder
#ROM artifacts.mastercard.int/mcr-stable/mastercard/node:22-alpine AS builder
FROM node:24-alpine AS builder
USER root
 
# ENV NODE_TLS_REJECT_UNAUTHORIZED=0
# RUN npm config set registry https://artifacts.mastercard.int/artifactory/api/npm/npm-all/ \
#  && npm config set strict-ssl false
 
WORKDIR /app
 
# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .
 
# Set environment variables for build
# Note: NEXT_PUBLIC_* variables must be set at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
 
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
 
# Build the Next.js application
RUN npm run build
 
# Stage 3: Runner
#FROM artifacts.mastercard.int/mcr-stable/mastercard/node:22-alpine AS runner
FROM node:24-alpine AS runner
 
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
WORKDIR /app
 
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
 
# Copy necessary files WITH ownership
COPY --from=builder --chown=node:node /app/next.config.js ./next.config.js
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
 
# Switch to non-root user
USER node
 
RUN ls -l /app/package.json
RUN whoami
 
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
 
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
 
CMD ["npm", "start"]