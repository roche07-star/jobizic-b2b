import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import GlobalJobProgress from '@/components/GlobalJobProgress'

export const metadata: Metadata = {
  title: 'Jobizic Biz - AI ATS 플랫폼',
  description: '헤드헌터를 위한 AI 기반 JD 파싱 · 후보자 매칭 · 채용 파이프라인',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <GlobalJobProgress />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  )
}
