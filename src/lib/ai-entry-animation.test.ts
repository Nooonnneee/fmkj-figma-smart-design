import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * 回归网：入场动画必须避开 tw-animate-css 的同名关键帧 `enter`，并且
 * fill-mode 用 `backwards`。改回 `enter` / `both` 会让 animate-enter 元素
 * 结束后留下 transform + filter，成为 fixed 后代的包含块 —— 名片页文档被
 * 撑到 5260px，右侧 AI 栏 sticky 到 2318 就跟着滚走。
 *
 * 这条断言直接读 styles.css：复核变异证明把 workspace-enter/backwards 改回
 * enter/both 时 326 个测试全绿，所以必须有文件级回归。
 */
const css = readFileSync(new URL('../app/(frontend)/styles.css', import.meta.url), 'utf8')

describe('入场动画 token（应修 4）', () => {
  it('不再残留 animation: enter / --animate-enter: enter', () => {
    expect(css).not.toMatch(/animation:\s*enter\b/)
    expect(css).not.toMatch(/--animate-enter:\s*enter\b/)
    // 注释里可以提到这个名字，但不能再有真正的定义
    expect(css).not.toMatch(/^\s*@keyframes\s+enter\b/m)
  })

  it('--animate-enter 指向 workspace-enter 且 fill-mode 为 backwards', () => {
    const token = css.match(/--animate-enter:\s*([^;]+);/)
    expect(token?.[1]).toBeDefined()
    expect(token?.[1]).toContain('workspace-enter')
    expect(token?.[1]).toContain('backwards')
    expect(token?.[1]).not.toContain('both')
  })

  it('workspace-enter 关键帧仍然存在（token 不能指向不存在的动画）', () => {
    expect(css).toMatch(/@keyframes\s+workspace-enter\s*\{/)
  })
})
