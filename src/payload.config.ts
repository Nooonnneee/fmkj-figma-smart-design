import { buildFigmaConfig } from '@payloadcms/figma'

import { sharedConfig } from './payload.shared'

// Figma Make 托管版：数据库和文件存储由 Figma 提供。
// 自建服务器用 payload.selfhost.config.ts（见 DEPLOY.md）。
export default buildFigmaConfig({
  ...sharedConfig,
  figma: {},
})
