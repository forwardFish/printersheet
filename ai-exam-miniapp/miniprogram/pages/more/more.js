Page({
  onShareAppMessage() {
    return { title: 'AI出题小助手：免费生成可打印练习卷', path: '/pages/index/index' }
  },
  shareApp() { wx.showShareMenu({ withShareTicket: true }); wx.showToast({ title: '点击右上角分享', icon: 'none' }) }
})
