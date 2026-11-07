import { APP_NAME } from './brand'

/** 品牌小程序入口与公司联系二维码分别使用，避免混淆用途。 */
export const MINI_APP_CODE_URL = '/brand/dreamstars-miniapp-code.jpg'

export function miniAppCodeForCompany(companyName: string): string | null {
  return companyName.replace(/\s/g, '').startsWith(APP_NAME) ? MINI_APP_CODE_URL : null
}
