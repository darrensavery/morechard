import type { CSSProperties, ReactNode } from 'react'
import { useAndroidBack } from '../../hooks/useAndroidBack'
import { useDragToClose } from '../../hooks/useDragToClose'
import { tick } from '../../lib/haptics'

interface Props {
  onClose: () => void
  children: ReactNode
  panelClassName?: string
  panelStyle?: CSSProperties
  zIndex?: number
}

export function BaseSheet({ onClose, children, panelClassName, panelStyle, zIndex = 50 }: Props) {
  function close() {
    void tick()
    onClose()
  }

  const { sheetRef, handleProps } = useDragToClose(close)
  useAndroidBack(true, close)

  return (
    <div
      data-testid="sheet-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
      onClick={close}
    >
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        className={panelClassName}
        style={{ width: '100%', transition: 'transform 300ms', ...panelStyle }}
      >
        <div {...handleProps}>
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>
        {children}
      </div>
    </div>
  )
}
