App({
  globalData: {
    lastWorksheet: null,
    selectedPlan: null,
    purchaseReturn: null,
    pendingGenerationDraft: null
  },
  onLaunch(options = {}) {
    const storage = require('./utils/storage')
    storage.initDefaults()
    const inviteCode = options.query && options.query.inviteCode
    if (inviteCode) storage.bindInviter(inviteCode)
  }
})
