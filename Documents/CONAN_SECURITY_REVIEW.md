# 후보자 DB 일괄 업로드 - 코난의 보안 검토 보고서

**일시**: 2026-06-08  
**참석자**: 디바 (Backend), 디아 (Frontend), 테스 (QA), **코난 (Security)**  
**안건**: 후보자 DB 일괄 업로드 기능의 보안 위험 평가 및 강화 방안

---

## 🔐 Executive Summary

디바, 디아, 테스의 설계 문서를 검토한 결과, **전반적으로 잘 설계되었으나**  
**추가 보안 강화가 필수**입니다.

**보안 등급**: ⚠️ **Medium-High Risk**

**주요 우려사항**:
1. 개인정보 대량 처리 → 표적 공격 가능성
2. 파일 업로드 → 악성 코드 유입 위험
3. 법적 책임 → 데이터 유출 시 막대한 손해배상
4. 암호화 키 관리 → 키 유출 시 모든 데이터 노출

**권장 사항**: **Phase 1 개발 전 보안 강화 필수**

---

## 📋 목차

1. [보안 위험 평가](#1-보안-위험-평가)
2. [필수 보안 강화 사항](#2-필수-보안-강화-사항)
3. [권장 보안 강화 사항](#3-권장-보안-강화-사항)
4. [컴플라이언스 체크리스트](#4-컴플라이언스-체크리스트)
5. [침투 테스트 시나리오](#5-침투-테스트-시나리오)
6. [사고 대응 계획](#6-사고-대응-계획)
7. [보안 로드맵](#7-보안-로드맵)

---

## 1. 보안 위험 평가

### 1.1 위협 모델링 (STRIDE)

| 위협 유형 | 시나리오 | 가능성 | 영향도 | 위험도 |
|----------|---------|-------|-------|-------|
| **Spoofing (위장)** | 공격자가 다른 사용자로 위장하여 파일 업로드 | 중간 | 높음 | **HIGH** |
| **Tampering (변조)** | 업로드 중 데이터 가로채기 및 변조 | 낮음 | 높음 | MEDIUM |
| **Repudiation (부인)** | 이용자가 업로드 사실 부인 | 중간 | 중간 | MEDIUM |
| **Information Disclosure (정보 노출)** | DB 침해로 후보자 정보 유출 | 낮음 | **매우 높음** | **CRITICAL** |
| **Denial of Service (서비스 거부)** | 대용량 파일로 서버 다운 | 높음 | 중간 | **HIGH** |
| **Elevation of Privilege (권한 상승)** | Searcher가 Admin 권한으로 모든 데이터 접근 | 중간 | 높음 | **HIGH** |

---

### 1.2 공격 벡터 분석

#### Attack Vector 1: 악성 파일 업로드

```
공격자 → [악성 Excel 파일] → 서버
                ↓
       매크로 실행 / 버퍼 오버플로우
                ↓
          서버 장악 / RCE
```

**현재 방어**:
- ✅ 파일 타입 검증
- ✅ Magic Number 체크
- ⚠️ 안티바이러스 스캔 (선택사항)

**코난의 평가**: ⚠️ **불충분**
- 안티바이러스 스캔 **필수**로 변경
- Excel 매크로 **강제 제거** 추가
- 파일 파싱 **샌드박스** 환경에서 수행

---

#### Attack Vector 2: SQL Injection via CSV

```
CSV 파일:
name,email,phone
Robert'); DROP TABLE candidates;--,test@test.com,010-1234-5678
```

**현재 방어**:
- ✅ Supabase Parameterized Queries
- ✅ 데이터 검증

**코난의 평가**: ✅ **양호**
- Supabase는 자동으로 SQL Injection 방지
- 추가 조치 불필요

---

#### Attack Vector 3: CSV Injection (Formula Injection)

```
CSV 파일:
name,email,note
=cmd|'/c calc'!A1,test@test.com,normal note
```

**Excel에서 열면**:
- `=cmd|'/c calc'!A1` → 계산기 실행 (RCE!)

**현재 방어**:
- ❌ 없음!

**코난의 평가**: 🔴 **CRITICAL**
- CSV Injection 방어 **필수**
- `=`, `+`, `-`, `@` 로 시작하는 셀 앞에 `'` (single quote) 추가

**수정 필요**:
```typescript
function sanitizeCSVField(value: string): string {
  // CSV Injection 방어
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`  // 앞에 ' 추가
  }
  return value
}
```

---

#### Attack Vector 4: XXE (XML External Entity) Attack

**Excel (.xlsx)은 내부적으로 XML**:

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>
```

**현재 방어**:
- ⚠️ XLSX 라이브러리 의존

**코난의 평가**: ⚠️ **주의 필요**
- `xlsx` 라이브러리 최신 버전 사용
- XXE 방어 옵션 활성화:
```typescript
XLSX.read(buffer, { 
  type: 'array',
  WTF: false,  // XXE 방지
  cellDates: true
})
```

---

#### Attack Vector 5: Path Traversal

```
파일명: ../../../etc/passwd.csv
```

**현재 방어**:
- ⚠️ 파일명 검증 없음

**코난의 평가**: ⚠️ **보완 필요**
- 파일명에서 경로 문자 제거:
```typescript
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[\/\\]/g, '')  // 경로 구분자 제거
    .replace(/\.\./g, '')    // .. 제거
    .substring(0, 255)       // 최대 길이
}
```

---

#### Attack Vector 6: 암호화 키 유출

**시나리오**:
- `.env` 파일 GitHub에 커밋
- 서버 침해로 `ENCRYPTION_KEY` 탈취
- → 모든 후보자 개인정보 복호화 가능!

**현재 방어**:
- ⚠️ 환경변수에 저장

**코난의 평가**: 🔴 **CRITICAL**
- 환경변수는 **불충분**
- **AWS KMS** 또는 **HashiCorp Vault** 사용 필수

**권장 아키텍처**:
```typescript
// AWS KMS 사용
import { KMS } from '@aws-sdk/client-kms'

const kms = new KMS({ region: 'ap-northeast-2' })

// 데이터 암호화
async function encryptField(plaintext: string): Promise<string> {
  const { CiphertextBlob } = await kms.encrypt({
    KeyId: process.env.KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext, 'utf8')
  })
  
  return CiphertextBlob!.toString('base64')
}

// 데이터 복호화
async function decryptField(ciphertext: string): Promise<string> {
  const { Plaintext } = await kms.decrypt({
    CiphertextBlob: Buffer.from(ciphertext, 'base64')
  })
  
  return Plaintext!.toString('utf8')
}
```

**장점**:
- 키가 AWS KMS에만 저장 (코드/서버에 없음)
- 키 로테이션 자동화
- 접근 로그 자동 기록
- 키 유출 시 즉시 폐기 가능

**비용**: ~$1/월 (키 1개) + $0.03/10,000 요청

---

#### Attack Vector 7: 대량 파일 업로드로 DoS

```
공격자 → [10MB 파일 × 1000개] → 서버
           ↓
      메모리 부족 / CPU 100%
           ↓
       서비스 다운
```

**현재 방어**:
- ✅ 파일 크기 제한 (10MB)
- ⚠️ Rate Limiting 없음

**코난의 평가**: ⚠️ **보완 필요**
- **Rate Limiting 필수**:
```typescript
// Upstash Rate Limit
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(
    5,     // 최대 5회
    '1 h'  // 1시간당
  )
})

// 사용자당 1시간에 5번만 업로드 가능
const { success } = await ratelimit.limit(`import:${userId}`)
if (!success) {
  return res.status(429).json({ error: 'Too many uploads. Try again later.' })
}
```

---

#### Attack Vector 8: IDOR (Insecure Direct Object Reference)

```
GET /api/candidates/import/jobs/job-12345

공격자가 다른 사람의 jobId로 접근:
GET /api/candidates/import/jobs/job-99999
→ 타인의 업로드 내역 및 데이터 노출!
```

**현재 방어**:
- ❌ jobId 권한 체크 없음

**코난의 평가**: 🔴 **CRITICAL**
- **권한 체크 필수**:
```typescript
export async function GET(req: NextRequest, context: { params: { jobId: string } }) {
  const { jobId } = context.params
  const userId = req.headers.get('user-id')
  
  // Job 소유자 확인
  const job = await redis.get(`import:job:${jobId}`)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  
  const jobData = JSON.parse(job)
  
  // 권한 체크: 본인의 Job인지 확인
  if (jobData.userId !== userId) {
    return NextResponse.json({ 
      error: 'Access denied. You can only view your own jobs.' 
    }, { status: 403 })
  }
  
  return NextResponse.json(jobData)
}
```

---

## 2. 필수 보안 강화 사항

### 2.1 파일 업로드 보안 (CRITICAL)

#### 강화 1: CSV Injection 방어

```typescript
function sanitizeForCSV(value: any): string {
  if (value === null || value === undefined) return ''
  
  const str = String(value)
  
  // CSV Injection 방어: =, +, -, @ 로 시작하면 ' 추가
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`
  }
  
  // 줄바꿈, 탭 제거
  return str.replace(/[\r\n\t]/g, ' ')
}
```

**적용 위치**: 
- 파일 파싱 후 DB 저장 전
- 에러 보고서 CSV 다운로드 시

---

#### 강화 2: 안티바이러스 스캔 필수화

```typescript
// ClamAV 통합 (Docker)
import { NodeClamAV } from 'clamscan'

const clamscan = await new NodeClamAV().init({
  clamdscan: {
    host: process.env.CLAMAV_HOST || 'localhost',
    port: parseInt(process.env.CLAMAV_PORT || '3310')
  }
})

async function scanFile(filePath: string): Promise<boolean> {
  const { isInfected, viruses } = await clamscan.isInfected(filePath)
  
  if (isInfected) {
    console.error('[SECURITY] Malware detected:', viruses)
    // 즉시 파일 삭제
    await fs.unlink(filePath)
    // 관리자에게 알림
    await notifyAdmin({ type: 'malware_detected', viruses, filePath })
    return false
  }
  
  return true
}
```

**Docker Compose**:
```yaml
services:
  clamav:
    image: clamav/clamav:latest
    ports:
      - "3310:3310"
    volumes:
      - clamav-db:/var/lib/clamav
```

---

#### 강화 3: Excel 매크로 강제 제거

```typescript
import AdmZip from 'adm-zip'

async function removeMacrosFromExcel(buffer: Buffer): Promise<Buffer> {
  const zip = new AdmZip(buffer)
  const zipEntries = zip.getEntries()
  
  // 매크로 관련 파일 제거
  const macroFiles = [
    'xl/vbaProject.bin',        // VBA 프로젝트
    'xl/worksheets/_rels/*',     // 외부 링크
    'xl/externalLinks/*'         // 외부 링크
  ]
  
  zipEntries.forEach(entry => {
    for (const pattern of macroFiles) {
      if (entry.entryName.includes(pattern)) {
        zip.deleteFile(entry.entryName)
        console.log('[SECURITY] Removed macro file:', entry.entryName)
      }
    }
  })
  
  return zip.toBuffer()
}

// 파일 파싱 전 적용
const cleanBuffer = await removeMacrosFromExcel(originalBuffer)
const workbook = XLSX.read(cleanBuffer, { type: 'array' })
```

---

### 2.2 암호화 키 관리 (CRITICAL)

#### AWS KMS 통합

```typescript
// lib/encryption/kms.ts
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms'

const kmsClient = new KMSClient({ region: 'ap-northeast-2' })
const keyId = process.env.AWS_KMS_KEY_ID!

export async function encryptWithKMS(plaintext: string): Promise<string> {
  const command = new EncryptCommand({
    KeyId: keyId,
    Plaintext: Buffer.from(plaintext, 'utf8')
  })
  
  const { CiphertextBlob } = await kmsClient.send(command)
  return Buffer.from(CiphertextBlob!).toString('base64')
}

export async function decryptWithKMS(ciphertext: string): Promise<string> {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64')
  })
  
  const { Plaintext } = await kmsClient.send(command)
  return Buffer.from(Plaintext!).toString('utf8')
}
```

**Migration Plan**:
```typescript
// 기존 데이터 마이그레이션
async function migrateToKMS() {
  const candidates = await supabaseAdmin
    .from('candidates')
    .select('id, phone_encrypted, address_encrypted')
    .not('phone_encrypted', 'is', null)
  
  for (const candidate of candidates.data) {
    // 기존 암호화 복호화
    const phone = decryptField(candidate.phone_encrypted)
    const address = decryptField(candidate.address_encrypted)
    
    // KMS로 재암호화
    const phoneKMS = await encryptWithKMS(phone)
    const addressKMS = await encryptWithKMS(address)
    
    // DB 업데이트
    await supabaseAdmin
      .from('candidates')
      .update({
        phone_encrypted: phoneKMS,
        address_encrypted: addressKMS,
        encryption_method: 'kms'
      })
      .eq('id', candidate.id)
  }
}
```

---

### 2.3 접근 제어 강화 (HIGH)

#### RBAC + ABAC 하이브리드

```typescript
// lib/access-control/rbac.ts
interface AccessPolicy {
  resource: 'candidate' | 'jd' | 'pipeline' | 'import_job'
  action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import'
  roles: string[]
  conditions?: (context: AccessContext) => boolean
}

const policies: AccessPolicy[] = [
  // Import Job 접근
  {
    resource: 'import_job',
    action: 'read',
    roles: ['admin', 'owner', 'headhunter', 'searcher'],
    conditions: (ctx) => ctx.resourceOwnerId === ctx.userId  // 본인의 Job만
  },
  
  // 후보자 정보 Export
  {
    resource: 'candidate',
    action: 'export',
    roles: ['admin', 'owner'],
    conditions: (ctx) => {
      // 조직의 후보자만 Export 가능
      return ctx.candidate.organization_id === ctx.user.organization_id
    }
  }
]

async function checkAccess(
  userId: string,
  resource: string,
  action: string,
  resourceData?: any
): Promise<boolean> {
  const user = await getUser(userId)
  
  const applicablePolicies = policies.filter(p => 
    p.resource === resource && 
    p.action === action &&
    p.roles.includes(user.role)
  )
  
  if (applicablePolicies.length === 0) return false
  
  for (const policy of applicablePolicies) {
    if (policy.conditions) {
      const context: AccessContext = {
        userId,
        user,
        resourceOwnerId: resourceData?.created_by || resourceData?.userId,
        ...resourceData
      }
      
      if (!policy.conditions(context)) continue
    }
    
    // 하나라도 통과하면 허용
    return true
  }
  
  return false
}
```

---

### 2.4 감사 로그 강화 (HIGH)

#### 상세 로깅

```typescript
interface DetailedAuditLog {
  // 기본 정보
  id: string
  timestamp: Date
  
  // 사용자 정보
  userId: string
  userName: string
  userRole: string
  userEmail: string
  organizationId: string
  
  // 네트워크 정보
  ipAddress: string
  userAgent: string
  requestId: string
  
  // 행위 정보
  action: string
  resource: string
  resourceId: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  endpoint: string
  
  // 변경 내역 (PATCH/DELETE 시)
  changes?: {
    field: string
    oldValue: any
    newValue: any
  }[]
  
  // 결과
  statusCode: number
  success: boolean
  errorMessage?: string
  
  // 민감 정보 접근 (후보자 조회 시)
  sensitiveDataAccessed?: {
    candidateId: string
    candidateName: string
    fieldsAccessed: string[]
    purpose?: string  // 접근 목적 (선택)
  }
  
  // Import 관련 (파일 업로드 시)
  importDetails?: {
    fileName: string
    fileSize: number
    rowCount: number
    successCount?: number
    failedCount?: number
  }
}

// Middleware로 자동 로깅
export function auditLogMiddleware(req: NextRequest, res: NextResponse) {
  const startTime = Date.now()
  
  res.on('finish', async () => {
    const duration = Date.now() - startTime
    
    await createAuditLog({
      timestamp: new Date(),
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      userEmail: req.user?.email,
      organizationId: req.user?.organization_id,
      
      ipAddress: req.ip || req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
      requestId: req.headers.get('x-request-id'),
      
      action: req.method,
      endpoint: req.url,
      method: req.method as any,
      
      statusCode: res.status,
      success: res.status < 400,
      
      duration
    })
  })
  
  return res
}
```

---

## 3. 권장 보안 강화 사항

### 3.1 파일 샌드박스 (RECOMMENDED)

**문제**: 파일 파싱 중 취약점 악용 가능

**해결**: Docker 샌드박스에서 파일 파싱

```typescript
// lib/sandbox/file-parser.ts
import Docker from 'dockerode'

const docker = new Docker()

async function parseFileInSandbox(file: File): Promise<ParsedData> {
  // 1. 임시 디렉토리 생성
  const tmpDir = `/tmp/import-${uuidv4()}`
  await fs.mkdir(tmpDir)
  
  // 2. 파일 저장
  const filePath = `${tmpDir}/${file.name}`
  await fs.writeFile(filePath, await file.arrayBuffer())
  
  // 3. Docker 컨테이너에서 파싱
  const container = await docker.createContainer({
    Image: 'file-parser:latest',
    Cmd: ['parse', file.name],
    HostConfig: {
      Binds: [`${tmpDir}:/data:ro`],  // 읽기 전용 마운트
      Memory: 512 * 1024 * 1024,       // 메모리 제한 512MB
      CpuShares: 512,                   // CPU 제한
      NetworkMode: 'none'               // 네트워크 차단
    },
    Tty: false
  })
  
  await container.start()
  
  // 4. 결과 대기 (타임아웃 30초)
  const output = await container.wait({ condition: 'not-running' })
  
  if (output.StatusCode !== 0) {
    throw new Error('File parsing failed in sandbox')
  }
  
  // 5. 결과 읽기
  const resultPath = `${tmpDir}/result.json`
  const result = JSON.parse(await fs.readFile(resultPath, 'utf8'))
  
  // 6. 정리
  await container.remove()
  await fs.rm(tmpDir, { recursive: true })
  
  return result
}
```

---

### 3.2 Content Security Policy (CSP)

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.vercel-insights.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' data:;
      connect-src 'self' https://*.supabase.co https://*.anthropic.com;
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s{2,}/g, ' ').trim()
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
]

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ]
  }
}
```

---

### 3.3 보안 이벤트 모니터링 (SIEM)

```typescript
// lib/security/siem.ts
import { Client } from '@elastic/elasticsearch'

const esClient = new Client({ node: process.env.ELASTICSEARCH_URL })

interface SecurityEvent {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'authentication' | 'authorization' | 'data_access' | 'malware' | 'dos'
  event: string
  details: any
}

async function logSecurityEvent(event: SecurityEvent) {
  await esClient.index({
    index: 'security-events',
    document: {
      ...event,
      timestamp: new Date(),
      environment: process.env.NODE_ENV
    }
  })
  
  // Critical 이벤트는 즉시 알림
  if (event.severity === 'critical') {
    await notifySecurityTeam(event)
  }
}

// 사용 예시
// 악성 파일 탐지 시
await logSecurityEvent({
  severity: 'critical',
  category: 'malware',
  event: 'malware_detected_in_upload',
  details: {
    userId,
    fileName,
    viruses,
    ipAddress
  }
})

// 비정상적인 대량 접근 시
await logSecurityEvent({
  severity: 'high',
  category: 'data_access',
  event: 'excessive_candidate_access',
  details: {
    userId,
    accessCount: 1000,
    timeWindow: '1 hour'
  }
})
```

---

## 4. 컴플라이언스 체크리스트

### 4.1 GDPR (EU 일반 데이터 보호 규정)

- [ ] **Article 5 - 처리 원칙**
  - [ ] 적법성, 공정성, 투명성
  - [ ] 목적 제한
  - [ ] 데이터 최소화
  - [ ] 정확성
  - [ ] 저장 기간 제한
  - [ ] 무결성 및 기밀성

- [ ] **Article 25 - 설계 및 기본 설정에 의한 데이터 보호**
  - [ ] Privacy by Design
  - [ ] Privacy by Default

- [ ] **Article 30 - 처리 활동 기록**
  - [ ] 처리 목적 문서화
  - [ ] 데이터 범주 문서화
  - [ ] 수신자 문서화
  - [ ] 보안 조치 문서화

- [ ] **Article 32 - 처리 보안**
  - [ ] 가명화 및 암호화
  - [ ] 지속적인 기밀성 보장
  - [ ] 가용성 및 복원력 보장
  - [ ] 정기적인 테스트 및 평가

- [ ] **Article 33 - 개인정보 침해 통지**
  - [ ] 72시간 이내 감독 기관에 통지
  - [ ] 침해 사실, 영향, 조치 기록

- [ ] **Article 35 - 데이터 보호 영향 평가 (DPIA)**
  - [ ] 고위험 처리에 대한 DPIA 수행
  - [ ] 처리 설명
  - [ ] 필요성 및 비례성 평가
  - [ ] 위험 평가
  - [ ] 완화 조치

---

### 4.2 PIPA (한국 개인정보 보호법)

- [ ] **제15조 - 개인정보의 수집·이용**
  - [ ] 수집·이용 목적 명시
  - [ ] 수집 항목 최소화
  - [ ] 동의 획득

- [ ] **제17조 - 개인정보 제공**
  - [ ] 제공받는 자 명시
  - [ ] 제공 목적 명시
  - [ ] 제공 항목 명시
  - [ ] 동의 획득

- [ ] **제21조 - 개인정보의 파기**
  - [ ] 보유 기간 경과 시 즉시 파기
  - [ ] 파기 방법: 복구 불가능한 방법

- [ ] **제24조 - 고유식별정보 처리 제한**
  - [ ] 주민등록번호 수집 금지 (법령상 허용된 경우 제외)
  - [ ] 별도 동의 필요

- [ ] **제29조 - 안전성 확보 조치**
  - [ ] 내부 관리계획 수립
  - [ ] 접근 권한 관리
  - [ ] 접근 통제
  - [ ] 개인정보 암호화
  - [ ] 접속 기록 보관 (최소 6개월)

- [ ] **제30조 - 개인정보 처리방침**
  - [ ] 처리 목적, 항목, 보유 기간
  - [ ] 제3자 제공
  - [ ] 위탁
  - [ ] 정보주체 권리
  - [ ] 개인정보 보호책임자

---

### 4.3 ISO 27001 체크리스트

- [ ] **A.5 - 정보 보안 정책**
  - [ ] 정보 보안 정책 문서화
  - [ ] 경영진 승인
  - [ ] 정기적 검토

- [ ] **A.6 - 정보 보안 조직**
  - [ ] 보안 역할 및 책임 정의
  - [ ] 정보 보안 책임자 지정

- [ ] **A.8 - 자산 관리**
  - [ ] 자산 목록 작성
  - [ ] 자산 소유자 지정
  - [ ] 정보 분류

- [ ] **A.9 - 접근 통제**
  - [ ] 접근 통제 정책
  - [ ] 사용자 등록 및 해지
  - [ ] 권한 관리
  - [ ] 비밀번호 정책

- [ ] **A.10 - 암호화**
  - [ ] 암호화 정책
  - [ ] 키 관리

- [ ] **A.12 - 운영 보안**
  - [ ] 변경 관리
  - [ ] 용량 관리
  - [ ] 백업
  - [ ] 로깅 및 모니터링

- [ ] **A.16 - 사고 관리**
  - [ ] 사고 대응 절차
  - [ ] 사고 보고
  - [ ] 증거 수집

- [ ] **A.18 - 컴플라이언스**
  - [ ] 법적 요구사항 식별
  - [ ] 컴플라이언스 검토
  - [ ] 기록 보호

---

## 5. 침투 테스트 시나리오

### 5.1 테스트 계획

**목표**: 파일 업로드 기능의 취약점 발견

**범위**:
- 파일 업로드 API (`/api/candidates/import/upload`)
- 파일 파싱 로직
- 데이터 검증
- 권한 체크
- 암호화

**방법론**: OWASP Testing Guide

---

### 5.2 테스트 케이스

#### Test Case 1: 악성 파일 업로드

**목적**: 서버 침해 시도

**절차**:
1. Excel 파일에 매크로 삽입
2. 매크로에 악성 코드 포함 (예: Reverse Shell)
3. 파일 업로드 시도

**예상 결과**:
- ✅ 매크로 자동 제거
- ✅ 안티바이러스 탐지
- ✅ 업로드 실패
- ✅ 관리자 알림

---

#### Test Case 2: CSV Injection

**목적**: 파일 다운로드 시 RCE

**절차**:
1. CSV 파일 생성:
   ```csv
   name,email,note
   =cmd|'/c calc'!A1,test@test.com,normal
   ```
2. 업로드
3. 에러 보고서 다운로드
4. Excel에서 열기

**예상 결과**:
- ✅ `=cmd|'/c calc'!A1` → `'=cmd|'/c calc'!A1` (sanitized)
- ✅ Excel에서 열어도 실행 안 됨

---

#### Test Case 3: XXE Attack

**목적**: 서버 파일 읽기

**절차**:
1. Excel 파일 압축 해제
2. `xl/workbook.xml` 수정:
   ```xml
   <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
   <workbook>&xxe;</workbook>
   ```
3. 재압축 후 업로드

**예상 결과**:
- ✅ XXE 차단
- ✅ 파일 파싱 실패
- ✅ 에러 메시지

---

#### Test Case 4: Path Traversal

**목적**: 임의 경로에 파일 저장

**절차**:
1. 파일명 변조: `../../../etc/passwd.csv`
2. 업로드

**예상 결과**:
- ✅ 파일명 sanitize: `passwd.csv`
- ✅ 안전한 경로에 저장

---

#### Test Case 5: IDOR

**목적**: 타인의 업로드 내역 조회

**절차**:
1. User A로 파일 업로드 → jobId = `job-111`
2. User B로 로그인
3. `GET /api/candidates/import/jobs/job-111`

**예상 결과**:
- ✅ 403 Forbidden
- ✅ 에러 메시지: "Access denied. You can only view your own jobs."

---

#### Test Case 6: Rate Limit Bypass

**목적**: DoS 공격

**절차**:
1. 1시간에 100개 파일 업로드 시도

**예상 결과**:
- ✅ 5번 업로드 후 Rate Limit
- ✅ 429 Too Many Requests
- ✅ Retry-After 헤더

---

## 6. 사고 대응 계획

### 6.1 사고 시나리오 및 대응

#### Scenario 1: 데이터 유출

**탐지**:
- 비정상적인 대량 데이터 다운로드 감지
- SIEM 알림: "Excessive data export by user X"

**대응 (24시간 내)**:

**0-1시간 (긴급)**:
1. 의심 계정 즉시 차단
2. 관련 세션 종료
3. 접근 로그 확보
4. 경영진 보고

**1-4시간 (조사)**:
1. 유출 범위 파악 (어떤 데이터? 몇 건?)
2. 유출 경로 파악 (어떻게?)
3. 영향 받은 후보자 명단 작성
4. 법률 자문 요청

**4-24시간 (통지)**:
1. 감독 기관 통지 (GDPR: 72시간 내)
2. 영향 받은 정보주체 통지
3. 고객사 통지
4. 공식 발표 (필요 시)

**24시간 이후 (복구 및 개선)**:
1. 취약점 패치
2. 보안 강화
3. 재발 방지 대책
4. 사후 보고서 작성

---

#### Scenario 2: 랜섬웨어 감염

**탐지**:
- 파일이 암호화되기 시작
- 랜섬 노트 발견

**대응**:

**즉시**:
1. 감염 서버 네트워크 차단
2. 백업 서버 격리 (2차 감염 방지)
3. 모든 시스템 스캔

**복구**:
1. 백업에서 복원 (최근 24시간 내)
2. 패치 적용
3. 보안 강화
4. 서비스 재개

**협상 금지**: 랜섬 지불하지 않음

---

#### Scenario 3: 악성 파일 업로드

**탐지**:
- ClamAV 악성 코드 탐지
- SIEM 알림: "Malware detected in upload"

**대응**:

**즉시**:
1. 파일 즉시 삭제
2. 업로드한 사용자 계정 일시 정지
3. 해당 조직의 모든 사용자 스캔

**조사**:
1. 사용자 의도 파악 (실수 vs 악의)
2. 악성 코드 분석
3. 영향 범위 파악

**조치**:
- 실수: 경고 후 계정 복원
- 악의: 계정 영구 정지 + 법적 조치

---

### 6.2 사고 대응 팀 구성

| 역할 | 담당자 | 책임 |
|-----|-------|-----|
| **사고 대응 총괄** | 코난 (CISO) | 전체 대응 지휘 |
| **기술 대응** | 디바 (CTO) | 기술적 조사 및 복구 |
| **법률 자문** | 외부 변호사 | 법적 대응 및 통지 |
| **홍보** | CEO | 대외 커뮤니케이션 |
| **고객 대응** | CSM 팀 | 고객 통지 및 지원 |

---

### 6.3 연락망

**비상 연락망**:
- **코난 (CISO)**: 010-1111-2222
- **디바 (CTO)**: 010-3333-4444
- **CEO**: 010-5555-6666
- **법률 자문**: 02-9999-8888

**긴급 회의**:
- Zoom 링크: (사전 공유)
- Slack 채널: `#incident-response`

---

## 7. 보안 로드맵

### Phase 0: 사전 준비 (착수 전) - 2주

**Week 1-2: 법률 및 보안 검토**
- [ ] 법률 자문 (이용약관, 개인정보처리방침)
- [ ] DPIA (Data Protection Impact Assessment) 수행
- [ ] 보안 아키텍처 설계 검토 (코난)
- [ ] 위협 모델링 (STRIDE)

---

### Phase 1: 기본 보안 (개발과 병행) - 4주

**Week 1-2: 필수 보안 구현**
- [ ] CSV Injection 방어
- [ ] 파일 타입 검증 강화
- [ ] Magic Number 체크
- [ ] Excel 매크로 제거
- [ ] 파일명 Sanitization

**Week 3-4: 암호화 및 접근 제어**
- [ ] AWS KMS 통합
- [ ] 기존 데이터 마이그레이션
- [ ] RBAC 구현
- [ ] IDOR 방어
- [ ] Rate Limiting

---

### Phase 2: 고급 보안 (출시 전) - 2주

**Week 5: 안티바이러스 및 모니터링**
- [ ] ClamAV 통합
- [ ] Docker 설정
- [ ] 상세 감사 로그
- [ ] SIEM 연동 (Elasticsearch)

**Week 6: 침투 테스트**
- [ ] 내부 침투 테스트
- [ ] 취약점 스캔
- [ ] 패치 적용
- [ ] 재테스트

---

### Phase 3: 컴플라이언스 (출시 전) - 2주

**Week 7-8: 인증 및 감사**
- [ ] GDPR 체크리스트 완료
- [ ] PIPA 체크리스트 완료
- [ ] ISO 27001 준비
- [ ] 외부 보안 감사 (선택)
- [ ] 보안 인증 획득 (선택)

---

### 총 소요 시간: 10주 (2.5개월)

---

## 8. 코난의 최종 의견

### 8.1 보안 등급 평가

**현재 설계**: ⭐⭐⭐☆☆ (3/5)
- 기본적인 보안은 갖춤
- 하지만 엔터프라이즈급으로는 부족

**필수 강화 적용 후**: ⭐⭐⭐⭐☆ (4/5)
- 대부분의 공격 방어 가능
- 엔터프라이즈 수준

**권장 강화까지 적용 후**: ⭐⭐⭐⭐⭐ (5/5)
- 금융권 수준
- ISO 27001 인증 가능

---

### 8.2 우선순위

**지금 당장 (Phase 1 시작 전)**:
1. 🔴 CSV Injection 방어 (CRITICAL)
2. 🔴 AWS KMS 통합 (CRITICAL)
3. 🔴 IDOR 방어 (CRITICAL)
4. 🟡 Excel 매크로 제거 (HIGH)
5. 🟡 Rate Limiting (HIGH)

**출시 전 (Phase 2)**:
1. 🟡 ClamAV 통합 (HIGH)
2. 🟡 침투 테스트 (HIGH)
3. 🟢 CSP 헤더 (MEDIUM)

**출시 후 개선 (Phase 3)**:
1. 🟢 파일 샌드박스 (MEDIUM)
2. 🟢 SIEM 연동 (MEDIUM)
3. 🔵 ISO 27001 인증 (LOW)

---

### 8.3 비용 예상

**필수 보안 (Phase 1)**:
- AWS KMS: ~$1/월 + $0.03/10K 요청
- Upstash Redis (Rate Limit): $10/월
- **총**: ~$11/월

**고급 보안 (Phase 2)**:
- ClamAV Docker: 무료 (자체 호스팅)
- Elasticsearch (SIEM): $95/월 (Elastic Cloud)
- **총**: ~$95/월

**컴플라이언스 (Phase 3)**:
- 외부 보안 감사: $10,000 (1회)
- ISO 27001 인증: $20,000 (1회)
- **총**: $30,000 (1회성)

**합계**:
- 개발 비용: $41,000 (기존)
- 보안 비용: $30,000 (인증)
- 월 운영: $106/월 ($170 기존 + $106 추가 = $276/월)
- **총**: $71,000 + $276/월

---

### 8.4 위험 vs 비용

| 항목 | 비용 | 리스크 감소 | ROI |
|-----|-----|-----------|-----|
| AWS KMS | $1/월 | 암호화 키 유출 방지 | ⭐⭐⭐⭐⭐ |
| CSV Injection 방어 | 무료 | RCE 방지 | ⭐⭐⭐⭐⭐ |
| IDOR 방어 | 무료 | 정보 유출 방지 | ⭐⭐⭐⭐⭐ |
| ClamAV | 무료 | 악성 코드 차단 | ⭐⭐⭐⭐☆ |
| Rate Limiting | $10/월 | DoS 방지 | ⭐⭐⭐⭐☆ |
| SIEM | $95/월 | 사고 조기 탐지 | ⭐⭐⭐☆☆ |
| ISO 27001 | $20,000 | 신뢰성 향상 | ⭐⭐⭐☆☆ |

**코난의 제안**:
- **필수** (ROI ⭐⭐⭐⭐⭐): 무료 또는 저비용이면서 효과 큼 → 즉시 적용
- **권장** (ROI ⭐⭐⭐⭐☆): 비용 대비 효과 좋음 → Phase 2에서 적용
- **선택** (ROI ⭐⭐⭐☆☆): 고비용 → 엔터프라이즈 고객 확보 후 고려

---

### 8.5 최종 권장사항

**✅ 승인 조건**:
1. Phase 1 개발 전 필수 보안 구현
2. 침투 테스트 통과 전 출시 금지
3. 법률 자문 완료 전 출시 금지
4. 사이버 보험 가입 (손해배상 대비)

**⚠️ 경고**:
- 보안 없이 출시 시 **회사 존폐 위험**
- 데이터 유출 사고 시 **막대한 손해배상**
- GDPR 위반 시 **연 매출의 4% 또는 €20M 벌금** (둘 중 큰 금액)

**📊 결론**:
이 기능은 **매우 가치 있지만 위험도 높음**.  
**보안 없이는 절대 출시 불가**.  
**필수 보안 구현 후 신중하게 출시** 권장.

---

**작성**: 2026-06-08  
**보고**: 코난 (Chief Information Security Officer)  
**검토**: 디바, 디아, 테스  
**다음 단계**: 경영진 승인 후 Phase 0 착수

---

**코난의 서명**: 🛡️ Conan, CISSP, CISA, CEH
