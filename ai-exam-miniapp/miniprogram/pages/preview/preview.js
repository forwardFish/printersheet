const { groupBySection } = require('../../utils/worksheet')
const storage = require('../../utils/storage')
const api = require('../../services/api')
const billing = require('../../utils/billing')
const { enrichQuestionMath } = require('../../utils/math-format')
const modal = require('../../utils/modal')

function buildViewModel(worksheet) {
  if (!worksheet) {
    return {
      worksheet: null,
      sections: [],
      answerItems: [],
      isExamSimulation: false,
      modeLabel: '',
      modeDesc: '',
      blueprintSections: [],
      sourceStatusText: '',
      sourceNotice: ''
    }
  }
  const questions = (worksheet.questions || []).map(enrichQuestionMath)
  const isExamSimulation = worksheet.mode === 'exam_simulation'
  const sourceFileInfo = worksheet.sourceFileInfo || null
  const blueprint = worksheet.paperBlueprint || {}
  return {
    worksheet: { ...worksheet, questions },
    sections: groupBySection(questions).map(section => ({
      ...section,
      questionCount: section.questions.length
    })),
    answerItems: questions.map((q, index) => ({
      ...q,
      expanded: index < 3
    })),
    isExamSimulation,
    modeLabel: isExamSimulation ? '整卷仿真' : '普通练习',
    modeDesc: isExamSimulation ? '结构相似、知识点相似、难度相近，不复制原题。' : '按输入要求生成，可直接打印练习。',
    blueprintSections: (blueprint.sections || []).slice(0, 4),
    sourceStatusText: sourceFileInfo
      ? `${sourceFileInfo.name || '已上传资料'} · ${sourceFileInfo.parserStatus === 'placeholder' ? '占位解析' : '已解析'}`
      : '',
    sourceNotice: sourceFileInfo && sourceFileInfo.parserStatus === 'placeholder'
      ? '上传资料已进入生成流程；当前 OCR/扫描件解析为占位降级，不代表生成失败。'
      : ''
  }
}

Page({
  data: {
    tab: 'student',
    statusType: 'empty',
    statusMessage: '还没有可预览的练习卷，请先生成一份练习卷。',
    worksheet: null,
    sections: [],
    answerItems: [],
    isExamSimulation: false,
    modeLabel: '',
    modeDesc: '',
    blueprintSections: [],
    sourceStatusText: '',
    sourceNotice: '',
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
    const payload = getApp().globalData.lastWorksheet || {}
    const worksheet = payload.worksheet || null
    const member = storage.getMember()
    const viewModel = buildViewModel(worksheet)
    this.setData({
      ...viewModel,
      statusType: worksheet ? 'ready' : 'empty',
      statusMessage: worksheet ? '练习卷已生成，可切换学生版和答案解析版。' : '还没有可预览的练习卷，请先生成一份练习卷。',
      pdfUrl: payload.pdfUrl || '',
      wordUrl: payload.wordUrl || '',
      memberPdfUrl: payload.memberPdfUrl || '',
      planCode: billing.getPlanCode(member),
      isPaid: billing.isPaidPlan(member),
      canRemoveWatermark: billing.canRemoveWatermark(member),
      canDownloadWord: billing.canDownloadWord(member)
    })
  },
  onShow() {
    if (!this.shareRewardPending) return
    this.shareRewardPending = false
    const result = storage.claimDailyTimelineShareReward()
    this.setData({
      shareStatusText: result.message,
      statusType: result.success ? 'ready' : 'error',
      statusMessage: result.message
    })
    wx.showToast({ title: result.success ? '+1 点已到账' : '今日已奖励', icon: result.success ? 'success' : 'none' })
  },
  onShareAppMessage() {
    return {
      title: 'AI 出题小助手',
      path: `/pages/index/index?inviteCode=${storage.getInviteCode()}`
    }
  },
  onShareTimeline() {
    return {
      title: 'AI 出题小助手：生成可打印练习卷',
      query: `inviteCode=${storage.getInviteCode()}`
    }
  },
  markShareIntent() {
    this.shareRewardPending = true
    this.setData({ shareStatusText: '分享完成后，奖励会自动到账。' })
  },
  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }) },
  toggleAnswer(e) {
    const number = Number(e.currentTarget.dataset.number)
    this.setData({
      answerItems: this.data.answerItems.map(item => item.number === number ? { ...item, expanded: !item.expanded } : item)
    })
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
    this.setData({
      exportLoading: 'pdf',
      exportStatusText: canRemoveWatermark ? '正在生成无水印 PDF...' : '正在准备带水印 PDF...'
    })
    try {
      let pdfUrl = cachedUrl
      if (!pdfUrl) {
        const res = await api.exportPdf(this.data.worksheet, { watermark: !canRemoveWatermark })
        if (!res || !res.success || !res.pdfUrl) throw new Error((res && res.message) || 'PDF 生成失败')
        pdfUrl = res.pdfUrl
        this.syncExportUrls(canRemoveWatermark ? { memberPdfUrl: pdfUrl } : { pdfUrl })
      }
      await api.downloadAndOpen(pdfUrl, 'pdf')
      this.setData({ exportStatusText: canRemoveWatermark ? '无水印 PDF 已打开，未扣点。' : '带水印 PDF 已打开，未扣点。' })
    } catch (e) {
      this.setData({ exportStatusText: e.message || 'PDF 打开失败，请检查后端服务。' })
    } finally {
      this.setData({ exportLoading: '' })
    }
  },
  async openWord() {
    if (!this.data.worksheet || this.data.exportLoading) return
    if (!this.data.canDownloadWord) {
      modal.showConfirm({
        title: 'Word 下载仅 Pro / Teacher 用户可用',
        content: '升级后可下载可编辑 Word，并解锁无水印 PDF、完整答案解析和更多生成点数。',
        confirmText: '升级',
        success: res => { if (res.confirm) this.goPackages() }
      })
      this.setData({ exportStatusText: 'Word 下载不扣点，但仅 Pro / Teacher 用户可用。' })
      return
    }
    this.setData({ exportLoading: 'word', exportStatusText: '正在生成 Word 可编辑版...' })
    try {
      let wordUrl = this.data.wordUrl
      if (!wordUrl) {
        const res = await api.exportDocx(this.data.worksheet)
        if (!res || !res.success || !res.wordUrl) throw new Error((res && res.message) || 'Word 生成失败')
        wordUrl = res.wordUrl
        this.syncExportUrls({ wordUrl })
      }
      await api.downloadAndOpen(wordUrl, 'docx')
      this.setData({ exportStatusText: 'Word 可编辑版已打开，未扣点。' })
    } catch (e) {
      this.setData({ exportStatusText: e.message || 'Word 打开失败，请检查会员状态或后端服务。' })
    } finally {
      this.setData({ exportLoading: '' })
    }
  },
  async regenerate() {
    if (!this.data.worksheet || this.data.loading) {
      this.goHome()
      return
    }
    const worksheet = this.data.worksheet
    const needPoints = Number(worksheet.cost && worksheet.cost.pointsUsed) || billing.getGenerationPointCost(worksheet.mode)
    if (storage.getPoints() < needPoints) {
      modal.showConfirm({
        title: '点数不足',
        content: `本次生成需要 ${needPoints} 点，你当前剩余 ${storage.getPoints()} 点。购买套餐或点数包后即可继续生成。`,
        confirmText: '购买',
        success: res => { if (res.confirm) this.goPackages() }
      })
      return
    }
    this.setData({ loading: true, statusType: 'loading', statusMessage: '正在重新生成同类练习卷...' })
    try {
      const res = await api.generateWorksheet({
        prompt: `请基于「${worksheet.title}」重新生成一份同类练习卷，题型结构相似但不要复制原题。`,
        grade: worksheet.grade,
        subject: worksheet.subject,
        difficulty: (worksheet.questions && worksheet.questions[0] && worksheet.questions[0].difficulty) || '中等',
        mode: worksheet.mode,
        questionCount: (worksheet.questions || []).length || 10
      })
      if (!res || !res.success) throw new Error((res && res.message) || '重新生成失败')
      const nextWorksheet = res.worksheet || res.preview || res
      const pointsUsed = Number(res.pointsUsed || (res.cost && res.cost.pointsUsed) || needPoints)
      storage.consumePoints(pointsUsed, {
        type: 'generate_cost',
        relatedId: res.worksheetId || '',
        remark: '重新生成同类卷'
      })
      getApp().globalData.lastWorksheet = {
        worksheet: nextWorksheet,
        pdfUrl: res.pdfUrl || '',
        wordUrl: res.wordUrl || '',
        createdAt: new Date().toLocaleString()
      }
      storage.addRecord({
        title: nextWorksheet.title || 'AI 练习卷',
        worksheet: nextWorksheet,
        mode: nextWorksheet.mode,
        questionCount: (nextWorksheet.questions || []).length,
        pointsUsed,
        pdfUrl: res.pdfUrl || '',
        wordUrl: res.wordUrl || '',
        sourceFileInfo: nextWorksheet.sourceFileInfo || null,
        sourceFileName: nextWorksheet.sourceFileInfo ? nextWorksheet.sourceFileInfo.name : '',
        sourceFileType: nextWorksheet.sourceFileInfo ? nextWorksheet.sourceFileInfo.type : ''
      })
      this.setData({
        ...buildViewModel(nextWorksheet),
        tab: 'student',
        pdfUrl: res.pdfUrl || '',
        wordUrl: res.wordUrl || '',
        statusType: 'ready',
        statusMessage: `重新生成成功，已扣除 ${pointsUsed} 点。`
      })
    } catch (e) {
      this.setData({
        statusType: 'error',
        statusMessage: e.message || '重新生成失败，请检查后端服务或网络配置。'
      })
      modal.showMessage({ title: '重新生成失败', content: e.message || '请检查后端服务或网络配置。' })
    } finally {
      this.setData({ loading: false })
    }
  },
  copyInviteLink() {
    const link = `/pages/index/index?inviteCode=${storage.getInviteCode()}`
    wx.setClipboardData({
      data: link,
      success: () => {
        this.setData({ shareStatusText: '邀请链接已复制。好友通过你的链接首次购买成功，你获得 5 点奖励。' })
      }
    })
  },
  goHome() { wx.redirectTo({ url: '/pages/index/index' }) },
  goPackages() { wx.navigateTo({ url: '/pages/packages/packages' }) }
})
