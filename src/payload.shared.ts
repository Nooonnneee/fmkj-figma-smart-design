import type { Config } from 'payload'
import path from 'path'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { en as adminLanguage } from '@payloadcms/translations/languages/en'
import { fileURLToPath } from 'url'
import { Admins } from './collections/Admins'
import { Brands } from './collections/Brands'
import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Products } from './collections/Products'
import { Projects } from './collections/Projects'
import { Quotes } from './collections/Quotes'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { CompanySettings } from './globals/CompanySettings'
import { dwgConverterPlugin } from './plugins/dwg-converter'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Figma 托管版（payload.config.ts）和自建服务器版（payload.selfhost.config.ts）共用的配置。
 * 新增集合、全局配置、插件都加在这里，两边自动保持一致。
 * 数据库、存储、密钥这些和运行环境有关的部分不放在这里。
 */
export const sharedConfig = {
  admin: {
    user: Admins.slug,
    constrainWidth: true,
    dashboard: {
      widgets: [],
      defaultLayout: [
        { widgetSlug: 'activity', width: 'full' },
        { widgetSlug: 'collections', width: 'full' },
      ],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  i18n: {
    fallbackLanguage: 'en',
    supportedLanguages: { 'en': adminLanguage },
  },
  collections: [Admins, Users, Projects, Quotes, Products, Brands, Categories, Media, Folders, Tags],
  globals: [CompanySettings],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  localization: {
    locales: [{ code: 'en', label: 'English' }],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [
    mcpPlugin({}),
    // DWG 转户型图：配置 DWG_CONVERTER_URL 后启用，删掉这一行即卸载
    dwgConverterPlugin({ endpoint: process.env.DWG_CONVERTER_URL, token: process.env.DWG_CONVERTER_TOKEN }),
  ],
} satisfies Partial<Config>
