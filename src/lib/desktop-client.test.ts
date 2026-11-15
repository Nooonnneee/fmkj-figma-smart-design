import { describe, expect, it } from 'vitest'

import { desktopClientVersion, isDesktopClient } from './desktop-client'

describe('isDesktopClient', () => {
  it('识别客户端追加的标记', () => {
    expect(
      isDesktopClient(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) FanmengSpaceDesktop/1.4.2 Safari/537.36',
      ),
    ).toBe(true)
  })

  it('识别各种版本号写法', () => {
    expect(isDesktopClient('FanmengSpaceDesktop/0')).toBe(true)
    expect(isDesktopClient('FanmengSpaceDesktop/1.4')).toBe(true)
    expect(isDesktopClient('FanmengSpaceDesktop/1.4.2-beta')).toBe(true)
  })

  it('版本号可取出', () => {
    expect(desktopClientVersion('x FanmengSpaceDesktop/2.10.3 y')).toBe('2.10.3')
  })

  it('普通浏览器 UA 判为否', () => {
    for (const ua of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 MicroMessenger/8.0',
      'curl/8.7.1',
      '',
      null,
      undefined,
    ])
      expect(isDesktopClient(ua)).toBe(false)
  })

  it('相近但不正确的标记不误判', () => {
    for (const ua of [
      // 缺少版本号：客户端一定会带版本，这里不宽松放行
      'FanmengSpaceDesktop/',
      'FanmengSpaceDesktop',
      // 只是把名字写在正文里（不是 token）
      'Mozilla/5.0 (X11) xFanmengSpaceDesktop/1.0',
    ])
      expect(isDesktopClient(ua)).toBe(false)
  })
})
