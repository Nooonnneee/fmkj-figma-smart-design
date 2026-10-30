/** 打开网页打印页（报价单、合同、点位图、方案）。地址带一次性票据，需在小程序后台配置业务域名。 */
Page({
  data: { src: '' },
  onLoad(query) {
    if (query.title) wx.setNavigationBarTitle({ title: decodeURIComponent(query.title) })
    this.setData({ src: decodeURIComponent(query.src || '') })
  },
})
