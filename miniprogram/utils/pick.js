/**
 * 选择一张图片：相册 / 拍照 / 微信聊天记录（CAD 图纸常从聊天里转发过来）。
 * 返回 { path, name }，取消时返回 null。
 */
function pickImage() {
  return new Promise((resolve) => {
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照', '从微信聊天选择'],
      success(res) {
        if (res.tapIndex === 2) {
          wx.chooseMessageFile({
            count: 1,
            type: 'image',
            success: (r) => resolve({ path: r.tempFiles[0].path, name: r.tempFiles[0].name || '户型图.png' }),
            fail: () => resolve(null),
          })
          return
        }
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: [res.tapIndex === 1 ? 'camera' : 'album'],
          sizeType: ['original'],
          success: (r) => resolve({ path: r.tempFiles[0].tempFilePath, name: '户型图.' + (r.tempFiles[0].tempFilePath.split('.').pop() || 'jpg') }),
          fail: () => resolve(null),
        })
      },
      fail: () => resolve(null),
    })
  })
}

module.exports = { pickImage }
