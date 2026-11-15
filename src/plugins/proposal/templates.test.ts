import { describe, expect, it } from 'vitest'

import { isDeckTheme } from './deck/themes'
import {
  BUILTIN_PROPOSAL_TEMPLATES,
  DEFAULT_PROPOSAL_TEMPLATE,
  resolveProposalTemplate,
  showcasePreset,
  type ProposalTemplateDef,
} from './templates'

describe('showcasePreset', () => {
  it('项目选定的内置模板 → 模板自带的主题与结构', () => {
    expect(showcasePreset('qixu')).toEqual({ theme: 'qixu', framework: 'full' })
    expect(showcasePreset('noir')).toEqual({ theme: 'noir', framework: 'full' })
    expect(showcasePreset('quick')).toEqual({ theme: 'qixu', framework: 'budget' })
    expect(showcasePreset('azure')).toEqual({ theme: 'azure', framework: 'story' })
  })

  it('旧编号按 resolveProposalTemplate 的兼容表解析', () => {
    expect(showcasePreset('premium')).toEqual({ theme: 'noir', framework: 'full' })
    expect(showcasePreset('modern')).toEqual({ theme: 'qixu', framework: 'full' })
  })

  it('非法 / 空 / 不存在的模板标识返回 null，交给调用方回退到 qixu + full', () => {
    expect(showcasePreset(null)).toBeNull()
    expect(showcasePreset(undefined)).toBeNull()
    expect(showcasePreset('')).toBeNull()
    expect(showcasePreset('   ')).toBeNull()
    expect(showcasePreset('not-a-template')).toBeNull()
    expect(showcasePreset(42)).toBeNull()
  })

  it('施工交底模板不给业主方案用，返回 null', () => {
    expect(showcasePreset('construction')).toBeNull()
  })

  it('后台停用的模板不在清单里时同样回退', () => {
    const enabled = BUILTIN_PROPOSAL_TEMPLATES.filter((t) => t.value !== 'noir')
    expect(showcasePreset('noir', enabled)).toBeNull()
    expect(showcasePreset('qixu', enabled)).toEqual({ theme: 'qixu', framework: 'full' })
  })

  it('后台自定义模板按自己的主题与结构开场', () => {
    const custom: ProposalTemplateDef = {
      ...BUILTIN_PROPOSAL_TEMPLATES[0]!,
      value: 'custom-studio',
      theme: 'slate',
      framework: 'story',
    }
    expect(showcasePreset('custom-studio', [custom])).toEqual({
      theme: 'slate',
      framework: 'story',
    })
  })

  it('只返回主题与结构，不把模板名/描述带出去（业主可见页面不渲染内部模板信息）', () => {
    const preset = showcasePreset('noir')
    expect(Object.keys(preset ?? {}).sort()).toEqual(['framework', 'theme'])
    // 主题标识本来就会进 data-doc-style（首页现状一致），但模板名与描述不进预设
    const tpl = BUILTIN_PROPOSAL_TEMPLATES.find((t) => t.value === 'noir')!
    const serialized = JSON.stringify(preset)
    expect(serialized).not.toContain(tpl.label)
    expect(serialized).not.toContain(tpl.description)
  })

  it('内置清单里的业主模板都能解析出合法主题', () => {
    for (const t of BUILTIN_PROPOSAL_TEMPLATES.filter((x) => x.kind === 'owner')) {
      const preset = showcasePreset(t.value)
      expect(preset, t.value).not.toBeNull()
      expect(isDeckTheme(preset?.theme), `${t.value} 的主题`).toBe(true)
    }
  })

  it('默认模板始终能解析（回退目标本身有效）', () => {
    expect(resolveProposalTemplate(DEFAULT_PROPOSAL_TEMPLATE)).not.toBeNull()
    expect(showcasePreset(DEFAULT_PROPOSAL_TEMPLATE)).not.toBeNull()
  })
})
