import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organization_id')
    const userEmail = req.nextUrl.searchParams.get('user_email')
    const role = req.nextUrl.searchParams.get('role')

    if (!organizationId || !userEmail || !role) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
    }

    // 1. 조직의 모든 후보자 조회
    let query = supabaseAdmin
      .from('candidates')
      .select('id, name, email, phone, birth_year, current_company, current_position, created_at, created_by')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })

    // Role별 필터링
    if (role === 'headhunter' || role === 'operator') {
      query = query.eq('created_by', userEmail)
    } else if (role === 'owner' || role === 'manager') {
      const { data: operators } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('organization_id', organizationId)
        .eq('role', 'operator')

      const operatorEmails = operators?.map(o => o.email) || []
      const allowedCreators = [userEmail, ...operatorEmails]
      query = query.in('created_by', allowedCreators)
    }

    const { data: candidates, error } = await query

    if (error) {
      console.error('[duplicates] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ duplicateGroups: [] })
    }

    // 2. 중복 그룹 찾기
    const duplicateGroups: Array<{
      key: string
      reason: string
      candidates: typeof candidates
    }> = []

    // 2-1. Email 기준 (우선)
    const emailMap = new Map<string, typeof candidates>()
    for (const candidate of candidates) {
      if (candidate.email) {
        const email = candidate.email.toLowerCase()
        if (!emailMap.has(email)) {
          emailMap.set(email, [])
        }
        emailMap.get(email)!.push(candidate)
      }
    }

    emailMap.forEach((group, email) => {
      if (group.length > 1) {
        duplicateGroups.push({
          key: `email:${email}`,
          reason: `동일 이메일: ${email}`,
          candidates: group
        })
      }
    })

    // 2-2. Phone 기준
    const phoneMap = new Map<string, typeof candidates>()
    for (const candidate of candidates) {
      if (candidate.phone) {
        // 전화번호 정규화 (숫자만)
        const phone = candidate.phone.replace(/[^0-9]/g, '')
        if (phone.length >= 10) {
          if (!phoneMap.has(phone)) {
            phoneMap.set(phone, [])
          }
          phoneMap.get(phone)!.push(candidate)
        }
      }
    }

    phoneMap.forEach((group, phone) => {
      if (group.length > 1) {
        // 이미 email로 묶인 그룹은 제외
        const alreadyGrouped = duplicateGroups.some(g =>
          g.candidates.some(c => group.some(gc => gc.id === c.id))
        )
        if (!alreadyGrouped) {
          duplicateGroups.push({
            key: `phone:${phone}`,
            reason: `동일 전화번호`,
            candidates: group
          })
        }
      }
    })

    // 2-3. Name + Birth Year 기준 (보조)
    const nameMap = new Map<string, typeof candidates>()
    for (const candidate of candidates) {
      if (candidate.name && candidate.birth_year) {
        const key = `${candidate.name}:${candidate.birth_year}`
        if (!nameMap.has(key)) {
          nameMap.set(key, [])
        }
        nameMap.get(key)!.push(candidate)
      }
    }

    nameMap.forEach((group, key) => {
      if (group.length > 1) {
        const alreadyGrouped = duplicateGroups.some(g =>
          g.candidates.some(c => group.some(gc => gc.id === c.id))
        )
        if (!alreadyGrouped) {
          const [name, birthYear] = key.split(':')
          duplicateGroups.push({
            key: `name:${key}`,
            reason: `동일 이름 + 출생연도: ${name} (${birthYear}년생)`,
            candidates: group
          })
        }
      }
    })

    console.log(`[duplicates] Found ${duplicateGroups.length} duplicate groups`)

    return NextResponse.json({
      duplicateGroups,
      total: duplicateGroups.reduce((sum, g) => sum + g.candidates.length, 0)
    })

  } catch (e) {
    console.error('[api/candidates/duplicates GET]', e)
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
