const SHARE_POSTER_IMAGE = '/assets/share-poster.png'
const SHARE_TITLE = 'AI出题小助手：30秒生成可打印练习卷'

function enableShareMenu() {
  if (!wx.showShareMenu) return
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
}

function appShare(inviteCode = '') {
  const query = inviteCode ? `?inviteCode=${inviteCode}` : ''
  return {
    title: SHARE_TITLE,
    path: `/pages/index/index${query}`,
    imageUrl: SHARE_POSTER_IMAGE
  }
}

function timelineShare(inviteCode = '') {
  return {
    title: SHARE_TITLE,
    query: inviteCode ? `inviteCode=${inviteCode}` : '',
    imageUrl: SHARE_POSTER_IMAGE
  }
}

module.exports = {
  SHARE_POSTER_IMAGE,
  SHARE_TITLE,
  enableShareMenu,
  appShare,
  timelineShare
}
