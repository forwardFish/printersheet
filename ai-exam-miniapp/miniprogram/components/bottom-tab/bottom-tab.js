Component({
  properties: {
    active: { type: String, value: 'home' }
  },
  methods: {
    go(e) {
      const key = e.currentTarget.dataset.key
      const map = {
        home: '/pages/index/index',
        my: '/pages/my/my'
      }
      const url = map[key]
      if (!url) return
      const current = '/' + getCurrentPages()[getCurrentPages().length - 1].route
      if (current === url) return
      wx.redirectTo({ url })
    }
  }
})
