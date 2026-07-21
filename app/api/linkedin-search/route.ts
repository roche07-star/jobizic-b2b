import { NextRequest, NextResponse } from 'next/server'
import { extractKeywordsWithClaude, buildLinkedInSearchQuery } from '@/lib/extractLinkedInKeywords'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

interface SearchResult {
  title: string
  url: string
  snippet: string
  displayUrl: string
}

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 체크
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 2. Rate Limiting (선택사항 - 일일 10회 제한)
    // TODO: Vercel KV 또는 Supabase로 검색 횟수 제한 구현

    // 3. 요청 파라미터
    const { jdId, position, location } = await req.json()

    if (!jdId && !position) {
      return NextResponse.json({ error: 'jdId 또는 position이 필요합니다.' }, { status: 400 })
    }

    // 4. JD 정보 가져오기 (jdId가 있는 경우)
    let jobPosition = position
    if (jdId && !position) {
      const { data: jd, error: jdError } = await supabaseAdmin
        .from('job_descriptions')
        .select('position')
        .eq('id', jdId)
        .single()

      if (jdError || !jd) {
        console.error('[LinkedIn Search] JD lookup error:', jdError)
        return NextResponse.json({
          error: 'JD를 찾을 수 없습니다.',
          details: jdError?.message
        }, { status: 404 })
      }

      jobPosition = jd.position || ''
    }

    if (!jobPosition) {
      return NextResponse.json({ error: '직무명이 없습니다.' }, { status: 400 })
    }

    // 5. 키워드 추출 (Claude API 사용)
    console.log('[LinkedIn Search] Extracting keywords from:', jobPosition)
    const keywords = await extractKeywordsWithClaude(jobPosition)
    console.log('[LinkedIn Search] Extracted keywords:', keywords)

    // 6. 검색 쿼리 생성
    const searchQuery = buildLinkedInSearchQuery(keywords, location || 'Korea')
    console.log('[LinkedIn Search] Query:', searchQuery)

    // 7. Google Custom Search API 호출
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

    if (!apiKey || !searchEngineId) {
      return NextResponse.json({
        error: 'Google Search API가 설정되지 않았습니다. 관리자에게 문의하세요.',
        details: 'GOOGLE_SEARCH_API_KEY 또는 GOOGLE_SEARCH_ENGINE_ID가 환경변수에 없습니다.'
      }, { status: 500 })
    }

    const googleSearchUrl = new URL('https://www.googleapis.com/customsearch/v1')
    googleSearchUrl.searchParams.append('key', apiKey)
    googleSearchUrl.searchParams.append('cx', searchEngineId)
    googleSearchUrl.searchParams.append('q', searchQuery)
    googleSearchUrl.searchParams.append('num', '10') // 결과 10개
    googleSearchUrl.searchParams.append('hl', 'ko')  // 한국어

    console.log('[LinkedIn Search] Calling Google API...')
    const googleResponse = await fetch(googleSearchUrl.toString())

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json()
      console.error('[LinkedIn Search] Google API Error:', errorData)
      return NextResponse.json({
        error: 'Google 검색 API 오류',
        details: errorData.error?.message || '알 수 없는 오류'
      }, { status: googleResponse.status })
    }

    const googleData = await googleResponse.json()

    // 8. 결과 파싱 및 필터링
    const results: SearchResult[] = (googleData.items || [])
      .filter((item: any) => {
        // LinkedIn 프로필 URL만 필터링
        const url = item.link || ''
        return url.includes('linkedin.com/in/')
      })
      .map((item: any) => ({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
        displayUrl: item.displayLink || ''
      }))

    console.log('[LinkedIn Search] Found', results.length, 'results')

    // 9. 검색 로그 저장 (선택사항)
    try {
      await supabaseAdmin.from('linkedin_search_logs').insert({
        user_email: user.email,
        jd_id: jdId || null,
        position: jobPosition,
        keywords: keywords,
        query: searchQuery,
        results_count: results.length,
        created_at: new Date().toISOString()
      })
    } catch (logError) {
      console.error('[LinkedIn Search] Failed to save log:', logError)
      // 로그 실패해도 검색 결과는 반환
    }

    return NextResponse.json({
      keywords,
      query: searchQuery,
      results,
      totalResults: googleData.searchInformation?.totalResults || '0'
    })

  } catch (error: any) {
    console.error('[LinkedIn Search] Error:', error)
    return NextResponse.json({
      error: '검색 중 오류가 발생했습니다.',
      details: error.message
    }, { status: 500 })
  }
}
