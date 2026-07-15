'use client'

export default function TestEnvPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h1>환경변수 테스트</h1>

      <div style={{ marginTop: 20 }}>
        <h3>NEXT_PUBLIC_SUPABASE_URL:</h3>
        <div style={{
          padding: 10,
          background: supabaseUrl ? '#d4edda' : '#f8d7da',
          border: `1px solid ${supabaseUrl ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: 4
        }}>
          {supabaseUrl || '❌ 설정되지 않음'}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>NEXT_PUBLIC_SUPABASE_ANON_KEY:</h3>
        <div style={{
          padding: 10,
          background: supabaseKey ? '#d4edda' : '#f8d7da',
          border: `1px solid ${supabaseKey ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: 4
        }}>
          {supabaseKey ? `${supabaseKey.substring(0, 20)}...` : '❌ 설정되지 않음'}
        </div>
      </div>

      <div style={{ marginTop: 40, padding: 20, background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4 }}>
        <h3>⚠️ 진단</h3>
        {!supabaseUrl && <p>❌ SUPABASE_URL이 로드되지 않았습니다!</p>}
        {!supabaseKey && <p>❌ SUPABASE_ANON_KEY가 로드되지 않았습니다!</p>}
        {supabaseUrl && supabaseKey && <p>✅ 환경변수가 정상적으로 로드되었습니다.</p>}
      </div>

      <div style={{ marginTop: 20 }}>
        <a href="/login" style={{ color: 'blue', textDecoration: 'underline' }}>
          ← 로그인 페이지로 돌아가기
        </a>
      </div>
    </div>
  )
}
