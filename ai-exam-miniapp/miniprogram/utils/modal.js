function showMessage(options = {}) {
  return wx.showModal({
    ...options,
    showCancel: true,
    cancelText: options.cancelText || '关闭',
    confirmText: options.confirmText || '知道'
  })
}

function showConfirm(options = {}) {
  return wx.showModal({
    ...options,
    showCancel: true,
    cancelText: options.cancelText || '取消',
    confirmText: options.confirmText || '确定'
  })
}

module.exports = {
  showMessage,
  showConfirm
}
