/**
 * CSV 다운로드 유틸리티
 */

export function downloadCSV(filename: string, data: any[], headers: string[]) {
  // CSV 헤더
  const csvHeaders = headers.join(',')

  // CSV 데이터 행
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]

      // null/undefined 처리
      if (value === null || value === undefined) return ''

      // 배열 처리 (스킬 등)
      if (Array.isArray(value)) return `"${value.join(', ')}"`

      // 문자열에 쉼표나 따옴표가 있으면 이스케이프
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }

      return stringValue
    }).join(',')
  })

  // CSV 전체 내용
  const csvContent = [csvHeaders, ...csvRows].join('\n')

  // BOM 추가 (한글 깨짐 방지)
  const BOM = '﻿'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

  // 다운로드
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * JD 목록을 CSV로 다운로드
 */
export function downloadJDsAsCSV(jds: any[]) {
  const data = jds.map(jd => ({
    회사명: jd.company || '미상',
    포지션: jd.position,
    상태: jd.status,
    우선순위: jd.priority,
    등록일: new Date(jd.created_at).toLocaleDateString('ko-KR'),
    담당자: jd.created_by || '',
    필수스킬: Array.isArray(jd.required_skills) ? jd.required_skills : [],
    우대스킬: Array.isArray(jd.preferred_skills) ? jd.preferred_skills : [],
  }))

  downloadCSV('JD목록', data, ['회사명', '포지션', '상태', '우선순위', '등록일', '담당자', '필수스킬', '우대스킬'])
}

/**
 * 후보자 목록을 CSV로 다운로드
 */
export function downloadCandidatesAsCSV(candidates: any[]) {
  const currentYear = new Date().getFullYear()

  const data = candidates.map(c => {
    // 출생년도와 연령 계산
    let birthYearText = ''
    if (c.birth_year) {
      const age = currentYear - c.birth_year
      birthYearText = `${c.birth_year}년 (${age}세)`
    }

    // 최종학력 추출 (education 배열의 마지막 항목)
    let finalEducation = ''
    if (Array.isArray(c.education) && c.education.length > 0) {
      finalEducation = c.education[c.education.length - 1]
    }

    return {
      이름: c.name,
      '출생년도(연령)': birthYearText,
      이메일: c.email || '',
      전화번호: c.phone || '',
      최종학력: finalEducation,
      현재회사: c.current_company || '',
      현재직무: c.current_position || '',
      경력년수: c.total_experience_years || 0,
      상태: c.status,
      스킬: Array.isArray(c.skills) ? c.skills : [],
      기술스택: Array.isArray(c.tech_stack) ? c.tech_stack : [],
      희망포지션: c.desired_position || '',
      희망연봉: c.desired_salary || '',
      등록일: new Date(c.created_at).toLocaleDateString('ko-KR'),
    }
  })

  downloadCSV('후보자목록', data, [
    '이름', '출생년도(연령)', '이메일', '전화번호', '최종학력',
    '현재회사', '현재직무', '경력년수', '상태', '스킬', '기술스택',
    '희망포지션', '희망연봉', '등록일'
  ])
}

/**
 * 파이프라인 현황을 CSV로 다운로드
 */
export function downloadPipelineAsCSV(pipelines: any[]) {
  const data = pipelines.map(p => ({
    JD회사: p.job_descriptions?.company || '미상',
    JD포지션: p.job_descriptions?.position || '',
    후보자명: p.candidates?.name || '',
    후보자현재직무: p.candidates?.current_position || '',
    단계: p.stage,
    매칭점수: p.match_score || '',
    우선순위: p.priority || '보통',
    활성상태: p.is_active ? '활성' : '비활성',
    생성일: new Date(p.created_at).toLocaleDateString('ko-KR'),
    최근활동: p.last_activity_at ? new Date(p.last_activity_at).toLocaleDateString('ko-KR') : '',
  }))

  downloadCSV('파이프라인현황', data, [
    'JD회사', 'JD포지션', '후보자명', '후보자현재직무', '단계',
    '매칭점수', '우선순위', '활성상태', '생성일', '최근활동'
  ])
}
