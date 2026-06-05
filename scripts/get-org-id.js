/**
 * Organization ID 확인 스크립트
 * 실행: node scripts/get-org-id.js
 */

async function main() {
  try {
    const res = await fetch('http://localhost:3001/api/admin/organizations');
    const data = await res.json();

    console.log('\n📋 조직 목록:\n');
    data.organizations.forEach(org => {
      console.log(`${org.name}`);
      console.log(`  ID: ${org.id}`);
      console.log(`  Type: ${org.type}`);
      console.log('');
    });

    if (data.organizations.length > 0) {
      const firstOrg = data.organizations[0];
      console.log(`\n💡 샘플 후보자 생성 명령:`);
      console.log(`node scripts/create-sample-candidates.js ${firstOrg.id} roche07he@gmail.com\n`);
    }
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

main();
