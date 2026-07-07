import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: '환불 정책 — Jobizic B2B',
}

export default function RefundPage() {
  return (
    <>
      <Nav />
      <main className="privacy-page">
        <div className="privacy-container">
          <h1 className="privacy-title">환불 정책</h1>
          <p className="privacy-date">시행일: 2026년 7월 7일</p>

          <div className="privacy-section">
            <h2>1. 환불 가능 기간</h2>
            <p>디지털 콘텐츠 특성상 다음과 같이 환불이 제한됩니다.</p>
            <ul>
              <li><strong>환불 가능:</strong> 결제 후 서비스 이용 전까지</li>
              <li><strong>환불 불가:</strong> 분석 완료 후 (이력서 분석, JD 분석, 면접 가이드 등 결과 확인 후)</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>2. 환불 신청 방법</h2>
            <p>다음 방법으로 환불을 신청하실 수 있습니다.</p>
            <ul>
              <li><strong>이메일:</strong> jobizic.biz@gmail.com</li>
              <li><strong>전화:</strong> 070-8095-5546 (평일 10:00~18:00)</li>
            </ul>
            <p style={{ marginTop: 12 }}>신청 시 다음 정보를 포함해 주세요:</p>
            <ul>
              <li>주문번호 또는 결제 내역</li>
              <li>환불 사유</li>
              <li>환불 계좌 정보</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>3. 환불 처리 기간</h2>
            <ul>
              <li><strong>신용카드:</strong> 승인 취소 후 3~5 영업일 내 카드사 승인 취소</li>
              <li><strong>계좌이체:</strong> 신청일로부터 3 영업일 내 환불 (수수료 제외)</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>4. 환불 불가 사항</h2>
            <p>다음의 경우 환불이 제한될 수 있습니다.</p>
            <ul>
              <li>분석 결과를 이미 확인한 경우</li>
              <li>다운로드 완료된 파일 (이력서 생성 DOCX 등)</li>
              <li>쿠폰 사용 후 남은 크레딧 (단, 미사용 쿠폰은 환불 가능)</li>
              <li>결제일로부터 7일 경과 후 (단, 정당한 사유가 있는 경우 협의 가능)</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>5. 부분 환불</h2>
            <p>패키지 상품의 경우 부분 사용 시 다음과 같이 환불됩니다.</p>
            <ul>
              <li>사용한 기능 금액을 차감 후 잔액 환불</li>
              <li>예: 올인원 패키지 (39,900원) 중 이력서 분석 1회 사용 → 38,900원 환불</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>6. 쿠폰 환불</h2>
            <ul>
              <li><strong>STORE 구매 쿠폰:</strong> 미사용 시 전액 환불 가능</li>
              <li><strong>프로모션 쿠폰:</strong> 무상 지급 쿠폰은 환불 불가</li>
              <li><strong>유효기간 만료:</strong> 만료된 쿠폰은 환불 불가</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>7. 서비스 하자로 인한 환불</h2>
            <p>다음의 경우 전액 환불 및 보상이 제공됩니다.</p>
            <ul>
              <li>시스템 오류로 인한 분석 실패</li>
              <li>중복 결제</li>
              <li>서비스 장애로 인한 이용 불가</li>
            </ul>
            <p style={{ marginTop: 12 }}>위 사유 발생 시 즉시 고객센터로 연락 주시기 바랍니다.</p>
          </div>

          <div className="privacy-section">
            <h2>8. 문의</h2>
            <p>환불 정책에 대한 문의사항은 다음으로 연락 주세요.</p>
            <ul>
              <li><strong>이메일:</strong> jobizic.biz@gmail.com</li>
              <li><strong>전화:</strong> 070-8095-5546 (평일 10:00~18:00)</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
