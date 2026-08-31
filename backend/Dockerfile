# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
# Same mirror the frontend image uses — the default registry times out from
# the VPS this deploys to.
RUN npm config set registry https://registry.npmmirror.com
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit --no-fund --maxsockets 5 \
      --fetch-retries 5 --fetch-retry-mintimeout 20000 --fetch-retry-maxtimeout 120000

FROM base AS dev
COPY . .
RUN chmod +x entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM base AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --prefer-offline --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh \
    && addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/uploads && chown -R app:app /app
USER app
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/server.js"]
