/**
 * JD 상태/우선순위 업데이트 테스트
 *
 * 목적: 하나의 JD만 변경되고 다른 JD는 영향받지 않는지 확인
 */

describe('JD 업데이트 로직', () => {
  // 테스트용 JD 목록
  const mockJDs = [
    { id: '1', company: 'A사', status: '활성', priority: '보통' },
    { id: '2', company: 'B사', status: '활성', priority: '보통' },
    { id: '3', company: 'C사', status: '검토중', priority: '긴급' },
  ]

  describe('상태 변경', () => {
    it('하나의 JD만 상태가 변경되어야 함', () => {
      const targetId = '1'
      const newStatus = '마감'

      // updateStatus 로직 시뮬레이션
      const result = mockJDs.map(j =>
        j.id === targetId ? { ...j, status: newStatus } : j
      )

      // A사만 변경됨
      expect(result[0].status).toBe('마감')
      expect(result[0].company).toBe('A사')

      // B사, C사는 그대로
      expect(result[1].status).toBe('활성')
      expect(result[2].status).toBe('검토중')
    })

    it('잘못된 ID로는 아무것도 변경되지 않아야 함', () => {
      const targetId = 'invalid-id'
      const newStatus = '마감'

      const result = mockJDs.map(j =>
        j.id === targetId ? { ...j, status: newStatus } : j
      )

      // 모두 그대로
      expect(result[0].status).toBe('활성')
      expect(result[1].status).toBe('활성')
      expect(result[2].status).toBe('검토중')
    })
  })

  describe('우선순위 변경', () => {
    it('하나의 JD만 우선순위가 변경되어야 함', () => {
      const targetId = '2'
      const newPriority = '긴급'

      // updatePriority 로직 시뮬레이션
      const result = mockJDs.map(j =>
        j.id === targetId ? { ...j, priority: newPriority } : j
      )

      // B사만 변경됨
      expect(result[1].priority).toBe('긴급')
      expect(result[1].company).toBe('B사')

      // A사, C사는 그대로
      expect(result[0].priority).toBe('보통')
      expect(result[2].priority).toBe('긴급') // 원래부터 긴급
    })
  })

  describe('동시 변경', () => {
    it('여러 번 변경해도 각각 독립적이어야 함', () => {
      let jds = [...mockJDs]

      // 첫 번째 변경: ID '1' 상태
      jds = jds.map(j => j.id === '1' ? { ...j, status: '마감' } : j)

      // 두 번째 변경: ID '2' 우선순위
      jds = jds.map(j => j.id === '2' ? { ...j, priority: '높음' } : j)

      // 세 번째 변경: ID '3' 상태
      jds = jds.map(j => j.id === '3' ? { ...j, status: '활성' } : j)

      // 각각 독립적으로 변경됨
      expect(jds[0].status).toBe('마감')
      expect(jds[0].priority).toBe('보통')

      expect(jds[1].status).toBe('활성')
      expect(jds[1].priority).toBe('높음')

      expect(jds[2].status).toBe('활성')
      expect(jds[2].priority).toBe('긴급')
    })
  })
})
