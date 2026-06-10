'use client'

interface AnalysisProgressProps {
  steps: string[]
  currentStep: number
  estimatedTime?: number // seconds (for display only, no countdown)
}

export default function AnalysisProgress({ steps, currentStep, estimatedTime = 60 }: AnalysisProgressProps) {
  const progress = (currentStep / steps.length) * 100

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '32px',
        minWidth: '400px',
        maxWidth: '90%',
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤖</div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          AI 분석 중...
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--muted2)', marginTop: '8px' }}>
          약 {estimatedTime}초 소요됩니다 · Step {currentStep + 1}/{steps.length}
        </p>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          background: 'var(--bg3)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '20px'
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent2), var(--accent))',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }}
        />
      </div>

      {/* Steps */}
      <div style={{ marginBottom: '16px' }}>
        {steps.map((step, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 0',
              opacity: index <= currentStep ? 1 : 0.4
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: index < currentStep
                  ? 'var(--success)'
                  : index === currentStep
                  ? 'var(--accent)'
                  : 'var(--bg3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: index <= currentStep ? '#000' : 'var(--muted2)'
              }}
            >
              {index < currentStep ? '✓' : index + 1}
            </div>
            <span
              style={{
                fontSize: '14px',
                color: index <= currentStep ? 'var(--text)' : 'var(--muted2)',
                fontWeight: index === currentStep ? 600 : 400
              }}
            >
              {step}
            </span>
            {index === currentStep && (
              <div
                style={{
                  marginLeft: 'auto',
                  width: '16px',
                  height: '16px',
                  border: '2px solid var(--accent)',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Current Step Status */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--muted2)',
          paddingTop: '12px',
          borderTop: '1px solid var(--border)'
        }}
      >
        {currentStep < steps.length - 1 ? (
          <>{steps[currentStep]}</>
        ) : (
          <>거의 완료되었습니다...</>
        )}
      </div>
    </div>
  )
}
