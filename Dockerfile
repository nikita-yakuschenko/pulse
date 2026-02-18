# Модуль.Пульс - production Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Генерация Prisma Client до сборки (нужно для type-check и для src/lib/db)
RUN npx prisma generate
# Next.js читает .env.production при сборке — NEXT_PUBLIC_* попадут в бандл
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["node", "server.js"]
