const JobizicLogoSmall = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#1a1a14"/>
    <rect x="3" y="3" width="94" height="94" rx="19" stroke="#e8ff47" strokeWidth="5"/>
    <text x="50" y="70" textAnchor="middle" fontFamily="'Arial Black', 'Outfit', sans-serif" fontWeight="900" fontSize="50" letterSpacing="-1">
      <tspan fill="#e8e8de">J</tspan><tspan fill="#e8ff47">z</tspan>
    </text>
  </svg>
)

export default function Footer() {
  return (
    <footer>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <JobizicLogoSmall />
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: 2, color: '#e8ff47', textTransform: 'uppercase' }}>
          JOBIZIC B2B
        </span>
      </div>
      <div className="footer-copy">© 2026 Jobizic. All rights reserved.</div>
      <div className="footer-links">
        <a href="/terms">이용약관</a>
        <a href="/privacy">개인정보처리방침</a>
        <a href="/licenses">오픈소스 라이선스</a>
        <a href="mailto:support@jobizic.io">문의하기</a>
      </div>
    </footer>
  )
}
