import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: candidateId } = await params
    const { target_email } = await req.json()

    if (!target_email) {
      return NextResponse.json({ error: '이전받을 멤버를 선택해주세요.' }, { status: 400 })
    }

    // 후보자 정보 조회
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id, name, created_by, organization_id')
      .eq('id', candidateId)
      .single()

    if (candidateError || !candidate) {
      return NextResponse.json({ error: '후보자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 대상 멤버 확인
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, organization_id')
      .eq('email', target_email)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: '대상 멤버를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 같은 조직인지 확인
    if (candidate.organization_id !== targetUser.organization_id) {
      return NextResponse.json({ error: '같은 조직의 멤버에게만 이전할 수 있습니다.' }, { status: 403 })
    }

    // 후보자 소유권 이전
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update({
        created_by: target_email,
        assigned_to: target_email,
      })
      .eq('id', candidateId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 파이프라인도 함께 이전 (선택사항)
    await supabaseAdmin
      .from('pipeline')
      .update({
        created_by: target_email,
        assigned_to: target_email,
      })
      .eq('candidate_id', candidateId)
      .eq('created_by', candidate.created_by)

    return NextResponse.json({
      success: true,
      message: `${candidate.name} 후보자의 소유권이 ${target_email}로 이전되었습니다.`,
    })
  } catch (e: any) {
    console.error('[api/candidates/[id]/transfer POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
