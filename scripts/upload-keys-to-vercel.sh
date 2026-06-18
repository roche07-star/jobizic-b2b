#!/bin/bash

# 🔐 Vercel에 암호화 키 자동 업로드
# Vercel CLI 필요: npm i -g vercel

echo "🔐 Vercel에 암호화 키 업로드 중..."
echo ""

# .env.local 파일 확인
if [ ! -f ".env.local" ]; then
  echo "❌ .env.local 파일이 없습니다."
  echo "먼저 'npm run generate:keys:secure'를 실행하세요."
  exit 1
fi

# Vercel CLI 확인
if ! command -v vercel &> /dev/null; then
  echo "❌ Vercel CLI가 설치되지 않았습니다."
  echo ""
  echo "설치:"
  echo "  npm install -g vercel"
  exit 1
fi

# .env.local에서 키 읽기
source .env.local

# Vercel에 환경 변수 추가
echo "📤 ENCRYPTION_KEY 업로드 중..."
echo "$ENCRYPTION_KEY" | vercel env add ENCRYPTION_KEY production

echo "📤 ENCRYPTION_SALT 업로드 중..."
echo "$ENCRYPTION_SALT" | vercel env add ENCRYPTION_SALT production

echo ""
echo "✅ 업로드 완료!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 다음 단계:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Vercel Dashboard에서 환경 변수 확인"
echo "2. git push로 재배포"
echo "3. 배포 로그 확인"
echo ""
