const { groupBySection, sampleWorksheet } = require('../../utils/worksheet')
const storage = require('../../utils/storage')
const api = require('../../services/api')
const billing = require('../../utils/billing')
const { enrichQuestionMath } = require('../../utils/math-format')
const modal = require('../../utils/modal')
const share = require('../../utils/share')

const SHARE_STATUS_CLEAR_MS = 2600

function buildViewModel(worksheet) {
  const source = worksheet || sampleWorksheet('', { mode: 'normal', questionCount: 9 })
  const questions = (source.questions || []).map(enrichQuestionMath)
  const isExamSimulation = source.mode === 'exam_simulation'
  return {
    worksheet: { ...source, questions },
    sections: groupBySection(questions).map(section => ({ ...section, questionCount: section.questions.length })),
    answerItems: questions.map((q, index) => ({ ...q, expanded: index < 3 })),
    isExamSimulation,
    modeLabel: isExamSimulation ? '整卷仿真' : '普通练习',
    modeDesc: isExamSimulation ? '结构相似、知识点相似、难度相近，不复制原题。' : '按输入要求生成，可直接打印练习。'
  }
}

function setTemporaryShareStatus(page, message) {
  if (page.shareStatusTimer) clearTimeout(page.shareStatusTimer)
  page.setData({ shareStatusText: message })
  page.shareStatusTimer = setTimeout(() => {
    page.shareStatusTimer = null
    page.setData({ shareStatusText: '' })
  }, SHARE_STATUS_CLEAR_MS)
}

Page({
  data: {
    tab: 'student',
    worksheet: null,
    sections: [],
    answerItems: [],
    pdfUrl: '',
    wordUrl: '',
    memberPdfUrl: '',
    exportLoading: '',
    exportStatusText: '',
    isPaid: false,
    canDownloadWord: false,
    canRemoveWatermark: false,
    planCode: 'free',
    shareStatusText: '',
    loading: false
  },
  onLoad() {
    share.enableShareMenu()
    const payload = getApp().globalData.lastWorksheet || {}
    const worksheet = payload.worksheet || sampleWorksheet('', { mode: 'normal', questionCount: 9 })
    const member = storage.getMember()
    this.setData({
      ...buildViewModel(worksheet),
      pdfUrl: payload.pdfUrl || '',
      wordUrl: payload.wordUrl || '',
      memberPdfUrl: payload.memberPdfUrl || '',
      planCode: billing.getPlanCode(member),
      isPaid: billing.isPaidPlan(member),
      canRemoveWatermark: billing.canRemoveWatermark(member),
      canDownloadWord: billing.canDownloadWord(member)
    })
    if (storage.getToken()) {
      api.getMe().then(me => this.setData({
        planCode: me.planCode,
        isPaid: me.isPaid,
        canRemoveWatermark: me.canRemoveWatermark,
        canDownloadWord: me.canDownloadWord
      })).catch(() => {})
    }
  },
  onShow() {
    if (!this.shareRewardPending) return
    this.shareRewardPending = false
    const result = storage.claimDailyTimelineShareReward()
    setTemporaryShareStatus(this, result.message)
    modal.showTip(result.success ? '+1 点已到账' : '今日已奖励')
  },
  onShareAppMessage() {
    return share.appShare(storage.getInviteCode())
  },
  onShareTimeline() {
    return share.timelineShare(storage.getInviteCode())
  },
  markShareIntent() {
    this.shareRewardPending = true
    setTemporaryShareStatus(this, '分享完成后，奖励会自动到账。')
  },
  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }) },
  toggleAnswer(e) {
    const number = Number(e.currentTarget.dataset.number)
    this.setData({ answerItems: this.data.answerItems.map(item => item.number === number ? { ...item, expanded: !item.expanded } : item) })
  },
  syncExportUrls(nextUrls) {
    const app = getApp()
    const payload = app.globalData.lastWorksheet || {}
    app.globalData.lastWorksheet = { ...payload, ...nextUrls }
    this.setData(nextUrls)
  },
  async openPdf() {
    if (!this.data.worksheet || this.data.exportLoading) return
    const canRemoveWatermark = this.data.canRemoveWatermark
    const cachedUrl = canRemoveWatermark ? this.data.memberPdfUrl : this.data.pdfUrl
    this.setData({ exportLoading: 'pdf', exportStatusText: canRemoveWatermark ? '正在准备无水印 PDF...' : '正在准备带水印 PDF...' })
    try {
      let pdfUrl = cachedUrl
      if (!pdfUrl) {
        const res = await api.exportPdf(this.data.worksheet, { watermark: !canRemoveWatermark })
        if (!res || !res.success || !res.pdfUrl) throw new Error((res && res.message) || 'PDF 生成失败')
        pdfUrl = res.pdfUrl
        this.syncExportUrls(canRemoveWatermark ? { memberPdfUrl: pdfUrl } : { pdfUrl })
      }
      await api.downloadAndOpen(pdfUrl, 'pdf')
      this.setData({ exportStatusText: 'PDF 已打开。' })
    } catch (e) {
      this.setData({ exportStatusText: e.message || 'PDF 打开失败，请检查后端服务。' })
      modal.showError(e.message || 'PDF 打开失败，请检查后端服务。', { title: '打开失败' })
    } finally {
      this.setData({ exportLoading: '' })
    }
  },
  async openWord() {
    if (!this.data.worksheet || this.data.exportLoading) return
    if (!this.data.canDownloadWord) {
      modal.showConfirm({
        title: 'Word 下载仅 Pro / Teacher 可用',
        content: '升级后可下载可编辑 Word，并解锁无水印 PDF、完整答案解析和更多生成点数。',
        confirmText: '升级',
        success: res => { if (res.confirm) this.goPackages() }
      })
      return
    }
    this.setData({ exportLoading: 'word', exportStatusText: '正在准备 Word 可编辑版...' })
    try {
      let wordUrl = this.data.wordUrl
      if (!wordUrl) {
        const res = await api.exportDocx(this.data.worksheet)
        if (!res || !res.success || !res.wordUrl) throw new Error((res && res.message) || 'Word 生成失败')
        wordUrl = res.wordUrl
        this.syncExportUrls({ wordUrl })
      }
      await api.downloadAndOpen(wordUrl, 'docx')
      this.setData({ exportStatusText: 'Word 可编辑版已打开。' })
    } catch (e) {
      this.setData({ exportStatusText: e.message || 'Word 打开失败，请检查会员状态或后端服务。' })
      modal.showError(e.message || 'Word 打开失败，请检查会员状态或后端服务。', { title: '打开失败' })
    } finally {
      this.setData({ exportLoading: '' })
    }
  },
  async regenerate() {
    if (!this.data.worksheet || this.data.loading) { this.goHome(); return }
    const worksheet = this.data.worksheet
    const needPoints = Number(worksheet.cost && worksheet.cost.pointsUsed) || billing.getGenerationPointCost(worksheet.mode)
    if (storage.getPoints() < needPoints) {
      modal.showConfirm({ title: '点数不足', content: `本次生成需要 ${needPoints} 点，购买套餐或点数包后即可继续生成。`, confirmText: '购买', success: res => { if (res.confirm) this.goPackages() } })
      return
    }
    this.setData({ loading: true })
    try {
      const res = await api.generateWorksheet({
        prompt: `请基于《${worksheet.title}》重新生成一份同类练习卷，题型结构相似但不要复制原题。`,
        grade: worksheet.grade,
        subject: worksheet.subject,
        difficulty: (worksheet.questions && worksheet.questions[0] && worksheet.questions[0].difficulty) || '中等',
        mode: worksheet.mode,
        questionCount: (worksheet.questions || []).length || 10
      })
      if (!res || !res.success) throw new Error((res && res.message) || '重新生成失败')
      const nextWorksheet = res.worksheet || res.preview || res
      const payload = { worksheet: nextWorksheet, pdfUrl: res.pdfUrl || '', wordUrl: res.wordUrl || '', createdAt: new Date().toLocaleString() }
      getApp().globalData.lastWorksheet = payload
      this.setData({ ...buildViewModel(nextWorksheet), tab: 'student', pdfUrl: payload.pdfUrl, wordUrl: payload.wordUrl })
    } catch (e) {
      modal.showError(e.message || '请检查后端服务或网络配置。', { title: '重新生成失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  goHome() { wx.redirectTo({ url: '/pages/index/index' }) },
  goPackages() { wx.navigateTo({ url: '/pages/packages/packages' }) }
})
