const JobizicLogoSmall = () => (
  <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2a2a24" />
        <stop offset="100%" stopColor="#1a1a14" />
      </linearGradient>
      <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e8ff47" />
        <stop offset="50%" stopColor="#f0ff70" />
        <stop offset="100%" stopColor="#e8ff47" />
      </linearGradient>
    </defs>

    {/* 배경 */}
    <rect width="100" height="100" rx="24" fill="url(#bgGradient)"/>

    {/* 테두리 */}
    <rect x="3" y="3" width="94" height="94" rx="21" stroke="url(#borderGradient)" strokeWidth="4" opacity="0.9"/>

    {/* 텍스트 */}
    <text x="50" y="70" textAnchor="middle" fontFamily="'Arial Black', 'Outfit', sans-serif" fontWeight="900" fontSize="42" letterSpacing="-2">
      <tspan fill="#e8e8de">J</tspan><tspan fill="#e8ff47">z</tspan>
    </text>
  </svg>
)

export default function Footer() {
  return (
    <footer className="footer-container">
      {/* 사업자 정보 - 가운데 배치 */}
      <div className="footer-info">
        <div>JOBIZIC | 대표: 박영철</div>
        <div>사업자등록번호: 566-18-02615</div>
        <div>주소: 경기도 수원시 장안구 화산로 87, 404호</div>
        <div>전화: 070-8095-5546 | 이메일: roche@jobizic.com</div>
        <div className="footer-copyright">© 2026 Jobizic. All rights reserved.</div>
      </div>

      {/* 로고 + 링크 라인 */}
      <div className="footer-bottom">
        <div className="footer-logo-section">
          <JobizicLogoSmall />
          <span className="footer-brand">BIZ</span>
        </div>

        <div className="footer-links">
          <a href="/terms">이용약관</a>
          <span className="footer-divider">·</span>
          <a href="/privacy">개인정보처리방침</a>
          <span className="footer-divider">·</span>
          <a href="/refund">환불정책</a>
          <span className="footer-divider">·</span>
          <a href="/licenses">오픈소스 라이선스</a>
        </div>
      </div>
    </footer>
  )
}
