import { Redis } from "@upstash/redis"

// Reaproveita as mesmas env vars que o resto do projeto já usa pro
// Upstash Redis. Se o nome for diferente em algum outro ponto do código
// de vocês, ajuste aqui — é o único lugar que precisa mudar.
const globalForRedis = globalThis as unknown as { redis: Redis | undefined }

export const redis =
  globalForRedis.redis ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis
}