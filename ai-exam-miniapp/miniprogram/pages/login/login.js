const storage = require('../../utils/storage')

function maskId(raw = '') {
  const text = String(raw || '').trim()
  return text ? text.slice(-6) : ''
}

Page({
  data: { agreed: false },
  toggleAgree() { this.setData({ agreed: !this.data.agreed }) },
  login() {
    if (!this.data.agreed) { wx.showToast({ title: '请先同意协议', icon: 'none' }); return }
    wx.getUserProfile({
      desc: '用于展示微信头像和昵称',
      success: profileRes => {
        wx.showLoading({ title: '登录中...' })
        wx.login({
          success: loginRes => {
            const userInfo = profileRes.userInfo || {}
            storage.setUser({
              nickname: userInfo.nickName || '微信用户',
              avatar: userInfo.avatarUrl || '/assets/avatar-guest.png',
              id: maskId(loginRes.code)
            })
            wx.hideLoading()
            wx.redirectTo({ url: '/pages/my/my' })
          },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '登录失败', icon: 'none' }) }
        })
      },
      fail: () => {
        wx.showToast({ title: '已取消', icon: 'none' })
      }
    })
  }
})
