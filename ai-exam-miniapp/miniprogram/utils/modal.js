function showMessage(options = {}) {
  return wx.showModal({
    ...options,
    showCancel: options.showCancel !== false,
    cancelText: options.cancelText || '关闭',
    confirmText: options.confirmText || '知道了'
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

function showTip(message, options = {}) {
  return wx.showModal({
    title: options.title || '提示',
    content: String(message || ''),
    showCancel: false,
    confirmText: options.confirmText || '知道了'
  })
}

function showError(message, options = {}) {
  return showTip(message || '操作失败', { title: options.title || '操作失败' })
}

module.exports = {
  showMessage,
  showConfirm,
  showTip,
  showError
}
