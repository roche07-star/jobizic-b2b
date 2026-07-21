import { NextRequest, NextResponse } from 'next/server'
import { extractKeywordsWithClaude } from '@/lib/extractLinkedInKeywords'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

interface LinkedInSearchUrl {
  label: string
  url: string
  description: string
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

    // 2. 요청 파라미터
    const { jdId, position, location } = await req.json()

    if (!jdId && !position) {
      return NextResponse.json({ error: 'jdId 또는 position이 필요합니다.' }, { status: 400 })
    }

    // 3. JD 정보 가져오기 (jdId가 있는 경우)
    let jobPosition = position
    if (jdId && !position) {
      const { data: jd, error: jdError } = await supabaseAdmin
        .from('job_descriptions')
        .select('position')
        .eq('id', jdId)
        .single()

      if (jdError || !jd) {
        console.error('[LinkedIn Search Free] JD lookup error:', jdError)
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

    // 4. 키워드 추출 (Claude API 사용)
    console.log('[LinkedIn Search Free] Extracting keywords from:', jobPosition)
    const keywords = await extractKeywordsWithClaude(jobPosition)
    console.log('[LinkedIn Search Free] Extracted keywords:', keywords)

    // 5. LinkedIn 검색 URL 생성 (여러 조합)
    const { coreJob, qualifiers, skills } = keywords
    const locationText = location || '한국'

    // 기본 LinkedIn People Search URL
    const baseUrl = 'https://www.linkedin.com/search/results/people/'

    const searchUrls: LinkedInSearchUrl[] = []

    // URL 1: 핵심 직무 + 주요 스킬 (가장 포괄적)
    const allKeywords = [coreJob, ...qualifiers, ...skills.slice(0, 3)].filter(Boolean)
    searchUrls.push({
      label: '전체 검색 (추천)',
      url: `${baseUrl}?keywords=${encodeURIComponent(allKeywords.join(' '))}`,
      description: `${allKeywords.join(', ')}`
    })

    // URL 2: 핵심 직무 + 위치
    searchUrls.push({
      label: '직무 + 위치',
      url: `${baseUrl}?keywords=${encodeURIComponent(`${coreJob} ${locationText}`)}`,
      description: `${coreJob} (${locationText})`
    })

    // URL 3: 핵심 직무 + 주요 수식어
    if (qualifiers.length > 0) {
      const mainQualifiers = qualifiers.slice(0, 2)
      searchUrls.push({
        label: '전문 분야',
        url: `${baseUrl}?keywords=${encodeURIComponent(`${mainQualifiers.join(' ')} ${coreJob}`)}`,
        description: `${mainQualifiers.join(', ')} ${coreJob}`
      })
    }

    // URL 4: 핵심 스킬
    if (skills.length > 0) {
      const mainSkills = skills.slice(0, 3)
      searchUrls.push({
        label: '핵심 스킬',
        url: `${baseUrl}?keywords=${encodeURIComponent(mainSkills.join(' '))}`,
        description: `${mainSkills.join(', ')}`
      })
    }

    // URL 5: 포괄 검색 (직무만)
    searchUrls.push({
      label: '포괄 검색',
      url: `${baseUrl}?keywords=${encodeURIComponent(coreJob)}`,
      description: `${coreJob} 전체`
    })

    console.log('[LinkedIn Search Free] Generated', searchUrls.length, 'search URLs')

    // 6. 검색 로그 저장
    try {
      await supabaseAdmin.from('linkedin_search_logs').insert({
        user_email: user.email,
        jd_id: jdId || null,
        position: jobPosition,
        keywords: keywords,
        query: allKeywords.join(' '),
        results_count: searchUrls.length,
        search_type: 'linkedin_direct', // LinkedIn 직접 검색
        created_at: new Date().toISOString()
      })
    } catch (logError) {
      console.error('[LinkedIn Search Free] Failed to save log:', logError)
      // 로그 실패해도 검색 URL은 반환
    }

    return NextResponse.json({
      keywords,
      searchUrls,
      searchType: 'linkedin_direct' // LinkedIn 직접 검색
    })

  } catch (error: any) {
    console.error('[LinkedIn Search Free] Error:', error)
    return NextResponse.json({
      error: '검색 URL 생성 중 오류가 발생했습니다.',
      details: error.message
    }, { status: 500 })
  }
}
