FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

FROM base AS build-query
RUN npm run build:query-api

FROM base AS build-stream
RUN npm run build:stream-processor

FROM base AS build-error
RUN npm run build:error-stream

FROM node:20-alpine AS runtime-base
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

FROM runtime-base AS query-api
COPY --from=build-query /app/dist/query-api ./dist
EXPOSE 3001
CMD ["node", "dist/query-api/main"]

FROM runtime-base AS stream-processor
COPY --from=build-stream /app/dist/stream-processor ./dist
CMD ["node", "dist/stream-processor/main"]

FROM runtime-base AS error-stream
COPY --from=build-error /app/dist/error-stream ./dist
EXPOSE 3010
CMD ["node", "dist/error-stream/main"]
