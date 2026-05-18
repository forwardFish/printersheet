const modal = require('../../utils/modal')
const share = require('../../utils/share')

Page({
  onLoad() {
    share.enableShareMenu()
  },
  onShareAppMessage() {
    return share.appShare()
  },
  onShareTimeline() {
    return share.timelineShare()
  },
  shareApp() {
    share.enableShareMenu()
    modal.showTip('请点击右上角菜单，选择“分享到朋友圈”。')
  }
})
