const storage = require('../../utils/storage')
const api = require('../../services/api')
const billing = require('../../utils/billing')
const modal = require('../../utils/modal')

const DEFAULT_PROMPT = '生成 5 道初一数学一元一次方程中等题，带答案解析，适合打印'
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const GRADE_GROUPS = [
  { name: '小学', items: ['小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级'] },
  { name: '初中', items: ['初一', '初二', '初三'] },
  { name: '高中', items: ['高一', '高二', '高三'] }
]
const PRIMARY_SUBJECT_OPTIONS = ['语文', '数学', '英语']
const SECONDARY_SUBJECT_OPTIONS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
const UPLOAD_TYPES = {
  pdf: { label: 'PDF', parserStatus: 'pending', hint: '后端将尝试提取 PDF 文本；扫描件会走占位降级。' },
  doc: { label: 'Word', parserStatus: 'pending', hint: '后端将尝试提取 Word 文本。' },
  docx: { label: 'Word', parserStatus: 'pending', hint: '后端将尝试提取 Word 文本。' },
  png: { label: '图片', parserStatus: 'placeholder', hint: '图片 OCR 暂未接入，本次会带着图片占位提示生成。' },
  jpg: { label: '图片', parserStatus: 'placeholder', hint: '图片 OCR 暂未接入，本次会带着图片占位提示生成。' },
  jpeg: { label: '图片', parserStatus: 'placeholder', hint: '图片 OCR 暂未接入，本次会带着图片占位提示生成。' },
  webp: { label: '图片', parserStatus: 'placeholder', hint: '图片 OCR 暂未接入，本次会带着图片占位提示生成。' }
}

function getExtension(file) {
  const name = file.name || file.path || ''
  const match = /\.([a-z0-9]+)$/i.exec(name)
  return match ? match[1].toLowerCase() : ''
}

function formatFileSize(size) {
  if (!size) return '大小未知'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function buildUploadMeta(file) {
  const ext = getExtension(file)
  const type = UPLOAD_TYPES[ext]
  if (!type) return { valid: false, reason: '仅支持 PDF、Word、PNG、JPG、JPEG、WEBP 文件。' }
  if (file.size > MAX_UPLOAD_SIZE) return { valid: false, reason: '文件不能超过 10MB，请压缩后再上传。' }
  return {
    valid: true,
    path: file.path,
    name: file.name || `已上传资料.${ext}`,
    size: file.size || 0,
    sizeLabel: formatFileSize(file.size),
    extension: ext,
    typeLabel: type.label,
    parserStatus: type.parserStatus,
    parserHint: type.hint
  }
}

function modePatch(mode) {
  const info = billing.getGenerationMode(mode)
  return {
    mode: info.id,
    questionCount: info.questionCount,
    currentModeLabel: info.label,
    currentModeCost: info.cost,
    currentModeDesc: info.desc,
    generateButtonText: info.buttonText
  }
}

function isPrimaryGrade(grade) {
  return String(grade || '').indexOf('小学') === 0
}

function subjectOptionsForGrade(grade) {
  return isPrimaryGrade(grade) ? PRIMARY_SUBJECT_OPTIONS : SECONDARY_SUBJECT_OPTIONS
}

function normalizeSubjectForGrade(subject, grade) {
  const options = subjectOptionsForGrade(grade)
  return options.includes(subject) ? subject : '数学'
}

Page({
  data: {
    prompt: '',
    points: 3,
    grade: '初一',
    subject: '数学',
    difficulty: '中等',
    openDropdown: '',
    gradeGroups: GRADE_GROUPS,
    subjectOptions: subjectOptionsForGrade('初一'),
    filePath: '',
    fileName: '',
    fileSize: 0,
    fileSizeLabel: '',
    fileExtension: '',
    fileTypeLabel: '',
    fileParseStatus: '',
    fileParseHint: '',
    loading: false,
    showMore: true,
    generationModes: billing.GENERATION_MODES,
    ...modePatch('normal'),
    simulationPageCount: 1,
    pageCountOptions: [1, 2, 3, 4, 5, 6],
    statusType: 'empty',
    statusMessage: '输入要求或上传资料后，可生成可打印练习卷。',
    lastWorksheetTitle: '',
    lastWorksheetMeta: '',
    hasLastWorksheet: false,
    promptExamples: [
      DEFAULT_PROMPT,
      '根据小学五年级分数加减法生成 8 道易错题，附答案',
      '上传试卷后做整卷仿真，生成同结构、同难度的新卷'
    ]
  },
  onLoad(options = {}) {
    if (options.inviteCode) storage.bindInviter(options.inviteCode)
  },
  onShow() {
    this.refreshPageState()
  },
  refreshPageState() {
    const payload = getApp().globalData.lastWorksheet || {}
    const worksheet = payload.worksheet || null
    this.setData({
      points: storage.getPoints(),
      hasLastWorksheet: !!worksheet,
      lastWorksheetTitle: worksheet ? (worksheet.title || '最近生成的练习卷') : '',
      lastWorksheetMeta: worksheet ? `${worksheet.grade || this.data.grade} · ${worksheet.subject || this.data.subject} · ${(worksheet.questions || []).length} 题` : ''
    })
  },
  onPromptInput(e) {
    this.setData({
      prompt: e.detail.value,
      statusType: 'empty',
      statusMessage: '输入完成后点击生成，系统会自动排版为练习卷。'
    })
  },
  useExample(e) {
    const prompt = e.currentTarget.dataset.prompt
    this.setData({ prompt, ...(prompt.includes('整卷仿真') ? modePatch('full_paper_simulation') : {}) })
  },
  toggleMore() {
    this.setData({ showMore: !this.data.showMore })
  },
  selectMode(e) {
    const mode = e.currentTarget.dataset.mode
    const info = billing.getGenerationMode(mode)
    this.setData({
      ...modePatch(mode),
      statusType: 'empty',
      statusMessage: mode === 'full_paper_simulation'
        ? '整卷仿真最多上传 5 页，系统会生成同结构新题，不复制原题。'
        : mode === 'upload_material'
          ? '上传资料生成需要先选择 PDF、Word 或图片资料。'
          : `${info.label}将消耗 ${info.cost} 点。`
    })
  },
  selectSimulationPageCount(e) {
    const count = Number(e.currentTarget.dataset.count)
    this.setData({
      simulationPageCount: count,
      statusType: count > 5 ? 'error' : 'empty',
      statusMessage: count > 5
        ? '当前版本最多支持上传 5 页试卷进行整卷仿真。如试卷较长，请先拆分后上传。'
        : '整卷仿真会根据原卷结构、题型和难度生成新的练习卷。'
    })
  },
  chooseGrade() {
    this.setData({ openDropdown: this.data.openDropdown === 'grade' ? '' : 'grade' })
  },
  chooseSubject() {
    this.setData({ openDropdown: this.data.openDropdown === 'subject' ? '' : 'subject' })
  },
  selectGrade(e) {
    const grade = e.currentTarget.dataset.value
    const subjectOptions = subjectOptionsForGrade(grade)
    this.setData({
      grade,
      subjectOptions,
      subject: normalizeSubjectForGrade(this.data.subject, grade),
      openDropdown: ''
    })
  },
  selectSubject(e) {
    this.setData({ subject: e.currentTarget.dataset.value, openDropdown: '' })
  },
  chooseDifficulty() {
    const list = ['简单', '中等', '困难', '混合']
    wx.showActionSheet({ itemList: list, success: res => this.setData({ difficulty: list[res.tapIndex] }) })
  },
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: Object.keys(UPLOAD_TYPES),
      success: res => {
        const file = res.tempFiles[0]
        if (!file) return
        const meta = buildUploadMeta(file)
        if (!meta.valid) {
          this.setData({ statusType: 'error', statusMessage: meta.reason })
          modal.showMessage({ title: '无法使用该文件', content: meta.reason })
          return
        }
        const nextMode = this.data.mode === 'normal' ? 'upload_material' : this.data.mode
        this.setData({
          filePath: meta.path,
          fileName: meta.name,
          fileSize: meta.size,
          fileSizeLabel: meta.sizeLabel,
          fileExtension: meta.extension,
          fileTypeLabel: meta.typeLabel,
          fileParseStatus: meta.parserStatus,
          fileParseHint: meta.parserHint,
          ...modePatch(nextMode),
          statusType: 'ready',
          statusMessage: meta.parserStatus === 'placeholder'
            ? '图片资料已选择；当前会使用 OCR 占位降级提示进入生成流程。'
            : '资料已选择；生成时会上传到后端临时解析，完成后清理临时文件。'
        })
      },
      fail: () => {
        this.setData({ statusType: 'empty', statusMessage: '未选择文件，可继续用文字要求生成。' })
      }
    })
  },
  removeFile() {
    this.setData({
      filePath: '',
      fileName: '',
      fileSize: 0,
      fileSizeLabel: '',
      fileExtension: '',
      fileTypeLabel: '',
      fileParseStatus: '',
      fileParseHint: '',
      statusType: 'empty',
      statusMessage: '已移除资料，可继续用文字要求生成。'
    })
  },
  goPackages() {
    wx.navigateTo({ url: '/pages/packages/packages' })
  },
  goPreview() {
    if (!this.data.hasLastWorksheet) return
    wx.navigateTo({ url: '/pages/preview/preview' })
  },
  async handleGenerate() {
    if (this.data.loading) return
    const prompt = (this.data.prompt || '').trim()
    if (!prompt && !this.data.filePath) {
      this.setData({ statusType: 'error', statusMessage: '请先输入出题要求，或上传 PDF / Word / 图片资料。' })
      return
    }
    if ((this.data.mode === 'upload_material' || this.data.mode === 'full_paper_simulation') && !this.data.filePath) {
      const title = this.data.mode === 'full_paper_simulation' ? '需要上传试卷' : '需要上传资料'
      this.setData({ statusType: 'error', statusMessage: '请先上传 PDF、Word 或图片资料。' })
      modal.showMessage({ title, content: '上传资料生成和整卷仿真需要先上传 PDF、Word 或图片资料。' })
      return
    }
    if (this.data.mode === 'full_paper_simulation' && this.data.simulationPageCount > 5) {
      const message = '当前版本最多支持上传 5 页试卷进行整卷仿真。如试卷较长，请先拆分后上传。'
      this.setData({ statusType: 'error', statusMessage: message })
      modal.showMessage({ title: '上传页数超限', content: message })
      return
    }
    const needPoints = billing.getGenerationPointCost(this.data.mode)
    if (storage.getPoints() < needPoints) {
      const message = `点数不足，本次生成需要 ${needPoints} 点。请购买套餐或点数包后继续生成。`
      this.setData({ statusType: 'error', statusMessage: message })
      modal.showConfirm({
        title: '点数不足',
        content: `本次生成需要 ${needPoints} 点，你当前剩余 ${storage.getPoints()} 点。购买套餐或点数包后即可继续生成。`,
        confirmText: '购买',
        success: res => { if (res.confirm) this.goPackages() }
      })
      return
    }
    this.setData({
      loading: true,
      statusType: 'loading',
      statusMessage: '正在生成练习卷，稍后将进入预览页。'
    })
    try {
      const mergedPrompt = [
        prompt || DEFAULT_PROMPT,
        `年级：${this.data.grade}`,
        `学科：${this.data.subject}`,
        `难度：${this.data.difficulty}`,
        `题量：${this.data.questionCount}`,
        `生成类型：${billing.getGenerationModeLabel(this.data.mode)}`,
        this.data.mode === 'full_paper_simulation'
          ? '整卷仿真要求：分析原卷结构、题型、知识点和难度，生成新的同结构练习卷，不复制原题。'
          : ''
      ].filter(Boolean).join('\n')
      const res = await api.generateWorksheet({
        prompt: mergedPrompt,
        filePath: this.data.filePath,
        fileName: this.data.fileName,
        fileType: this.data.fileTypeLabel,
        fileSize: this.data.fileSize,
        fileExtension: this.data.fileExtension,
        grade: this.data.grade,
        subject: this.data.subject,
        difficulty: this.data.difficulty,
        mode: this.data.mode,
        questionCount: this.data.questionCount
      })
      if (!res || !res.success) throw new Error((res && res.message) || '生成失败')
      const pointsUsed = Number(res.pointsUsed || (res.cost && res.cost.pointsUsed) || needPoints)
      storage.consumePoints(pointsUsed, {
        type: 'generate_cost',
        relatedId: res.worksheetId || '',
        remark: billing.getGenerationModeLabel(this.data.mode)
      })
      const worksheet = res.worksheet || res.preview || res
      const payload = {
        worksheet,
        pdfUrl: res.pdfUrl || '',
        wordUrl: res.wordUrl || '',
        sourceFileInfo: worksheet.sourceFileInfo || null,
        createdAt: new Date().toLocaleString()
      }
      getApp().globalData.lastWorksheet = payload
      storage.addRecord({
        title: worksheet.title || 'AI 练习卷',
        worksheet,
        mode: this.data.mode,
        questionCount: (worksheet.questions || []).length,
        pointsUsed,
        pdfUrl: payload.pdfUrl,
        wordUrl: payload.wordUrl,
        sourceFileInfo: payload.sourceFileInfo,
        sourceFileName: payload.sourceFileInfo ? payload.sourceFileInfo.name : this.data.fileName,
        sourceFileType: payload.sourceFileInfo ? payload.sourceFileInfo.type : this.data.fileTypeLabel
      })
      this.setData({
        statusType: 'success',
        statusMessage: `生成成功，已扣除 ${pointsUsed} 点。`,
        points: storage.getPoints()
      })
      wx.navigateTo({ url: '/pages/preview/preview' })
    } catch (e) {
      this.setData({
        statusType: 'error',
        statusMessage: e.message || '生成失败，请检查后端服务或网络配置。'
      })
      modal.showMessage({ title: '生成失败', content: e.message || '请检查后端服务或网络配置。' })
    } finally {
      this.setData({ loading: false, points: storage.getPoints() })
    }
  }
})
