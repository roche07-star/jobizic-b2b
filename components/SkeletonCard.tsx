export function SkeletonCard() {
  return (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          height: 60,
          background: 'linear-gradient(90deg, var(--border) 0%, var(--bg-secondary) 50%, var(--border) 100%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-loading 1.5s ease-in-out infinite',
          borderRadius: 4,
        }}
      />
      <style jsx>{`
        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  )
}

export function SkeletonJDCard() {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          height: 20,
          width: '60%',
          background: 'linear-gradient(90deg, var(--border) 0%, var(--bg-secondary) 50%, var(--border) 100%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-loading 1.5s ease-in-out infinite',
          borderRadius: 4,
          marginBottom: 12,
        }}
      />
      <div
        style={{
          height: 16,
          width: '40%',
          background: 'linear-gradient(90deg, var(--border) 0%, var(--bg-secondary) 50%, var(--border) 100%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-loading 1.5s ease-in-out infinite',
          borderRadius: 4,
          marginBottom: 8,
        }}
      />
      <div
        style={{
          height: 16,
          width: '80%',
          background: 'linear-gradient(90deg, var(--border) 0%, var(--bg-secondary) 50%, var(--border) 100%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-loading 1.5s ease-in-out infinite',
          borderRadius: 4,
        }}
      />
      <style jsx>{`
        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div style={{ width: '100%' }}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            height: 40,
            marginBottom: 8,
            background: 'linear-gradient(90deg, var(--border) 0%, var(--bg-secondary) 50%, var(--border) 100%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-loading 1.5s ease-in-out infinite',
            borderRadius: 4,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  )
}
