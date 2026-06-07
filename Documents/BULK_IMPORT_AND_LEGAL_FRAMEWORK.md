# 후보자 DB 일괄 업로드 및 법적 프레임워크 설계

**일시**: 2026-06-08  
**참석자**: 디바 (Backend/총괄), 디아 (Frontend), 테스 (QA/보안)  
**안건**: 사용자 보유 후보자 DB 업로드 기능 및 법적 책임 체계 구축

---

## 📋 목차

1. [비즈니스 요구사항](#1-비즈니스-요구사항)
2. [기술적 구현 방안](#2-기술적-구현-방안)
3. [법적 프레임워크](#3-법적-프레임워크)
4. [정보보안 설계](#4-정보보안-설계)
5. [UI/UX 설계](#5-uiux-설계)
6. [리스크 관리](#6-리스크-관리)
7. [구현 로드맵](#7-구현-로드맵)

---

## 1. 비즈니스 요구사항

### 1.1 현황 분석

**문제점**:
- ✅ 사용자들이 이미 보유한 후보자 DB (Excel, CSV, SQL 등)
- ✅ 수작업으로 하나씩 입력 → 시간 소모, 낮은 생산성
- ✅ 개인정보 포함 → 법적 리스크

**사용자 니즈**:
```
"20년간 모아온 후보자 3,000명이 Excel에 있습니다.
이걸 일일이 입력하려면 몇 주가 걸립니다.
한 번에 업로드할 수 있으면 좋겠습니다."
```

---

### 1.2 비즈니스 가치

**고객 측면**:
- ⏱️ 시간 절약: 3,000명 수작업 입력 (100시간) → 일괄 업로드 (10분)
- 💰 비용 절감: 데이터 입력 외주 불필요
- 📈 빠른 온보딩: 서비스 도입 즉시 활용 가능
- 🔄 레거시 시스템 통합: 기존 자산 활용

**Jobizic 측면**:
- 🚀 도입 장벽 낮춤: "기존 DB 그대로 사용 가능"
- 💼 엔터프라이즈 필수: 대규모 고객 확보 필수 기능
- 🎯 경쟁력: ATS 기본 기능 (경쟁사 모두 제공)
- ⚠️ 법적 리스크: 개인정보 대량 처리 → 책임 명확화 필요

---

## 2. 기술적 구현 방안

### 2.1 지원 파일 형식

**우선순위별 지원**:

#### Phase 1 (MVP)
1. **Excel (.xlsx, .xls)** - 가장 많이 사용
2. **CSV (.csv)** - 범용성
3. **JSON (.json)** - API 연동

#### Phase 2
4. **Google Sheets** - 실시간 동기화
5. **SQL Dump (.sql)** - 기술 사용자
6. **vCard (.vcf)** - 명함 관리 앱

---

### 2.2 시스템 아키텍처

```typescript
interface BulkImportSystem {
  // 1. 파일 업로드
  upload: {
    endpoint: '/api/candidates/import'
    method: 'POST'
    contentType: 'multipart/form-data'
    maxFileSize: 10_000_000  // 10MB
    allowedTypes: ['.xlsx', '.xls', '.csv', '.json']
  }
  
  // 2. 파일 파싱
  parser: {
    excel: ExcelParser   // xlsx, xls
    csv: CSVParser       // csv
    json: JSONParser     // json
  }
  
  // 3. 컬럼 매핑
  mapping: {
    autoDetect: boolean       // 자동 인식 (이름, 이메일, 전화번호 등)
    manualMapping: ColumnMap  // 사용자가 직접 매핑
    preview: PreviewData      // 매핑 결과 미리보기
  }
  
  // 4. 데이터 검증
  validation: {
    required: ['name']        // 필수 필드
    optional: ['email', 'phone', 'company', ...]
    duplicateCheck: 'email' | 'phone' | 'both'
    dataType: Validation[]    // 이메일 형식, 전화번호 형식 등
  }
  
  // 5. 임포트 실행
  import: {
    mode: 'insert' | 'update' | 'upsert'
    batchSize: 100           // 100개씩 배치 처리
    onConflict: 'skip' | 'replace' | 'merge'
    progress: ProgressCallback
  }
  
  // 6. 결과 보고
  result: {
    total: number
    success: number
    failed: number
    skipped: number
    errors: ImportError[]
  }
}
```

---

### 2.3 컬럼 자동 인식 (AI)

```typescript
interface AutoColumnDetection {
  // Claude AI로 컬럼 자동 인식
  detectColumns: (headers: string[]) => ColumnMapping
  
  // 예시
  input: ['성명', '휴대폰', '이메일주소', '현재회사', '직급']
  
  output: {
    '성명': 'name',
    '휴대폰': 'phone',
    '이메일주소': 'email',
    '현재회사': 'current_company',
    '직급': 'current_position'
  }
  
  // 다양한 언어/형식 지원
  examples: {
    '이름' | 'Name' | '성명' | 'Full Name' → 'name'
    '전화번호' | 'Phone' | '휴대폰' | 'Mobile' | 'Tel' → 'phone'
    '이메일' | 'Email' | 'E-mail' | '메일주소' → 'email'
  }
}
```

---

### 2.4 API 설계

#### Step 1: 파일 업로드 및 파싱

```typescript
POST /api/candidates/import/upload

Request:
- Content-Type: multipart/form-data
- Body: file (Excel/CSV/JSON)

Response:
{
  "importId": "import-12345",
  "fileName": "candidates.xlsx",
  "fileSize": 2500000,
  "rowCount": 1523,
  "preview": {
    "headers": ["성명", "휴대폰", "이메일주소", ...],
    "rows": [
      ["홍길동", "010-1234-5678", "hong@example.com", ...],
      ["김철수", "010-2345-6789", "kim@example.com", ...],
      ...  // 처음 5행만
    ]
  },
  "detectedMapping": {
    "성명": "name",
    "휴대폰": "phone",
    "이메일주소": "email"
  }
}
```

#### Step 2: 컬럼 매핑 확인/수정

```typescript
POST /api/candidates/import/{importId}/mapping

Request:
{
  "mapping": {
    "성명": "name",           // 사용자가 확인/수정
    "휴대폰": "phone",
    "이메일주소": "email",
    "현재회사": "current_company",
    "직급": "current_position",
    "학력": "education",
    "경력": "experience_years",
    "기술스택": "skills"       // 콤마 구분 → 배열 변환
  },
  "options": {
    "skipEmptyRows": true,
    "trimWhitespace": true,
    "onDuplicate": "skip"     // skip | replace | merge
  }
}

Response:
{
  "validated": true,
  "warnings": [
    "100개 행에 이메일 누락",
    "50개 행에 전화번호 형식 오류"
  ],
  "preview": [
    {
      "rowNumber": 2,
      "data": {
        "name": "홍길동",
        "phone": "010-1234-5678",
        "email": "hong@example.com",
        "current_company": "삼성전자"
      },
      "status": "valid"
    },
    {
      "rowNumber": 3,
      "data": {
        "name": "김철수",
        "phone": "invalid",     // 형식 오류
        "email": null           // 누락
      },
      "status": "warning"
    }
  ]
}
```

#### Step 3: 임포트 실행

```typescript
POST /api/candidates/import/{importId}/execute

Request:
{
  "continueOnError": true,    // 에러 발생 시 계속 진행
  "notifyOnComplete": true    // 완료 시 알림
}

Response:
{
  "jobId": "job-67890",
  "status": "processing",
  "estimatedTime": 120        // 초
}
```

#### Step 4: 진행 상황 조회

```typescript
GET /api/candidates/import/jobs/{jobId}

Response:
{
  "jobId": "job-67890",
  "status": "processing",     // queued | processing | completed | failed
  "progress": {
    "total": 1523,
    "processed": 856,
    "success": 800,
    "failed": 56,
    "percentage": 56.2
  },
  "errors": [
    {
      "row": 15,
      "field": "email",
      "value": "invalid-email",
      "error": "Invalid email format"
    },
    ...
  ]
}
```

#### Step 5: 결과 확인

```typescript
GET /api/candidates/import/jobs/{jobId}/result

Response:
{
  "jobId": "job-67890",
  "status": "completed",
  "completedAt": "2026-06-08T15:30:00Z",
  "duration": 118,            // 초
  
  "summary": {
    "total": 1523,
    "success": 1450,
    "failed": 73,
    "skipped": 0
  },
  
  "details": {
    "inserted": 1200,         // 새로 추가
    "updated": 250,           // 기존 데이터 업데이트
    "duplicates": 73          // 중복으로 스킵
  },
  
  "errors": [
    {
      "row": 15,
      "data": { "name": "홍길동", "email": "invalid" },
      "error": "Invalid email format"
    },
    ...
  ],
  
  "downloadErrorReport": "/api/candidates/import/jobs/job-67890/errors.csv"
}
```

---

### 2.5 백엔드 구현 (디바)

```typescript
// app/api/candidates/import/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseFile } from '@/lib/import/parser'
import { detectColumns } from '@/lib/import/ai-detector'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    // 파일 크기 체크 (10MB)
    if (file.size > 10_000_000) {
      return NextResponse.json({ 
        error: 'File too large. Max 10MB allowed.' 
      }, { status: 413 })
    }
    
    // 파일 타입 체크
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/json'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only Excel, CSV, and JSON allowed.' 
      }, { status: 400 })
    }
    
    // 파일 파싱
    const parsed = await parseFile(file)
    
    // Import Session 생성
    const importId = uuidv4()
    const session = {
      id: importId,
      userId: req.headers.get('user-id'),
      fileName: file.name,
      fileSize: file.size,
      rowCount: parsed.rows.length,
      headers: parsed.headers,
      data: parsed.rows,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간
    }
    
    // Redis에 임시 저장 (24시간 TTL)
    await redis.setex(
      `import:${importId}`,
      86400,
      JSON.stringify(session)
    )
    
    // AI로 컬럼 자동 인식
    const detectedMapping = await detectColumns(parsed.headers)
    
    return NextResponse.json({
      importId,
      fileName: file.name,
      fileSize: file.size,
      rowCount: parsed.rows.length,
      preview: {
        headers: parsed.headers,
        rows: parsed.rows.slice(0, 5)  // 처음 5행만
      },
      detectedMapping
    })
    
  } catch (error) {
    console.error('[Import Upload Error]', error)
    return NextResponse.json({ 
      error: 'Failed to process file' 
    }, { status: 500 })
  }
}
```

```typescript
// lib/import/parser.ts
import XLSX from 'xlsx'
import Papa from 'papaparse'

interface ParsedData {
  headers: string[]
  rows: any[][]
}

export async function parseFile(file: File): Promise<ParsedData> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file)
  } else if (extension === 'csv') {
    return parseCSV(file)
  } else if (extension === 'json') {
    return parseJSON(file)
  }
  
  throw new Error('Unsupported file type')
}

async function parseExcel(file: File): Promise<ParsedData> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  
  return {
    headers: data[0] as string[],
    rows: data.slice(1)
  }
}

async function parseCSV(file: File): Promise<ParsedData> {
  const text = await file.text()
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      complete: (results) => {
        const data = results.data as any[][]
        resolve({
          headers: data[0] as string[],
          rows: data.slice(1)
        })
      },
      error: reject
    })
  })
}

async function parseJSON(file: File): Promise<ParsedData> {
  const text = await file.text()
  const data = JSON.parse(text)
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid JSON format. Expected array of objects.')
  }
  
  const headers = Object.keys(data[0])
  const rows = data.map(obj => headers.map(key => obj[key]))
  
  return { headers, rows }
}
```

```typescript
// lib/import/ai-detector.ts
import Anthropic from '@anthropic-ai/sdk'

export async function detectColumns(headers: string[]): Promise<Record<string, string>> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })
  
  const prompt = `
다음은 후보자 데이터베이스의 컬럼 헤더입니다. 각 컬럼을 적절한 필드로 매핑해주세요.

컬럼 헤더:
${headers.map((h, i) => `${i + 1}. ${h}`).join('\n')}

지원되는 필드:
- name: 이름
- email: 이메일
- phone: 전화번호
- current_company: 현재 회사
- current_position: 현재 직급/직무
- experience_years: 경력 (년수)
- education: 학력
- major: 전공
- skills: 기술/스킬
- location: 거주지
- desired_salary: 희망 연봉
- resume_url: 이력서 URL
- linkedin_url: 링크드인 URL
- note: 메모

JSON 형식으로만 응답해주세요. 매핑할 수 없는 컬럼은 null로 설정하세요.

예시:
{
  "성명": "name",
  "휴대폰": "phone",
  "메일": "email",
  "미사용컬럼": null
}
`
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: '당신은 데이터 매핑 전문가입니다. 컬럼 헤더를 분석하여 적절한 필드로 매핑합니다.',
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      { role: 'user', content: prompt }
    ]
  })
  
  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }
  
  // JSON 추출 (```json ... ``` 제거)
  const jsonText = content.text.replace(/```json\n?|\n?```/g, '').trim()
  const mapping = JSON.parse(jsonText)
  
  // null 값 제거
  return Object.fromEntries(
    Object.entries(mapping).filter(([_, value]) => value !== null)
  )
}
```

```typescript
// app/api/candidates/import/[importId]/execute/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateCandidate } from '@/lib/import/validator'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ importId: string }> }
) {
  try {
    const { importId } = await context.params
    const { continueOnError = true, notifyOnComplete = true } = await req.json()
    
    // Redis에서 Import Session 가져오기
    const sessionData = await redis.get(`import:${importId}`)
    if (!sessionData) {
      return NextResponse.json({ 
        error: 'Import session not found or expired' 
      }, { status: 404 })
    }
    
    const session = JSON.parse(sessionData)
    
    // 백그라운드 Job 생성
    const jobId = `job-${uuidv4()}`
    
    // Job 상태 초기화
    await redis.setex(
      `import:job:${jobId}`,
      86400,
      JSON.stringify({
        jobId,
        importId,
        status: 'queued',
        progress: { total: session.rowCount, processed: 0, success: 0, failed: 0 },
        errors: [],
        createdAt: new Date()
      })
    )
    
    // 비동기 처리 시작
    processImport(jobId, session, { continueOnError, notifyOnComplete })
      .catch(error => {
        console.error('[Import Job Error]', error)
      })
    
    return NextResponse.json({
      jobId,
      status: 'processing',
      estimatedTime: Math.ceil(session.rowCount / 10)  // 초당 10개 처리 가정
    })
    
  } catch (error) {
    console.error('[Import Execute Error]', error)
    return NextResponse.json({ 
      error: 'Failed to start import' 
    }, { status: 500 })
  }
}

async function processImport(
  jobId: string,
  session: any,
  options: { continueOnError: boolean; notifyOnComplete: boolean }
) {
  const batchSize = 100
  const totalRows = session.rowCount
  let processed = 0
  let success = 0
  let failed = 0
  const errors: any[] = []
  
  // 배치 처리
  for (let i = 0; i < session.data.length; i += batchSize) {
    const batch = session.data.slice(i, i + batchSize)
    
    for (const [index, row] of batch.entries()) {
      const rowNumber = i + index + 2  // +2: 헤더 제외 + 1-based
      
      try {
        // 매핑된 데이터 생성
        const candidate = mapRowToCandidate(row, session.mapping, session.headers)
        
        // 검증
        const validation = validateCandidate(candidate)
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '))
        }
        
        // DB 저장 (Upsert)
        const { error } = await supabaseAdmin
          .from('candidates')
          .upsert({
            ...candidate,
            created_by: session.userId,
            organization_id: session.organizationId,
            imported_at: new Date(),
            import_job_id: jobId
          }, {
            onConflict: 'email',  // 이메일 중복 시 업데이트
            ignoreDuplicates: false
          })
        
        if (error) throw error
        
        success++
        
      } catch (error: any) {
        failed++
        errors.push({
          row: rowNumber,
          data: row,
          error: error.message
        })
        
        if (!options.continueOnError) {
          break
        }
      }
      
      processed++
      
      // 진행 상황 업데이트 (10개마다)
      if (processed % 10 === 0) {
        await updateJobProgress(jobId, {
          processed,
          success,
          failed,
          percentage: (processed / totalRows) * 100
        })
      }
    }
    
    if (!options.continueOnError && failed > 0) {
      break
    }
  }
  
  // 완료 상태 업데이트
  await redis.setex(
    `import:job:${jobId}`,
    86400,
    JSON.stringify({
      jobId,
      importId: session.id,
      status: 'completed',
      completedAt: new Date(),
      summary: { total: totalRows, success, failed, skipped: 0 },
      errors
    })
  )
  
  // 알림
  if (options.notifyOnComplete) {
    await sendImportCompleteNotification(session.userId, {
      jobId,
      total: totalRows,
      success,
      failed
    })
  }
}

function mapRowToCandidate(
  row: any[],
  mapping: Record<string, string>,
  headers: string[]
): any {
  const candidate: any = {}
  
  headers.forEach((header, index) => {
    const field = mapping[header]
    if (field && row[index] !== undefined && row[index] !== null && row[index] !== '') {
      candidate[field] = row[index]
    }
  })
  
  return candidate
}
```

---

### 2.6 프론트엔드 구현 (디아)

```typescript
// app/candidates/import/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CandidateImportPage() {
  const router = useRouter()
  const [step, setStep] = useState<'upload' | 'mapping' | 'review' | 'processing' | 'result'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [importData, setImportData] = useState<any>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [jobId, setJobId] = useState<string>('')
  
  // Step 1: 파일 업로드
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    
    const formData = new FormData()
    formData.append('file', selectedFile)
    
    const res = await fetch('/api/candidates/import/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!res.ok) {
      const error = await res.json()
      alert(error.error)
      return
    }
    
    const data = await res.json()
    setImportData(data)
    setMapping(data.detectedMapping)
    setStep('mapping')
  }
  
  // Step 2: 컬럼 매핑 확인
  async function handleMappingConfirm() {
    const res = await fetch(`/api/candidates/import/${importData.importId}/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mapping,
        options: {
          skipEmptyRows: true,
          trimWhitespace: true,
          onDuplicate: 'skip'
        }
      })
    })
    
    const validated = await res.json()
    
    if (validated.warnings.length > 0) {
      const proceed = confirm(
        `다음 경고가 있습니다:\n${validated.warnings.join('\n')}\n\n계속하시겠습니까?`
      )
      if (!proceed) return
    }
    
    setStep('review')
  }
  
  // Step 3: 임포트 실행
  async function handleImportExecute() {
    setStep('processing')
    
    const res = await fetch(`/api/candidates/import/${importData.importId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        continueOnError: true,
        notifyOnComplete: true
      })
    })
    
    const job = await res.json()
    setJobId(job.jobId)
    
    // 진행 상황 폴링
    pollJobStatus(job.jobId)
  }
  
  // Step 4: 진행 상황 폴링
  async function pollJobStatus(jobId: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/candidates/import/jobs/${jobId}`)
      const job = await res.json()
      
      // UI 업데이트 (진행률 표시)
      console.log(job.progress)
      
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(interval)
        setStep('result')
        
        // 결과 페이지로 이동
        router.push(`/candidates/import/result/${jobId}`)
      }
    }, 2000)  // 2초마다 체크
  }
  
  return (
    <div className="import-wizard">
      {step === 'upload' && (
        <UploadStep onFileSelect={handleFileUpload} />
      )}
      
      {step === 'mapping' && (
        <MappingStep
          data={importData}
          mapping={mapping}
          onMappingChange={setMapping}
          onConfirm={handleMappingConfirm}
        />
      )}
      
      {step === 'review' && (
        <ReviewStep
          data={importData}
          mapping={mapping}
          onExecute={handleImportExecute}
          onBack={() => setStep('mapping')}
        />
      )}
      
      {step === 'processing' && (
        <ProcessingStep jobId={jobId} />
      )}
    </div>
  )
}
```

---

## 3. 법적 프레임워크

### 3.1 이용약관 (Terms of Service)

**필수 포함 사항**:

```markdown
# Jobizic 서비스 이용약관

## 제1조 (목적)
본 약관은 Jobizic("회사")이 제공하는 헤드헌팅 플랫폼 서비스의 이용과 관련하여
회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

## 제2조 (정의)
1. "서비스"란 회사가 제공하는 온라인 채용 관리 시스템을 의미합니다.
2. "이용자"란 본 약관에 동의하고 서비스를 이용하는 개인 또는 법인을 의미합니다.
3. "후보자 정보"란 이용자가 서비스에 업로드하는 구직자의 개인정보를 의미합니다.

## 제10조 (데이터 업로드 및 책임)

### 1. 데이터 소유권
이용자가 서비스에 업로드하는 모든 후보자 정보의 소유권 및 관리 책임은
이용자에게 있습니다.

### 2. 데이터 수집 동의 책임
이용자는 후보자 정보를 업로드하기 전에 반드시 해당 후보자로부터
개인정보 수집, 이용, 제3자 제공에 대한 적법한 동의를 받아야 합니다.

**이용자는 다음 사항을 보증합니다:**
a) 업로드하는 모든 후보자 정보에 대해 적법한 수집 근거가 있음
b) 후보자로부터 본 서비스 이용 목적의 개인정보 처리에 대한 동의를 받았음
c) 「개인정보 보호법」 등 관련 법령을 준수하였음

### 3. 회사의 면책
a) 회사는 이용자가 업로드한 후보자 정보의 적법성을 검증할 의무가 없습니다.
b) 이용자가 적법한 동의 없이 후보자 정보를 업로드하여 발생하는 모든 법적 
   책임은 이용자가 부담합니다.
c) 회사는 이용자의 위법한 정보 수집·업로드로 인해 발생한 손해에 대해 
   책임을 지지 않습니다.

### 4. 데이터 보안
회사는 업로드된 후보자 정보의 안전한 보관을 위해 다음 조치를 취합니다:
a) 암호화 전송 (TLS 1.3)
b) 암호화 저장 (AES-256)
c) 접근 제어 (역할 기반 권한)
d) 정기적 보안 점검

### 5. 데이터 삭제
이용자는 언제든지 업로드한 후보자 정보를 삭제할 수 있으며,
회사는 요청 즉시 해당 정보를 삭제합니다.

## 제11조 (이용자의 의무)

### 1. 금지 행위
이용자는 다음 행위를 하여서는 안 됩니다:
a) 타인의 개인정보를 무단으로 수집, 업로드하는 행위
b) 허위 또는 부정확한 정보를 업로드하는 행위
c) 관련 법령을 위반하는 행위

### 2. 위반 시 조치
회사는 이용자가 본 조항을 위반한 경우:
a) 서비스 이용 정지
b) 계정 삭제
c) 관계 당국에 신고
d) 손해배상 청구

## 제15조 (손해배상 및 면책)

### 1. 회사의 면책
회사는 다음의 경우 책임을 지지 않습니다:
a) 이용자의 귀책사유로 인한 서비스 이용 장애
b) 이용자가 업로드한 정보의 정확성, 적법성, 최신성
c) 이용자 간 또는 이용자와 제3자 간 분쟁
d) 천재지변, 전쟁, 해킹 등 불가항력으로 인한 서비스 중단

### 2. 손해배상 한도
회사가 손해배상 책임을 지는 경우, 그 한도는 이용자가 지불한
최근 3개월간의 서비스 이용료를 초과하지 않습니다.

## 제20조 (준거법 및 관할)
본 약관의 해석 및 이용자와 회사 간의 분쟁에 대하여는 대한민국 법을 적용하며,
분쟁 발생 시 서울중앙지방법원을 관할법원으로 합니다.

---

부칙
- 본 약관은 2026년 7월 1일부터 시행됩니다.
- 본 약관 시행 이전 가입한 이용자는 30일 이내에 본 약관에 동의해야 합니다.
```

---

### 3.2 개인정보처리방침 (Privacy Policy)

```markdown
# Jobizic 개인정보처리방침

**시행일자: 2026년 7월 1일**

Jobizic(이하 "회사")는 「개인정보 보호법」 제30조에 따라 정보주체의 
개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 
다음과 같이 개인정보처리방침을 수립·공개합니다.

## 1. 개인정보의 처리 목적

회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 
다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 
「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.

### 1.1 서비스 회원 정보
- 목적: 회원 가입, 회원제 서비스 제공, 본인 식별·인증
- 항목: 이름, 이메일, 전화번호, 회사명, 부서, 직급
- 보유기간: 회원 탈퇴 시까지

### 1.2 후보자 정보 (이용자가 업로드한 정보)
- 목적: 채용 관리, 후보자-포지션 매칭
- 항목: 이용자가 업로드한 모든 정보 (이름, 연락처, 경력, 학력 등)
- 보유기간: 이용자가 삭제 요청하거나 계약 종료 시까지

**중요: 후보자 정보의 수집 주체 및 책임**
- 후보자 정보는 **이용자(고객사)가 직접 수집하여 업로드**하는 정보입니다.
- 회사는 이용자가 업로드한 정보를 **저장 및 관리만** 제공합니다.
- 후보자 정보의 **수집 적법성, 동의 획득 책임은 전적으로 이용자**에게 있습니다.
- 회사는 이용자의 **재위탁 처리자(Processor)** 지위에 해당합니다.

## 2. 개인정보의 처리 및 보유기간

### 2.1 회원 정보
회원 탈퇴 시 즉시 파기합니다. 단, 다음의 경우 명시한 기간 동안 보존합니다:
- 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)
- 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)
- 소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)

### 2.2 후보자 정보
이용자가 삭제 요청 시 즉시 파기합니다. 계약 종료 시 30일 이내 파기합니다.

## 3. 개인정보의 제3자 제공

회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
다만, 다음의 경우는 예외로 합니다:

### 3.1 이용자의 동의가 있는 경우
### 3.2 법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우

## 4. 개인정보 처리의 위탁

회사는 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 위탁하고 있습니다:

| 수탁업체 | 위탁업무 내용 | 개인정보 보유·이용기간 |
|---------|-------------|---------------------|
| Amazon Web Services (AWS) | 클라우드 서버 호스팅 | 계약 종료 시까지 |
| Vercel Inc. | 웹 호스팅 및 배포 | 계약 종료 시까지 |
| Supabase Inc. | 데이터베이스 관리 | 계약 종료 시까지 |
| Anthropic PBC | AI 매칭 분석 | 즉시 파기 (캐싱 없음) |

**위탁업체의 개인정보 보호 조치:**
- 데이터 암호화 (전송: TLS 1.3, 저장: AES-256)
- ISO 27001, SOC 2 Type II 인증
- GDPR, CCPA 준수

## 5. 정보주체와 법정대리인의 권리·의무 및 그 행사방법

정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:

1. 개인정보 열람 요구
2. 오류 등이 있을 경우 정정 요구
3. 삭제 요구
4. 처리정지 요구

권리 행사는 「개인정보 보호법」 시행규칙 별지 제8호 서식에 따라 서면, 전자우편, 
모사전송(FAX) 등을 통하여 하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.

**연락처:**
- 이메일: privacy@jobizic.com
- 전화: 02-1234-5678

## 6. 개인정보의 파기

### 6.1 파기절차
이용자가 입력한 정보는 목적 달성 후 별도의 DB에 옮겨져(종이의 경우 별도의 서류) 
내부 방침 및 기타 관련 법령에 따라 일정기간 저장된 후 혹은 즉시 파기됩니다.

### 6.2 파기방법
- 전자적 파일 형태: 복구 불가능한 방법으로 영구 삭제
- 종이 문서: 분쇄기로 분쇄하거나 소각

### 6.3 후보자 정보 파기
이용자가 업로드한 후보자 정보는 다음의 경우 파기됩니다:
- 이용자가 삭제 요청 시: 즉시 파기
- 계약 종료 시: 30일 이내 파기
- 보유기간 경과 시: 즉시 파기

**파기 시 조치:**
- 데이터베이스 완전 삭제
- 백업 데이터에서도 삭제
- 암호화 키 폐기
- 파기 증명서 발급 (요청 시)

## 7. 개인정보의 안전성 확보 조치

회사는 「개인정보 보호법」 제29조에 따라 다음과 같이 안전성 확보에 
필요한 기술적·관리적·물리적 조치를 하고 있습니다.

### 7.1 기술적 조치
1. **암호화**
   - 전송 구간: TLS 1.3 (256-bit)
   - 저장: AES-256-GCM 암호화
   - 비밀번호: bcrypt (cost factor 12)
   
2. **해킹 등에 대비한 기술적 대책**
   - 방화벽 (WAF: Web Application Firewall)
   - 침입탐지시스템 (IDS/IPS)
   - DDoS 방어
   - 정기적 보안 패치

3. **접근 제어**
   - 역할 기반 접근 제어 (RBAC)
   - IP 화이트리스트
   - 2단계 인증 (2FA)
   - 접근 로그 기록 및 모니터링

### 7.2 관리적 조치
1. 개인정보 취급 직원의 최소화 및 교육
2. 정기적인 자체 감사 실시
3. 개인정보 처리방침 수립 및 시행

### 7.3 물리적 조치
1. 전산실, 자료보관실 등의 접근통제
2. CCTV 설치 및 24시간 모니터링 (AWS, Vercel 데이터센터)

## 8. 개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항

회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 
수시로 불러오는 '쿠키(cookie)'를 사용합니다.

### 8.1 쿠키의 사용 목적
- 자동 로그인
- 사용자 설정 저장 (언어, 테마 등)

### 8.2 쿠키 설치·운영 및 거부
- 웹브라우저 상단의 도구 > 인터넷 옵션 > 개인정보 메뉴에서 쿠키 수용 여부 설정 가능
- 쿠키 저장을 거부할 경우 맞춤형 서비스 이용에 어려움이 발생할 수 있습니다.

## 9. 개인정보 보호책임자

회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 
정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 
지정하고 있습니다.

**개인정보 보호책임자**
- 성명: 홍길동
- 직책: CTO
- 연락처: privacy@jobizic.com, 02-1234-5678

**개인정보 보호 담당부서**
- 부서명: 정보보호팀
- 담당자: 김철수
- 연락처: security@jobizic.com, 02-1234-5679

## 10. 개인정보 열람청구

정보주체는 「개인정보 보호법」 제35조에 따른 개인정보의 열람 청구를 
아래의 부서에 할 수 있습니다.

- 이메일: privacy@jobizic.com
- 전화: 02-1234-5678

## 11. 권익침해 구제방법

정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 
한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다.

- **개인정보분쟁조정위원회**: 1833-6972 (www.kopico.go.kr)
- **개인정보침해신고센터**: (국번없이) 118 (privacy.kisa.or.kr)
- **대검찰청**: (국번없이) 1301 (www.spo.go.kr)
- **경찰청**: (국번없이) 182 (ecrm.cyber.go.kr)

## 12. 개인정보 처리방침 변경

이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 
추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 
고지할 것입니다.

---

**공고일자**: 2026년 6월 8일  
**시행일자**: 2026년 7월 1일
```

---

### 3.3 후보자 데이터 처리 동의서 (템플릿)

**이용자가 후보자에게 받아야 하는 동의서 샘플**:

```markdown
# 개인정보 수집·이용·제3자 제공 동의서

[회사명]은(는) 귀하의 개인정보를 다음과 같이 수집·이용·제3자 제공하고자 합니다.
내용을 자세히 읽으신 후 동의 여부를 결정하여 주십시오.

## 1. 개인정보의 수집·이용 목적
- 채용 지원자 관리
- 포지션 매칭 및 추천
- 면접 일정 조율
- 채용 프로세스 진행

## 2. 수집하는 개인정보 항목
- 필수: 이름, 전화번호, 이메일주소
- 선택: 현재 회사, 직급, 경력, 학력, 기술 스택, 희망 연봉, 거주지

## 3. 개인정보의 보유 및 이용기간
- 채용 프로세스 종료 시까지
- 채용 미진행 시 수집일로부터 1년

## 4. 제3자 제공
귀하의 개인정보는 채용 관리 목적으로 다음 업체에 제공됩니다:

- 제공받는 자: Jobizic (채용 관리 플랫폼)
- 제공 목적: 채용 관리 시스템 제공
- 제공 항목: 위 2항의 모든 정보
- 보유 및 이용기간: 위 3항과 동일

## 5. 동의를 거부할 권리 및 동의 거부에 따른 불이익
귀하는 개인정보 수집·이용·제3자 제공에 대한 동의를 거부할 권리가 있습니다.
다만, 동의를 거부하실 경우 채용 지원 및 프로세스 진행이 불가능합니다.

---

위 내용을 충분히 숙지하였으며, 개인정보 수집·이용·제3자 제공에 동의합니다.

날짜: ______년 ___월 ___일

성명: _______________ (서명 또는 인)

---

※ 본 동의서는 [회사명]이 보관하며, 귀하는 언제든지 동의 철회를 요청하실 수 있습니다.
※ 동의 철회 시 연락처: [담당자 이메일/전화번호]
```

---

### 3.4 데이터 업로드 시 동의 체크

```typescript
// 앱 내 동의 프로세스
interface ImportConsent {
  // 업로드 전 필수 동의
  agreements: {
    termsOfService: boolean          // 이용약관
    privacyPolicy: boolean           // 개인정보처리방침
    dataCollectionConsent: boolean   // 후보자 동의 확보 확인
    liabilityAcknowledgement: boolean // 책임 인지
  }
  
  // 동의 텍스트
  declarations: {
    dataCollectionConsent: `
      본인은 업로드하는 모든 후보자 정보에 대해 해당 후보자로부터
      개인정보 수집·이용·제3자 제공에 대한 적법한 동의를 받았음을 확인합니다.
    `,
    
    liabilityAcknowledgement: `
      본인은 적법한 동의 없이 후보자 정보를 업로드하여 발생하는 모든 법적
      책임이 본인에게 있음을 인지하고 동의합니다. 
      Jobizic은 본인이 업로드한 정보의 적법성에 대해 책임을 지지 않습니다.
    `
  }
}
```

**UI 예시**:

```
┌─────────────────────────────────────────────────┐
│  후보자 정보 업로드                                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  ⚠️ 중요: 반드시 확인해주세요                        │
│                                                  │
│  후보자 정보를 업로드하기 전에 다음 사항을           │
│  확인하고 동의해주세요:                              │
│                                                  │
│  ☐ 이용약관에 동의합니다 [보기]                    │
│                                                  │
│  ☐ 개인정보처리방침에 동의합니다 [보기]            │
│                                                  │
│  ☐ 업로드하는 모든 후보자로부터 개인정보          │
│     수집·이용·제3자 제공에 대한 적법한 동의를      │
│     받았음을 확인합니다.                            │
│                                                  │
│  ☐ 적법한 동의 없이 정보를 업로드하여 발생하는    │
│     모든 법적 책임이 본인에게 있음을 인지하고      │
│     동의합니다.                                    │
│                                                  │
│  📄 후보자 동의서 샘플 다운로드                    │
│                                                  │
│  [파일 선택]                    [업로드]          │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 4. 정보보안 설계

### 4.1 보안 레이어

```
┌──────────────────────────────────────┐
│  사용자 브라우저                        │
└──────────────┬───────────────────────┘
               │ TLS 1.3 (암호화 전송)
┌──────────────▼───────────────────────┐
│  Vercel Edge Network                  │
│  - WAF (Web Application Firewall)    │
│  - DDoS Protection                    │
│  - Rate Limiting                      │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  Next.js API Routes                   │
│  - 인증/인가 (JWT)                     │
│  - 파일 타입/크기 검증                  │
│  - 악성 코드 스캔                       │
│  - 데이터 검증                          │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  Supabase (PostgreSQL)                │
│  - RLS (Row Level Security)           │
│  - 암호화 저장 (AES-256)               │
│  - 접근 로그                            │
│  - 정기 백업                            │
└───────────────────────────────────────┘
```

---

### 4.2 파일 업로드 보안

```typescript
// 악성 파일 차단
interface FileSecurityCheck {
  // 1. 파일 크기 제한
  maxSize: 10_000_000  // 10MB
  
  // 2. MIME 타입 검증
  allowedMimeTypes: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/json'
  ]
  
  // 3. 파일 확장자 검증
  allowedExtensions: ['.xlsx', '.xls', '.csv', '.json']
  
  // 4. Magic Number 검증 (실제 파일 타입 확인)
  validateMagicNumber: boolean
  
  // 5. 악성 코드 스캔 (ClamAV)
  antivirusScan: boolean
  
  // 6. 매크로 제거 (Excel)
  removeMacros: boolean
}

// 구현
async function securityCheckFile(file: File): Promise<SecurityCheckResult> {
  // 1. 크기 체크
  if (file.size > 10_000_000) {
    throw new Error('File too large')
  }
  
  // 2. MIME 타입 체크
  const allowedMimeTypes = [...]
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error('Invalid file type')
  }
  
  // 3. 확장자 체크
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!allowedExtensions.includes(`.${ext}`)) {
    throw new Error('Invalid file extension')
  }
  
  // 4. Magic Number 체크 (처음 몇 바이트로 실제 파일 타입 확인)
  const buffer = await file.arrayBuffer()
  const magicNumber = new Uint8Array(buffer.slice(0, 4))
  
  // Excel (.xlsx) magic number: 50 4B 03 04 (ZIP)
  // CSV는 magic number 없음 (텍스트)
  
  if (ext === 'xlsx' || ext === 'xls') {
    const isZip = 
      magicNumber[0] === 0x50 && 
      magicNumber[1] === 0x4B && 
      magicNumber[2] === 0x03 && 
      magicNumber[3] === 0x04
    
    if (!isZip) {
      throw new Error('File claims to be Excel but is not')
    }
  }
  
  // 5. 안티바이러스 스캔 (선택 - ClamAV API)
  if (process.env.ENABLE_ANTIVIRUS_SCAN === 'true') {
    const scanResult = await scanFileWithClamAV(buffer)
    if (scanResult.infected) {
      throw new Error('File contains malware')
    }
  }
  
  return { safe: true }
}
```

---

### 4.3 데이터 암호화

```typescript
// 민감 정보 필드 암호화
interface EncryptedCandidateData {
  // 평문 (검색 가능)
  name: string
  email: string
  
  // 암호화 (AES-256-GCM)
  phone_encrypted: string           // 전화번호
  address_encrypted: string         // 주소
  ssn_encrypted: string            // 주민등록번호 (선택)
  bank_account_encrypted: string   // 계좌번호 (선택)
  
  // 암호화 메타데이터
  encryption_key_id: string        // 어떤 키로 암호화했는지
  encryption_version: number       // 암호화 버전
}

// 암호화 함수
import crypto from 'crypto'

const algorithm = 'aes-256-gcm'
const keyId = 'key-2026-01'  // 키 로테이션 추적
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')  // 32 bytes

function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decryptField(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':')
  
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// DB 저장 시
const candidate = {
  name: '홍길동',
  email: 'hong@example.com',
  phone_encrypted: encryptField('010-1234-5678'),
  address_encrypted: encryptField('서울특별시 강남구...'),
  encryption_key_id: keyId,
  encryption_version: 1
}

// DB 조회 시
const decrypted = {
  ...candidate,
  phone: decryptField(candidate.phone_encrypted),
  address: decryptField(candidate.address_encrypted)
}
```

---

### 4.4 접근 제어 및 감사 로그

```typescript
// 후보자 정보 접근 시 감사 로그
interface AccessAuditLog {
  timestamp: Date
  userId: string
  userName: string
  userRole: string
  ipAddress: string
  
  action: 'view' | 'edit' | 'delete' | 'export' | 'import'
  resource: 'candidate'
  resourceId: string
  
  details: {
    candidateName: string
    fieldsAccessed: string[]        // ['name', 'phone', 'email']
    purpose?: string                // 접근 목적 (선택)
  }
  
  result: 'success' | 'denied'
  denyReason?: string
}

// 접근 시마다 로그 기록
async function logCandidateAccess(data: AccessAuditLog) {
  await supabaseAdmin
    .from('access_audit_logs')
    .insert(data)
}

// 사용 예시
app.get('/api/candidates/:id', async (req, res) => {
  const candidateId = req.params.id
  const user = req.user
  
  // 권한 체크
  const hasAccess = await checkAccess(user, candidateId)
  
  if (!hasAccess) {
    await logCandidateAccess({
      timestamp: new Date(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      ipAddress: req.ip,
      action: 'view',
      resource: 'candidate',
      resourceId: candidateId,
      details: { candidateName: '(접근 거부)', fieldsAccessed: [] },
      result: 'denied',
      denyReason: 'Insufficient permissions'
    })
    
    return res.status(403).json({ error: 'Access denied' })
  }
  
  // 후보자 조회
  const candidate = await getCandidate(candidateId)
  
  // 감사 로그
  await logCandidateAccess({
    timestamp: new Date(),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    ipAddress: req.ip,
    action: 'view',
    resource: 'candidate',
    resourceId: candidateId,
    details: {
      candidateName: candidate.name,
      fieldsAccessed: Object.keys(candidate)
    },
    result: 'success'
  })
  
  return res.json(candidate)
})
```

---

## 5. UI/UX 설계

### 5.1 Import Wizard (디아)

**Step 1: 파일 업로드**

```
┌──────────────────────────────────────────────────┐
│  후보자 일괄 업로드                                  │
├──────────────────────────────────────────────────┤
│                                                   │
│  📁 파일을 드래그하거나 클릭하여 선택하세요         │
│                                                   │
│  ┌────────────────────────────────────────────┐ │
│  │                                             │ │
│  │          📤                                 │ │
│  │                                             │ │
│  │   파일을 여기에 드롭하세요                    │ │
│  │   또는 클릭하여 선택                         │ │
│  │                                             │ │
│  │   지원 형식: Excel (.xlsx, .xls), CSV       │ │
│  │   최대 크기: 10MB                           │ │
│  │                                             │ │
│  └────────────────────────────────────────────┘ │
│                                                   │
│  💡 Tips:                                         │
│  - 첫 행은 헤더(컬럼명)로 사용됩니다               │
│  - 필수 정보: 이름                                │
│  - 권장 정보: 이메일, 전화번호                    │
│                                                   │
│  📄 [샘플 템플릿 다운로드]                         │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Step 2: 컬럼 매핑**

```
┌──────────────────────────────────────────────────┐
│  컬럼 매핑                                         │
├──────────────────────────────────────────────────┤
│                                                   │
│  파일의 컬럼을 시스템 필드로 매핑해주세요          │
│                                                   │
│  파일 컬럼          →    시스템 필드               │
│  ────────────────────────────────────────────    │
│  성명              →    [이름 ▼]        ✅        │
│  휴대폰            →    [전화번호 ▼]    ✅        │
│  이메일주소        →    [이메일 ▼]      ✅        │
│  현재회사          →    [현재 회사 ▼]   ✅        │
│  직급              →    [현재 직급 ▼]   ✅        │
│  경력(년)          →    [경력 년수 ▼]   ✅        │
│  학력              →    [학력 ▼]        ✅        │
│  전공              →    [전공 ▼]        ✅        │
│  기술스택          →    [스킬 ▼]        ✅        │
│  메모              →    [사용 안 함 ▼]  -         │
│                                                   │
│  📊 미리보기 (처음 3개 행):                        │
│  ┌──────────────────────────────────────────┐   │
│  │ 이름    │ 전화번호       │ 이메일        │   │
│  ├──────────────────────────────────────────┤   │
│  │ 홍길동  │ 010-1234-5678 │ hong@ex.com  │   │
│  │ 김철수  │ 010-2345-6789 │ kim@ex.com   │   │
│  │ 이영희  │ 010-3456-7890 │ lee@ex.com   │   │
│  └──────────────────────────────────────────┘   │
│                                                   │
│  [이전]                              [다음 →]     │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Step 3: 검증 및 확인**

```
┌──────────────────────────────────────────────────┐
│  업로드 확인                                       │
├──────────────────────────────────────────────────┤
│                                                   │
│  📊 요약                                           │
│  ─────────────────────────────────────────────   │
│  총 행 수:           1,523 개                     │
│  유효한 행:         1,450 개 ✅                   │
│  경고가 있는 행:       73 개 ⚠️                   │
│                                                   │
│  ⚠️ 경고 사항:                                    │
│  - 100개 행에 이메일 누락                         │
│  - 50개 행에 전화번호 형식 오류                   │
│  - 23개 행에 이름 누락 (업로드 불가)              │
│                                                   │
│  처리 옵션:                                        │
│  ○ 유효한 행만 업로드 (1,450개)                   │
│  ○ 경고 무시하고 모두 업로드 (1,523개)            │
│  ○ 취소하고 파일 수정                             │
│                                                   │
│  중복 처리:                                        │
│  ● 중복 건너뛰기                                  │
│  ○ 중복 덮어쓰기                                  │
│  ○ 중복 병합                                      │
│                                                   │
│  📄 [에러 보고서 다운로드]                         │
│                                                   │
│  [이전]                          [업로드 시작]     │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Step 4: 진행 중**

```
┌──────────────────────────────────────────────────┐
│  업로드 진행 중...                                 │
├──────────────────────────────────────────────────┤
│                                                   │
│  ████████████████░░░░░░░░░░  65% (994/1,523)     │
│                                                   │
│  ✅ 성공: 850 개                                  │
│  ⏳ 진행 중: 144 개                               │
│  ❌ 실패: 56 개                                   │
│                                                   │
│  예상 완료 시간: 약 42초 남음                      │
│                                                   │
│  💡 이 페이지를 닫아도 백그라운드에서 계속          │
│     처리됩니다. 완료 시 알림을 보내드립니다.       │
│                                                   │
│  [백그라운드로 계속]              [취소]           │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Step 5: 완료**

```
┌──────────────────────────────────────────────────┐
│  업로드 완료! 🎉                                  │
├──────────────────────────────────────────────────┤
│                                                   │
│  📊 결과                                           │
│  ─────────────────────────────────────────────   │
│  총 처리:           1,523 개                      │
│  ✅ 성공:          1,450 개                       │
│  ❌ 실패:             73 개                       │
│                                                   │
│  상세:                                             │
│  - 새로 추가: 1,200 개                            │
│  - 업데이트: 250 개                               │
│  - 중복 스킵: 73 개                               │
│                                                   │
│  소요 시간: 2분 18초                              │
│                                                   │
│  📄 [상세 보고서 다운로드]                         │
│  📄 [실패한 항목 다운로드] (73개)                 │
│                                                   │
│  [후보자 목록 보기]              [다시 업로드]     │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## 6. 리스크 관리

### 6.1 법적 리스크 (테스)

| 리스크 | 가능성 | 영향도 | 대응 방안 |
|-------|-------|-------|----------|
| 이용자의 무단 개인정보 수집 | 높음 | 매우 높음 | - 명확한 이용약관<br>- 업로드 시 동의 필수<br>- 책임 한계 명시<br>- 보험 가입 |
| 후보자의 정보 삭제 요청 | 중간 | 중간 | - 즉시 삭제 기능<br>- 삭제 증명서 발급<br>- 백업에서도 삭제 |
| GDPR/PIPA 위반 | 중간 | 높음 | - 법률 자문<br>- 컴플라이언스 체크리스트<br>- DPO 지정 |
| 데이터 유출 | 낮음 | 매우 높음 | - 암호화<br>- 접근 제어<br>- 침입 탐지<br>- 보험 가입 |

---

### 6.2 기술적 리스크

| 리스크 | 가능성 | 영향도 | 대응 방안 |
|-------|-------|-------|----------|
| 악성 파일 업로드 | 중간 | 높음 | - 파일 타입 검증<br>- Magic Number 체크<br>- 안티바이러스 스캔 |
| 대용량 파일로 인한 서버 부하 | 중간 | 중간 | - 파일 크기 제한 (10MB)<br>- Rate Limiting<br>- 배치 처리 |
| 잘못된 데이터 매핑 | 높음 | 낮음 | - AI 자동 인식<br>- 미리보기 제공<br>- 수동 확인 필수 |
| 중복 데이터 문제 | 높음 | 낮음 | - 중복 검출 로직<br>- 사용자 선택 (스킵/덮어쓰기/병합) |

---

### 6.3 비즈니스 리스크

| 리스크 | 가능성 | 영향도 | 대응 방안 |
|-------|-------|-------|----------|
| 이용자의 클레임 | 중간 | 높음 | - 명확한 책임 한계<br>- 보험 가입<br>- 법률 자문 |
| 평판 손상 | 낮음 | 매우 높음 | - 투명한 정보 공개<br>- 신속한 대응<br>- 위기 관리 매뉴얼 |

---

## 7. 구현 로드맵

### Phase 1: MVP (4주)

**Week 1-2: 백엔드 기반**
- ✅ 파일 업로드 API
- ✅ Excel/CSV 파서
- ✅ 기본 컬럼 매핑 (수동)
- ✅ 배치 삽입 로직

**Week 3-4: 프론트엔드 & 법적**
- ✅ Import Wizard UI
- ✅ 이용약관 작성 (법률 자문)
- ✅ 개인정보처리방침 작성
- ✅ 동의 체크 프로세스

---

### Phase 2: Enhancement (3주)

**Week 5-6: AI & UX**
- ✅ AI 컬럼 자동 인식 (Claude)
- ✅ 진행 상황 실시간 업데이트
- ✅ 에러 보고서 다운로드

**Week 7: 보안 강화**
- ✅ 필드 암호화 (전화번호, 주소)
- ✅ 악성 파일 검사
- ✅ 접근 감사 로그

---

### Phase 3: Enterprise (2주)

**Week 8-9: 고급 기능**
- ✅ Google Sheets 연동
- ✅ 스케줄 자동 임포트 (매일/매주)
- ✅ Webhook 알림

---

## 8. 예상 비용

### 개발 비용
- **개발 공수**: 9주
- **개발자**: 디바(Backend) + 디아(Frontend)
- **법률 자문**: 외부 변호사 ($5,000)
- **총 인건비**: 2명 × 2.25개월 × $8,000 = $36,000
- **법률 비용**: $5,000
- **합계**: **$41,000**

### 운영 비용 (월)
- **ClamAV (안티바이러스)**: $50/월
- **데이터 암호화 KMS**: $20/월 (AWS KMS)
- **추가 스토리지**: $100/월 (대용량 업로드)
- **합계**: **$170/월**

---

## 9. 테스의 검증 계획

### 기능 테스트
- [ ] Excel (.xlsx, .xls) 업로드
- [ ] CSV 업로드
- [ ] JSON 업로드
- [ ] 대용량 파일 (10MB)
- [ ] 다양한 컬럼 형식
- [ ] 중복 데이터 처리
- [ ] 에러 처리

### 보안 테스트
- [ ] 악성 파일 업로드 시도
- [ ] SQL Injection 시도
- [ ] XSS 시도
- [ ] 권한 우회 시도
- [ ] 암호화 검증

### 법적 컴플라이언스
- [ ] 이용약관 법률 검토
- [ ] 개인정보처리방침 법률 검토
- [ ] GDPR 체크리스트
- [ ] PIPA (한국 개인정보보호법) 체크리스트

---

## 10. 결론 및 제안

### 10.1 디바의 제안

**우선순위: VERY HIGH**

이 기능은 엔터프라이즈 고객 확보에 **필수**입니다. 
경쟁사(Greenhouse, Lever 등) 모두 제공하는 기본 기능이므로, 
없으면 시장 경쟁력이 크게 떨어집니다.

**단, 법적 리스크가 크므로 반드시**:
1. 전문 변호사의 법률 자문 필수
2. 명확한 이용약관 및 개인정보처리방침
3. 업로드 시 동의 체크 의무화
4. 책임 한계 명시
5. 사이버 보험 가입 권장

---

### 10.2 테스의 의견

**보안 및 법적 검증 필수**

기능 자체는 훌륭하지만, 개인정보 대량 처리라는 특성상
**보안 사고 하나로 회사가 위험**해질 수 있습니다.

**반드시 선행되어야 할 것**:
1. ✅ 법률 자문 (이용약관, 개인정보처리방침)
2. ✅ 침투 테스트 (Penetration Testing)
3. ✅ 보험 가입 (사이버 보험, E&O 보험)
4. ✅ 사고 대응 매뉴얼
5. ✅ DPO (Data Protection Officer) 지정

**테스트 완료 전에는 프로덕션 배포 불가.**

---

### 10.3 최종 제안

**Phase 1 (MVP)을 먼저 구현하되**:
1. 법률 자문 완료 후 착수
2. 철저한 보안 테스트
3. 베타 테스트 (소수 고객)
4. 피드백 반영 후 정식 출시

**예상 일정**:
- 법률 자문: 2주
- Phase 1 개발: 4주
- 테스트 & 보안 감사: 2주
- 베타 테스트: 2주
- **총 10주 (2.5개월)**

---

**작성**: 2026년 06월 08일  
**보고**: 디바 (Backend 총괄), 디아 (Frontend), 테스 (QA/보안)  
**검토**: 대기 중  
**다음 단계**: 승인 후 법률 자문 착수
