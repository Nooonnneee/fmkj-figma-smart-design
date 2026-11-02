/**
 * 服务器配置
 * BASE_URL 必须是 HTTPS，并且在「微信公众平台 → 开发管理 → 开发设置 → 服务器域名」里加入
 * request 合法域名、uploadFile 合法域名、downloadFile 合法域名；打开打印页还需要把同一域名加入「业务域名」。
 * 域名需要完成 ICP 备案（建议用自建服务器的域名，见 docs/wechat-miniprogram.md）。
 */
module.exports = {
  BASE_URL: 'https://fmkj.top',
  API_PREFIX: '/mp/v1',
  VERSION: '1.0.0',
}
