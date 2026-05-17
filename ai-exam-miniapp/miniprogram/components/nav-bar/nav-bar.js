Component({
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: false },
    transparent: { type: Boolean, value: false }
  },
  data: {
    statusBarHeight: 44,
    navHeight: 44,
    menuRight: 12,
    menuWidth: 88
  },
  lifetimes: {
    attached() {
      try {
        const sys = wx.getSystemInfoSync()
        const menu = wx.getMenuButtonBoundingClientRect()
        const navHeight = (menu.top - sys.statusBarHeight) * 2 + menu.height
        this.setData({
          statusBarHeight: sys.statusBarHeight,
          navHeight,
          menuRight: sys.windowWidth - menu.right,
          menuWidth: menu.width
        })
      } catch (e) {}
    }
  },
  methods: {
    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) wx.navigateBack()
      else wx.redirectTo({ url: '/pages/index/index' })
    }
  }
})
