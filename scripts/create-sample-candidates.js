/**
 * 샘플 후보자 3명 생성 스크립트
 * 실행: node scripts/create-sample-candidates.js
 */

const candidates = [
  {
    name: '김성준',
    email: 'kim.seongjun@example.com',
    phone: '010-1234-5678',
    location: '서울 강남구',
    current_company: '네이버',
    current_position: 'Backend Engineer (L4)',
    total_experience_years: 8,
    career_summary: '대규모 트래픽 처리 경험이 풍부한 백엔드 엔지니어. MSA 전환 프로젝트 리드 경험 보유. 카카오에서 5년, 네이버에서 3년 근무하며 안정적인 시스템 설계 및 운영 역량 보유.',
    education: ['서울대학교 컴퓨터공학과 학사', 'KAIST 전산학과 석사'],
    skills: ['Java', 'Spring Boot', 'Kotlin', 'MySQL', 'Redis', 'Kafka', 'Kubernetes'],
    tech_stack: ['Java', 'Spring Boot', 'Kotlin', 'MySQL', 'PostgreSQL', 'Redis', 'Kafka', 'Docker', 'Kubernetes', 'AWS', 'Terraform'],
    certifications: ['정보처리기사', 'AWS Solutions Architect Professional'],
    languages: ['한국어(원어민)', '영어(비즈니스 회화)'],
    desired_position: 'Staff Backend Engineer',
    desired_salary: '12,000만원',
    desired_location: '서울 강남/판교',
    job_search_status: '적극적',
    strength_summary: '대규모 분산 시스템 설계 및 운영 전문가. MSA 아키텍처 전환 프로젝트에서 기술 리더십 발휘. 연 1억 트래픽 처리하는 결제 시스템 안정화 경험.',
    career_trajectory: '메시징 플랫폼 → 커머스 백엔드 → 결제 시스템으로 커리어 확장. 점진적으로 비즈니스 임팩트가 큰 도메인으로 이동하며 기술적 깊이와 리더십 역량 동시 성장.',
    ideal_roles: ['Staff/Principal Backend Engineer', 'Backend Tech Lead', 'Engineering Manager'],
    market_value: '11,000~13,000만원',
    key_highlights: ['네이버 L4 백엔드 엔지니어 (8년차)', 'MSA 전환 프로젝트 리드', '연 1억 트래픽 결제 시스템 운영', 'Kafka 기반 이벤트 드리븐 아키텍처 설계'],
    tags: ['Backend', 'MSA', 'High-Traffic', 'Tech-Lead', 'Naver'],
    status: '서치중',
    source: '직접등록',
    raw_resume: '[샘플 데이터] 김성준 이력서 - 네이버 백엔드 엔지니어 (8년차)',
  },
  {
    name: '박지영',
    email: 'park.jiyoung@example.com',
    phone: '010-2345-6789',
    location: '서울 서초구',
    current_company: '토스',
    current_position: 'Frontend Chapter Lead',
    total_experience_years: 6,
    career_summary: '사용자 경험 개선에 진심인 프론트엔드 리드. React 생태계 전문가로 디자인 시스템 구축 및 성능 최적화 경험 풍부. 크로스팀 협업 능력 우수.',
    education: ['이화여대 컴퓨터공학과 학사'],
    skills: ['React', 'TypeScript', 'Next.js', 'Webpack', 'Storybook', 'Figma'],
    tech_stack: ['React', 'TypeScript', 'Next.js', 'Vue.js', 'Webpack', 'Vite', 'Storybook', 'Jest', 'Cypress', 'Figma', 'Tailwind CSS'],
    certifications: ['정보처리기사'],
    languages: ['한국어(원어민)', '영어(비즈니스 유창)'],
    desired_position: 'Frontend Engineering Manager',
    desired_salary: '9,500만원',
    desired_location: '서울 강남/서초',
    job_search_status: '관심있음',
    strength_summary: '토스 디자인 시스템 v2 구축 리드. 번들 사이즈 40% 감소, 초기 로딩 속도 60% 개선. PM/디자이너와의 원활한 협업으로 정시 런칭 100% 달성.',
    career_trajectory: '스타트업 프론트엔드 → 라인 UI 플랫폼 → 토스 Chapter Lead. 개인 기여자에서 팀 리더로 성장하며 기술 전문성과 팀 빌딩 역량 확보.',
    ideal_roles: ['Frontend Lead', 'Frontend Engineering Manager', 'Design System Lead'],
    market_value: '8,500~10,000만원',
    key_highlights: ['토스 Frontend Chapter Lead (6년차)', '디자인 시스템 v2 구축 리드', '번들 사이즈 40% 감소', '크로스팀 협업 프로젝트 다수'],
    tags: ['Frontend', 'React', 'Design-System', 'Tech-Lead', 'Toss'],
    status: '서치중',
    source: '직접등록',
    raw_resume: '[샘플 데이터] 박지영 이력서 - 토스 Frontend Chapter Lead (6년차)',
  },
  {
    name: '이민호',
    email: 'lee.minho@example.com',
    phone: '010-3456-7890',
    location: '경기도 성남시',
    current_company: '컬리',
    current_position: 'Software Engineer',
    total_experience_years: 3,
    career_summary: '빠른 학습 능력과 문제 해결 능력을 갖춘 주니어 풀스택 개발자. 스타트업에서 백엔드/프론트엔드 모두 경험하며 빠르게 성장 중. 적극적인 코드 리뷰 참여와 기술 블로그 운영.',
    education: ['연세대학교 컴퓨터과학과 학사'],
    skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL', 'Docker'],
    tech_stack: ['TypeScript', 'JavaScript', 'Node.js', 'Express', 'NestJS', 'React', 'Next.js', 'PostgreSQL', 'MongoDB', 'Docker', 'AWS EC2', 'Git'],
    certifications: ['정보처리기사'],
    languages: ['한국어(원어민)', '영어(기술 문서 독해 가능)'],
    desired_position: 'Backend Engineer / Fullstack Engineer',
    desired_salary: '6,500만원',
    desired_location: '서울/판교',
    job_search_status: '적극적',
    strength_summary: '빠른 피드백과 실행력. 신규 기능 개발부터 배포까지 end-to-end 경험 보유. 동료들의 코드 리뷰를 적극 요청하며 빠르게 학습하는 자세.',
    career_trajectory: '웹 에이전시에서 풀스택 개발 → 스타트업 백엔드 엔지니어로 커리어 전환. 작은 조직에서 빠르게 성장하며 다양한 기술 스택 경험 중.',
    ideal_roles: ['Backend Engineer', 'Fullstack Engineer', 'Junior Tech Lead'],
    market_value: '6,000~7,000만원',
    key_highlights: ['컬리 주문/결제 시스템 개발', 'Node.js 기반 RESTful API 설계', 'PostgreSQL 쿼리 최적화로 응답속도 30% 개선', '기술 블로그 운영 (월 2회 포스팅)'],
    tags: ['Backend', 'Fullstack', 'Node.js', 'Junior', 'Kurly'],
    status: '서치중',
    source: '직접등록',
    raw_resume: '[샘플 데이터] 이민호 이력서 - 컬리 Software Engineer (3년차)',
  }
];

async function main() {
  const baseUrl = 'http://localhost:3001';

  console.log('🚀 샘플 후보자 3명 생성 중...\n');

  // organization_id와 created_by는 직접 입력 필요
  const organization_id = process.argv[2]; // 첫 번째 인자
  const created_by = process.argv[3]; // 두 번째 인자

  if (!organization_id || !created_by) {
    console.error('❌ 사용법: node scripts/create-sample-candidates.js <organization_id> <your_email>');
    console.error('예시: node scripts/create-sample-candidates.js 123e4567-e89b-12d3-a456-426614174000 roche07he@gmail.com');
    process.exit(1);
  }

  console.log(`📋 Organization ID: ${organization_id}`);
  console.log(`📋 Created by: ${created_by}\n`);

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${baseUrl}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...candidate,
          organization_id,
          created_by
        })
      });

      if (!res.ok) {
        const error = await res.json();
        console.error(`❌ ${candidate.name} 생성 실패:`, error);
        continue;
      }

      const data = await res.json();
      console.log(`✅ ${candidate.name} 생성 완료 (ID: ${data.id})`);
    } catch (error) {
      console.error(`❌ ${candidate.name} 생성 중 오류:`, error.message);
    }
  }

  console.log('\n🎉 완료!');
}

main();
