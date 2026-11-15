'use client'

import * as React from 'react'

/**
 * 当前视口宽度（px）。首屏先返回 0（比任何断点都窄，按最保守的布局渲染），
 * 挂载后同步真实值，之后跟随 resize。
 *
 * 与 useIsMobile 同样的取舍：初始值必须能安全地用于服务端渲染，
 * 因此不能直接 window.innerWidth。布局判定本身是纯函数（lib/ai-panel.ts），
 * 由调用方拿这个宽度去算，方便单测。
 */
export function useViewportWidth() {
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    const onChange = () => setWidth(window.innerWidth)
    onChange()
    window.addEventListener('resize', onChange)
    return () => window.removeEventListener('resize', onChange)
  }, [])

  return width
}
