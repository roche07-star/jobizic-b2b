'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/auth'

interface Board {
  id: string
  organization_id: string
  author_id: string
  title: string
  content: string
  parent_id: string | null
  depth: number
  image_urls: string[]
  is_admin_reply: boolean
  is_pinned: boolean
  view_count: number
  created_at: string
  updated_at: string
  author: {
    id: string
    full_name: string | null
    email: string
    role: string
  }
  organization: {
    id: string
    name: string
  }
  reply_count?: number
  replies?: Board[]
}

interface Organization {
  id: string
  name: string
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [organizationId, setOrganizationId] = useState('')

  // Admin용 조직 필터
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('전체')

  // 글쓰기 모드
  const [showWriteModal, setShowWriteModal] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [replyTarget, setReplyTarget] = useState<Board | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (userEmail) {
      loadBoards()
    }
  }, [userEmail, selectedOrgId])

  async function loadProfile() {
    const profile = await getProfile()
    if (!profile) {
      window.location.href = '/login'
      return
    }
    setUserEmail(profile.email)
    setUserRole(profile.role)
    setOrganizationId(profile.organization_id || '')

    // Admin인 경우 조직 목록 로드
    if (profile.role === 'admin') {
      loadOrganizations()
    }
  }

  async function loadOrganizations() {
    try {
      const res = await fetch('/api/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data)
      }
    } catch (error) {
      console.error('[loadOrganizations] Error:', error)
    }
  }

  async function loadBoards() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        user_email: userEmail,
      })
      if (userRole === 'admin' && selectedOrgId) {
        params.append('organization_id', selectedOrgId)
      }

      const res = await fetch(`/api/boards?${params}`)
      if (res.ok) {
        const data = await res.json()
        setBoards(data)
      }
    } catch (error) {
      console.error('[loadBoards] Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createBoard() {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: userEmail,
          title,
          content,
        }),
      })

      if (res.ok) {
        setTitle('')
        setContent('')
        setShowWriteModal(false)
        loadBoards()
      } else {
        const error = await res.json()
        alert(error.error || '작성 실패')
      }
    } catch (error) {
      console.error('[createBoard] Error:', error)
      alert('작성 중 오류가 발생했습니다.')
    }
  }

  async function loadBoardDetail(boardId: string) {
    try {
      const params = new URLSearchParams({ user_email: userEmail })
      const res = await fetch(`/api/boards/${boardId}?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedBoard(data)
      }
    } catch (error) {
      console.error('[loadBoardDetail] Error:', error)
    }
  }

  async function createReply(parentId: string) {
    if (!replyContent.trim()) {
      alert('내용을 입력해주세요.')
      return
    }

    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: userEmail,
          content: replyContent,
          parent_id: parentId,
        }),
      })

      if (res.ok) {
        setReplyContent('')
        setReplyTarget(null)
        if (selectedBoard) {
          loadBoardDetail(selectedBoard.id)
        }
      } else {
        const error = await res.json()
        alert(error.error || '답글 작성 실패')
      }
    } catch (error) {
      console.error('[createReply] Error:', error)
      alert('답글 작성 중 오류가 발생했습니다.')
    }
  }

  async function deleteBoard(boardId: string) {
    if (!confirm('삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/boards/${boardId}?user_email=${userEmail}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSelectedBoard(null)
        loadBoards()
      } else {
        const error = await res.json()
        alert(error.error || '삭제 실패')
      }
    } catch (error) {
      console.error('[deleteBoard] Error:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '방금 전'
    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  // 재귀 렌더링: 다단계 댓글
  function renderReplies(replies: Board[], depth: number = 0) {
    return replies.map((reply) => (
      <div
        key={reply.id}
        style={{
          marginLeft: depth > 0 ? 32 : 0,
          marginTop: 12,
          paddingLeft: depth > 0 ? 16 : 0,
          borderLeft: depth > 0 ? '2px solid var(--border)' : 'none',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            background: reply.is_admin_reply
              ? 'rgba(74, 158, 255, 0.08)'
              : 'var(--bg2)',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {reply.is_admin_reply && (
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  background: '#4a9eff',
                  color: '#fff',
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                ADMIN
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {reply.author.full_name || reply.author.email.split('@')[0]}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {formatDate(reply.created_at)}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {reply.content}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setReplyTarget(reply)}
              style={{ fontSize: 11 }}
            >
              💬 답글
            </button>
            {reply.author.email === userEmail && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => deleteBoard(reply.id)}
                style={{ fontSize: 11, color: 'var(--danger)' }}
              >
                삭제
              </button>
            )}
          </div>
        </div>

        {/* 답글 입력 폼 */}
        {replyTarget?.id === reply.id && (
          <div style={{ marginTop: 12, marginLeft: 32 }}>
            <textarea
              className="form-textarea"
              rows={3}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="답글을 입력하세요..."
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => createReply(reply.id)}
              >
                답글 작성
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setReplyTarget(null)
                  setReplyContent('')
                }}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 하위 답글 재귀 렌더링 */}
        {reply.replies && reply.replies.length > 0 && renderReplies(reply.replies, depth + 1)}
      </div>
    ))
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="page-title">📢 회사 게시판</div>
          <div className="page-sub">우리 팀의 소통 공간</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {userRole === 'admin' && organizations.length > 0 && (
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '2px solid var(--accent)',
                background: 'var(--bg)',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <option value="전체">🏢 전체 조직</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-primary" onClick={() => setShowWriteModal(true)}>
            ✏️ 글쓰기
          </button>
        </div>
      </div>

      {/* 게시물 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>
          로딩 중...
        </div>
      ) : boards.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 80,
            color: 'var(--muted)',
            fontSize: 14,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <div>아직 게시물이 없습니다.</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>첫 번째 글을 작성해보세요!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {boards.map((board) => (
            <div
              key={board.id}
              onClick={() => loadBoardDetail(board.id)}
              style={{
                padding: 20,
                background: board.is_pinned
                  ? 'linear-gradient(135deg, rgba(232, 255, 71, 0.08) 0%, rgba(232, 255, 71, 0.02) 100%)'
                  : 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {board.is_pinned && (
                  <span style={{ fontSize: 14 }}>📌</span>
                )}
                {board.is_admin_reply && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      background: '#4a9eff',
                      color: '#fff',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    ADMIN
                  </span>
                )}
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                  {board.title}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--muted)',
                  marginBottom: 12,
                  lineHeight: 1.6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {board.content}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--muted2)' }}>
                <div>👤 {board.author.full_name || board.author.email.split('@')[0]}</div>
                <div>🕐 {formatDate(board.created_at)}</div>
                <div>👁️ {board.view_count}</div>
                {board.reply_count !== undefined && board.reply_count > 0 && (
                  <div style={{ color: 'var(--accent)', fontWeight: 600 }}>💬 {board.reply_count}</div>
                )}
                {userRole === 'admin' && (
                  <div>🏢 {board.organization.name}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 글쓰기 모달 */}
      {showWriteModal && (
        <div className="overlay" onClick={() => setShowWriteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 700 }}>
            <div className="modal-header">
              <div className="modal-title">✏️ 새 글 작성</div>
              <button className="modal-close" onClick={() => setShowWriteModal(false)}>
                ×
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">제목</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">내용</label>
              <textarea
                className="form-textarea"
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="내용을 입력하세요"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowWriteModal(false)}>
                취소
              </button>
              <button className="btn btn-primary" onClick={createBoard}>
                작성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 게시물 상세 모달 */}
      {selectedBoard && (
        <div className="overlay" onClick={() => setSelectedBoard(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 800, maxHeight: '90vh' }}>
            <div className="modal-header">
              <div className="modal-title">{selectedBoard.title}</div>
              <button className="modal-close" onClick={() => setSelectedBoard(null)}>
                ×
              </button>
            </div>

            {/* 게시물 내용 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                {selectedBoard.is_admin_reply && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      background: '#4a9eff',
                      color: '#fff',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    ADMIN
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {selectedBoard.author.full_name || selectedBoard.author.email.split('@')[0]}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {formatDate(selectedBoard.created_at)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  👁️ {selectedBoard.view_count}
                </span>
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  padding: '16px 20px',
                  background: 'var(--bg2)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                {selectedBoard.content}
              </div>
              {selectedBoard.author.email === userEmail && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteBoard(selectedBoard.id)}
                    style={{ color: 'var(--danger)' }}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>

            {/* 댓글 목록 */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div className="form-label" style={{ marginBottom: 16 }}>
                💬 댓글 {selectedBoard.replies?.length || 0}개
              </div>

              {/* 댓글 작성 */}
              <div style={{ marginBottom: 20 }}>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="댓글을 입력하세요..."
                  style={{ marginBottom: 8 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => createReply(selectedBoard.id)}
                >
                  댓글 작성
                </button>
              </div>

              {/* 댓글 목록 (재귀) */}
              {selectedBoard.replies && selectedBoard.replies.length > 0 ? (
                <div>{renderReplies(selectedBoard.replies)}</div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
                  아직 댓글이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
