'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const bgColor = {
    success: 'rgba(76, 175, 134, 0.15)',
    error: 'rgba(255, 107, 107, 0.15)',
    info: 'rgba(123, 97, 255, 0.15)'
  }[type]

  const textColor = {
    success: '#4caf86',
    error: '#ff6b6b',
    info: '#7b61ff'
  }[type]

  const icon = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  }[type]

  return (
    <div
      className="toast"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: bgColor,
        border: `1px solid ${textColor}40`,
        borderRadius: '10px',
        padding: '12px 20px',
        fontSize: '14px',
        fontWeight: 500,
        color: textColor,
        zIndex: 9999,
        animation: 'slideUp 0.3s ease',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: '200px',
        maxWidth: '400px'
      }}
    >
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          fontSize: '20px',
          lineHeight: 1,
          padding: 0,
          opacity: 0.7
        }}
      >
        ×
      </button>
    </div>
  )
}
