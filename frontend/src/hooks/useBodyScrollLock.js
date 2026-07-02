import { useEffect } from 'react'

let lockCount = 0
let savedScrollY = 0

function lock() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY
    const body = document.body
    body.style.position = 'fixed'
    body.style.top = `-${savedScrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
  }
  lockCount += 1
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    const body = document.body
    body.style.position = ''
    body.style.top = ''
    body.style.left = ''
    body.style.right = ''
    body.style.width = ''
    body.style.overflow = ''
    window.scrollTo(0, savedScrollY)
  }
}

export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return
    lock()
    return () => unlock()
  }, [active])
}
