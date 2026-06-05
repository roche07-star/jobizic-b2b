import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 사용자 업무 이관 API
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { target_email } = await req.json()
    const userId = params.id

    if (!target_email) {
      return NextResponse.json({ error: '이관받을 사용자를 선택하세요.' }, { status: 400 })
    }

    // 1. 원본 사용자 정보 조회
    const { data: sourceUser, error: sourceError } = await supabaseAdmin
      .from('profiles')
      .select('email, organization_id')
      .eq('id', userId)
      .single()

    if (sourceError || !sourceUser) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 2. 대상 사용자 확인 (같은 조직인지 검증)
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('email, organization_id')
      .eq('email', target_email)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: '이관받을 사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (sourceUser.organization_id !== targetUser.organization_id) {
      return NextResponse.json({ error: '같은 조직의 사용자에게만 이관할 수 있습니다.' }, { status: 400 })
    }

    const sourceEmail = sourceUser.email

    // 3. JD 이관
    const { data: jds, error: jdError } = await supabaseAdmin
      .from('job_descriptions')
      .update({ created_by: target_email })
      .eq('created_by', sourceEmail)
      .select('id')

    // 4. Candidates 이관
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .update({ assigned_to: target_email })
      .eq('assigned_to', sourceEmail)
      .select('id')

    // 5. Pipeline 이관
    const { data: pipelines, error: pipelinesError } = await supabaseAdmin
      .from('pipeline')
      .update({ assigned_to: target_email })
      .eq('assigned_to', sourceEmail)
      .select('id')

    const counts = {
      jds: jds?.length || 0,
      candidates: candidates?.length || 0,
      pipelines: pipelines?.length || 0,
    }

    console.log('[TRANSFER]', sourceEmail, '->', target_email, counts)

    return NextResponse.json({
      message: '업무 이관이 완료되었습니다.',
      counts,
      from: sourceEmail,
      to: target_email,
    })
  } catch (e: any) {
    console.error('[admin/users/transfer POST]', e)
    return NextResponse.json({ error: e.message || '이관 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
