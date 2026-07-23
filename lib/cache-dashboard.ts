// 대시보드 캐싱 유틸리티 (Vercel KV)
import { kv } from '@vercel/kv'

interface CacheOptions {
  ttl?: number // 초 단위
}

export async function getCachedDashboard(
  userEmail: string,
  organizationId: string,
  options: CacheOptions = { ttl: 60 }
) {
  const cacheKey = `dashboard:${userEmail}:${organizationId || 'none'}`

  try {
    const cached = await kv.get(cacheKey)

    if (cached && typeof cached === 'object' && 'timestamp' in cached) {
      const age = Date.now() - (cached.timestamp as number)
      if (age < (options.ttl! * 1000)) {
        console.log('[cache] Dashboard hit:', cacheKey, `age: ${age}ms`)
        return (cached as any).data
      }
    }
  } catch (error) {
    console.error('[cache] Get failed:', error)
    // Vercel KV 에러 시 null 반환 (캐시 없이 진행)
  }

  return null
}

export async function setCachedDashboard(
  userEmail: string,
  organizationId: string,
  data: any,
  options: CacheOptions = { ttl: 60 }
) {
  const cacheKey = `dashboard:${userEmail}:${organizationId || 'none'}`
  const ttl = options.ttl ?? 60

  try {
    await kv.set(
      cacheKey,
      { data, timestamp: Date.now() },
      { ex: ttl }
    )
    console.log('[cache] Dashboard set:', cacheKey, `ttl: ${ttl}s`)
  } catch (error) {
    console.error('[cache] Set failed:', error)
    // Vercel KV 에러 시 무시 (캐시 없이 진행)
  }
}

export async function invalidateDashboard(userEmail?: string, organizationId?: string) {
  if (userEmail && organizationId !== undefined) {
    const cacheKey = `dashboard:${userEmail}:${organizationId || 'none'}`
    try {
      await kv.del(cacheKey)
      console.log('[cache] Dashboard invalidated:', cacheKey)
    } catch (error) {
      console.error('[cache] Delete failed:', error)
    }
  }
}
