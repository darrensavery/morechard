import { useEffect, useRef, useState } from 'react'

interface Props {
  value:     string;
  className?: string;
}

export function AnimatedStat({ value, className }: Props) {
  const [displayed, setDisplayed] = useState(value)
  const [fading,    setFading]    = useState(false)
  const prevRef = useRef(value)

  useEffect(() => {
    if (value === prevRef.current) return
    prevRef.current = value
    setFading(true)
    const t = setTimeout(() => {
      setDisplayed(value)
      setFading(false)
    }, 150)
    return () => clearTimeout(t)
  }, [value])

  return (
    <span
      className={className}
      style={{ transition: 'opacity 150ms ease-out', opacity: fading ? 0 : 1 }}
    >
      {displayed}
    </span>
  )
}
