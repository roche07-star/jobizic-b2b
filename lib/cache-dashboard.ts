// 대시보드 캐싱 유틸리티
// TODO: Vercel KV 설치 후 활성화 (npm install @vercel/kv)

interface CacheOptions {
  ttl?: number // 초 단위
}

// 메모리 캐시 (임시)
const memoryCache = new Map<string, { data: any; timestamp: number }>()

export async function getCachedDashboard(
  userEmail: string,
  organizationId: string,
  options: CacheOptions = { ttl: 60 }
) {
  const cacheKey = `dashboard:${userEmail}:${organizationId || 'none'}`

  try {
    const cached = memoryCache.get(cacheKey)

    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < (options.ttl! * 1000)) {
        console.log('[cache] Dashboard hit:', cacheKey, `age: ${age}ms`)
        return cached.data
      } else {
        memoryCache.delete(cacheKey)
      }
    }
  } catch (error) {
    console.error('[cache] Get failed:', error)
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

  try {
    memoryCache.set(cacheKey, { data, timestamp: Date.now() })
    console.log('[cache] Dashboard set:', cacheKey, `ttl: ${options.ttl}s`)

    // TTL 후 자동 삭제
    setTimeout(() => {
      memoryCache.delete(cacheKey)
    }, options.ttl! * 1000)
  } catch (error) {
    console.error('[cache] Set failed:', error)
  }
}

export async function invalidateDashboard(userEmail?: string, organizationId?: string) {
  if (userEmail && organizationId !== undefined) {
    const cacheKey = `dashboard:${userEmail}:${organizationId || 'none'}`
    try {
      memoryCache.delete(cacheKey)
      console.log('[cache] Dashboard invalidated:', cacheKey)
    } catch (error) {
      console.error('[cache] Delete failed:', error)
    }
  }
}
