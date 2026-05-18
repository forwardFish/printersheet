const storage = require('../../utils/storage')
const api = require('../../services/api')
const billing = require('../../utils/billing')
const modal = require('../../utils/modal')
const config = require('../../utils/config')
const share = require('../../utils/share')

const DEFAULT_PROMPT = '生成 5 道初一数学一元一次方程中等题，带答案解析，适合打印'
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const TASK_STORAGE_KEY = 'generation_tasks_v1'
const JOB_POLL_INTERVAL_MS = 1800
const MAX_ACTIVE_GENERATION_TASKS = 2
const JOB_MAX_PENDING_MS = 10 * 60 * 1000
const MAX_JOB_POLL_FAILURES = 5
const MAX_VISIBLE_GENERATION_TASKS = 3
const GRADE_GROUPS = [
  { name: '小学', items: ['小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级'] },
  { name: '初中', items: ['初一', '初二', '初三'] },
  { name: '高中', items: ['高一', '高二', '高三'] }
]
const PRIMARY_SUBJECT_OPTIONS = ['语文', '数学', '英语']
const SECONDARY_SUBJECT_OPTIONS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
const SUBJECT_KEYWORDS = [
  ['物理', ['物理', '声现象', '声音', '光学', '力学', '电路', '电学', '压强', '浮力']],
  ['化学', ['化学', '化合', '分解', '溶液', '方程式', '氧气', '氢气', '元素']],
  ['生物', ['生物', '细胞', '植物', '动物', '生态', '遗传']],
  ['历史', ['历史', '朝代', '近代史', '古代史']],
  ['地理', ['地理', '经纬', '气候', '地形', '地图']],
  ['政治', ['政治', '道德与法治', '法治']],
  ['英语', ['英语', '单词', '语法', '阅读理解', '完形填空']],
  ['语文', ['语文', '古诗', '文言文', '阅读', '作文']],
  ['数学', ['数学', '方程', '函数', '几何', '代数', '计算']]
]
const GRADE_KEYWORDS = [
  ['小学一年级', ['小学一年级', '一年级']],
  ['小学二年级', ['小学二年级', '二年级']],
  ['小学三年级', ['小学三年级', '三年级']],
  ['小学四年级', ['小学四年级', '四年级']],
  ['小学五年级', ['小学五年级', '五年级']],
  ['小学六年级', ['小学六年级', '六年级']],
  ['初一', ['初一', '七年级', '初中一年级']],
  ['初二', ['初二', '八年级', '初中二年级']],
  ['初三', ['初三', '九年级', '初中三年级']],
  ['高一', ['高一', '高中一年级']],
  ['高二', ['高二', '高中二年级']],
  ['高三', ['高三', '高中三年级']]
]
const TASK_KEYWORDS = ['生成', '出题', '练习', '练习卷', '试卷', '题目', '题', '卷', '一套']
const DETAIL_KEYWORDS = ['知识点', '考点', '答案', '解析', '打印', '专题', '单元', '章节', '课', '课文', '实验']
const PROMPT_SUGGESTIONS = [
  '生成 5 道初二物理声音现象中等题，带答案解析，适合打印',
  '生成 8 道初三历史法治相关选择题，附答案解析',
  '生成 10 道初一数学一元一次方程基础题，带答案'
]
const UPLOAD_TYPES = {
  pdf: { label: 'PDF', parserStatus: 'pending', hint: '后端会尝试提取 PDF 文本。' },
  doc: { label: 'Word', parserStatus: 'pending', hint: '后端会尝试提取 Word 文本。' },
  docx: { label: 'Word', parserStatus: 'pending', hint: '后端会尝试提取 Word 文本。' },
  png: { label: '图片', parserStatus: 'placeholder', hint: '图片 OCR 暂未接入，本地阶段会用占位提示进入生成。' },
  jpg: { label: '图片', parserStatus: 'placeholder', hint: '图片 OCR 暂未接入，本地阶段会用占位提示进入生成。' },
  jpeg: { label: '图片', parserStatus: 'placeholder', hint: '图片 OCR 暂未接入，本地阶段会用占位提示进入生成。' },
  webp: { label: '图片', parserStatus: 'placeholder', hint: '图片 OCR 暂未接入，本地阶段会用占位提示进入生成。' }
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
  return { valid: true, path: file.path, name: file.name || `已上传资料.${ext}`, size: file.size || 0, sizeLabel: formatFileSize(file.size), extension: ext, typeLabel: type.label, parserStatus: type.parserStatus, parserHint: type.hint }
}
function modePatch(mode) {
  const info = billing.getGenerationMode(mode)
  return { mode: info.id, questionCount: info.questionCount, currentModeLabel: info.label, currentModeCost: info.cost, currentModeDesc: info.desc, generateButtonText: info.buttonText }
}
function isPrimaryGrade(grade) { return String(grade || '').indexOf('小学') === 0 }
function subjectOptionsForGrade(grade) { return isPrimaryGrade(grade) ? PRIMARY_SUBJECT_OPTIONS : SECONDARY_SUBJECT_OPTIONS }
function normalizeSubjectForGrade(subject, grade) {
  const options = subjectOptionsForGrade(grade)
  return options.includes(subject) ? subject : '数学'
}

function canGenerateFrom({ prompt = '', filePath = '' } = {}) {
  return !!(String(prompt || '').trim() || filePath)
}

function keywordHit(text, groups) {
  return groups.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)))
}

function promptIncludesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword))
}

function inferPromptMeta(prompt = '') {
  const text = String(prompt || '')
  const subjectMatch = keywordHit(text, SUBJECT_KEYWORDS)
  const gradeMatch = keywordHit(text, GRADE_KEYWORDS)
  let grade = gradeMatch ? gradeMatch[0] : ''
  const subject = subjectMatch ? subjectMatch[0] : ''
  if (!grade && text.includes('初中')) grade = subject === '物理' ? '初二' : '初一'
  if (!grade && text.includes('高中')) grade = '高一'
  if (!grade && text.includes('小学')) grade = '小学六年级'
  const difficulty = text.includes('简单') || text.includes('基础') ? '简单'
    : text.includes('困难') || text.includes('拔高') || text.includes('压轴') ? '困难'
      : text.includes('混合') || text.includes('综合') ? '混合'
        : text.includes('中等') ? '中等' : ''
  return { grade, subject, difficulty }
}

function assessPrompt(prompt = '', context = {}) {
  const text = String(prompt || '').trim()
  if (!text) return { state: 'empty', hint: '', allowGenerate: false, suggestions: [] }
  const inferred = inferPromptMeta(text)
  const hasSubject = !!inferred.subject
  const hasGrade = !!inferred.grade || text.includes('初中') || text.includes('高中') || text.includes('小学')
  const hasTask = promptIncludesAny(text, TASK_KEYWORDS)
  const hasDetail = promptIncludesAny(text, DETAIL_KEYWORDS)
  const hasSchoolSignal = hasSubject || hasGrade || hasDetail
  const hasSelectedContext = !!(context.grade && context.subject)
  const enoughForReady = hasSubject && (hasGrade || hasDetail || text.length >= 8)
  const knowledgeWithSelectedContext = hasSelectedContext && hasSubject && text.length >= 4
  const chapterWithSelectedContext = hasSelectedContext && hasDetail && text.length >= 3
  const shortNaturalInputWithContext = hasSelectedContext && text.length >= 4

  if ((hasTask && enoughForReady) || knowledgeWithSelectedContext || chapterWithSelectedContext || shortNaturalInputWithContext) {
    return { state: 'ready', hint: '', allowGenerate: true, suggestions: [] }
  }
  if (hasSchoolSignal || hasTask) {
    return {
      state: 'needs_detail',
      hint: '请补充学科、年级或知识点后再生成。',
      allowGenerate: false,
      suggestions: []
    }
  }
  return {
    state: 'invalid',
    hint: '没有识别到明确的出题要求，请换成“年级 + 学科 + 知识点”的表达。',
    allowGenerate: false,
    suggestions: PROMPT_SUGGESTIONS
  }
}

function applyPromptMeta(data, prompt = '') {
  const assessment = assessPrompt(prompt, data)
  if (assessment.state !== 'ready') return { patch: {}, applied: [], assessment }
  const inferred = inferPromptMeta(prompt)
  const patch = {}
  const applied = []
  if (inferred.grade && inferred.grade !== data.grade) {
    patch.grade = inferred.grade
    patch.subjectOptions = subjectOptionsForGrade(inferred.grade)
    applied.push(inferred.grade)
  }
  const nextGrade = patch.grade || data.grade
  if (inferred.subject) {
    const options = patch.subjectOptions || subjectOptionsForGrade(nextGrade)
    if (options.includes(inferred.subject) && inferred.subject !== data.subject) {
      patch.subject = inferred.subject
      applied.push(inferred.subject)
    }
  }
  if (inferred.difficulty && inferred.difficulty !== data.difficulty) {
    patch.difficulty = inferred.difficulty
    applied.push(inferred.difficulty)
  }
  return { patch, applied, assessment }
}

function loadLocalTasks() {
  try {
    const tasks = wx.getStorageSync(TASK_STORAGE_KEY)
    return Array.isArray(tasks) ? tasks : []
  } catch (e) {
    return []
  }
}

function saveLocalTasks(tasks = []) {
  wx.setStorageSync(TASK_STORAGE_KEY, tasks.slice(0, 20))
}

function normalizeJob(job = {}, fallback = {}) {
  const result = job.result || fallback.result || null
  const worksheet = result && (result.worksheet || result.preview || result)
  const clientCreatedAt = Number(job.clientCreatedAt || fallback.clientCreatedAt || Date.now())
  const prompt = String(job.prompt || fallback.prompt || '').split('\n')[0]
  return {
    id: job.id || job.jobId || fallback.id || fallback.jobId || '',
    jobId: job.jobId || job.id || fallback.jobId || fallback.id || '',
    requestId: job.requestId || fallback.requestId || '',
    prompt,
    grade: job.grade || fallback.grade || '',
    subject: job.subject || fallback.subject || '',
    mode: job.mode || fallback.mode || '',
    modeLabel: fallback.modeLabel || billing.getGenerationModeLabel(job.mode || fallback.mode || 'normal'),
    questionCount: Number(job.questionCount || fallback.questionCount || 0),
    status: job.status || fallback.status || 'queued',
    progress: Number(job.progress || fallback.progress || 0),
    message: job.message || fallback.message || '',
    errorMessage: job.errorMessage || fallback.errorMessage || (job.error && job.error.message) || '',
    result,
    worksheet,
    pdfUrl: result && result.pdfUrl || fallback.pdfUrl || '',
    wordUrl: result && result.wordUrl || fallback.wordUrl || '',
    signature: job.signature || fallback.signature || '',
    clientCreatedAt,
    createdAt: job.createdAt || fallback.createdAt || new Date().toLocaleString(),
    updatedAt: job.updatedAt || fallback.updatedAt || ''
  }
}

function formatGenerationFailureMessage(message = '') {
  const text = String(message || '').trim()
  if (!text) return '本次没有生成成功，不会扣点。请稍后再试。'
  const lower = text.toLowerCase()
  if (text.includes('超时') || lower.includes('timeout')) {
    return '出题服务响应超时，本次没有生成成功，不会扣点。请稍后再试。'
  }
  if (text.includes('未配置') || text.includes('禁止使用') || text.includes('demo/mock') || lower.includes('api_key') || lower.includes('api key')) {
    return '出题服务暂时不可用，本次没有生成成功，不会扣点。请稍后再试。'
  }
  if (text.includes('DeepSeek') || text.includes('AI 接口') || lower.includes('http') || lower.includes('upstream') || lower.includes('ai generation')) {
    return '出题服务暂时繁忙，本次没有生成成功，不会扣点。请稍后再试。'
  }
  return text.length > 48 ? '本次没有生成成功，不会扣点。请稍后再试。' : text
}

function isActiveTask(task) {
  return ['queued', 'running'].includes(String(task && task.status || ''))
}

function isLockedTask(task) {
  return !!(task && task.signature && task.status)
}

function generationSignature(data = {}, promptValue) {
  const prompt = String(promptValue !== undefined ? promptValue : data.prompt || '').trim()
  if (!prompt && !data.filePath) return ''
  return JSON.stringify({
    prompt,
    grade: data.grade || '',
    subject: data.subject || '',
    difficulty: data.difficulty || '',
    mode: data.mode || '',
    questionCount: Number(data.questionCount || 0),
    fileName: data.fileName || '',
    fileSize: Number(data.fileSize || 0)
  })
}

function buildSubmitPatch(data = {}) {
  const currentGenerationSignature = generationSignature(data)
  const duplicateGenerationLocked = !!currentGenerationSignature && (data.generationTasks || [])
    .some(task => task.signature === currentGenerationSignature && isLockedTask(task))
  const submitButtonText = data.loading
    ? '正在创建任务...'
    : duplicateGenerationLocked
      ? '已加入生成队列'
    : data.queueFull
        ? `已有 ${MAX_ACTIVE_GENERATION_TASKS} 个任务生成中`
        : data.generateButtonText
  return { currentGenerationSignature, duplicateGenerationLocked, submitButtonText }
}

function buildTaskListPatch(tasks = []) {
  const list = Array.isArray(tasks) ? tasks : []
  const hiddenGenerationTaskCount = Math.max(0, list.length - MAX_VISIBLE_GENERATION_TASKS)
  return {
    visibleGenerationTasks: list.slice(0, MAX_VISIBLE_GENERATION_TASKS),
    hasMoreGenerationTasks: hiddenGenerationTaskCount > 0,
    hiddenGenerationTaskCount
  }
}

Page({
  jobPollTimers: {},
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
    canGenerate: false,
    currentGenerationSignature: '',
    duplicateGenerationLocked: false,
    submitButtonText: '',
    smartHint: '',
    promptGuardState: 'empty',
    promptGuardMessage: '',
    promptSuggestions: [],
    loading: false,
    asyncGenerationEnabled: config.ASYNC_GENERATION_ENABLED === true,
    generationTasks: [],
    visibleGenerationTasks: [],
    hasMoreGenerationTasks: false,
    hiddenGenerationTaskCount: 0,
    recentGenerationCollapsed: false,
    activeTaskCount: 0,
    queueFull: false,
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
    promptExamples: [DEFAULT_PROMPT]
  },
  onLoad(options = {}) {
    if (options.inviteCode) storage.bindInviter(options.inviteCode)
    share.enableShareMenu()
    const generationTasks = loadLocalTasks()
    const patch = {
      generationTasks,
      ...buildTaskListPatch(generationTasks),
      activeTaskCount: generationTasks.filter(isActiveTask).length,
      queueFull: generationTasks.filter(isActiveTask).length >= MAX_ACTIVE_GENERATION_TASKS
    }
    this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
  },
  onShareAppMessage() {
    return share.appShare(storage.getInviteCode())
  },
  onShareTimeline() {
    return share.timelineShare(storage.getInviteCode())
  },
  onUnload() {
    Object.values(this.jobPollTimers || {}).forEach(timer => clearTimeout(timer))
    this.jobPollTimers = {}
  },
  onShow() {
    this.refreshPageState()
    this.refreshBackendPoints()
    this.refreshGenerationJobs()
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
  refreshBackendPoints() {
    if (!storage.getToken()) return
    api.getPoints().then(data => this.setData({ points: data.pointsBalance })).catch(() => {})
  },
  onPromptInput(e) {
    const prompt = e.detail.value
    const inferred = applyPromptMeta(this.data, prompt)
    const canGenerate = !!this.data.filePath || (canGenerateFrom({ prompt }) && inferred.assessment.allowGenerate)
    const patch = {
      prompt,
      ...inferred.patch,
      canGenerate,
      smartHint: inferred.applied.length ? `已按输入更新：${inferred.applied.join(' · ')}` : '',
      promptGuardState: inferred.assessment.state,
      promptGuardMessage: inferred.assessment.hint,
      promptSuggestions: inferred.assessment.suggestions,
      statusType: inferred.assessment.state === 'invalid' ? 'error' : 'empty',
      statusMessage: inferred.assessment.hint || (inferred.applied.length
        ? `已根据输入识别：${inferred.applied.join(' · ')}。下方选项可继续手动调整。`
        : '输入完成后点击生成，系统会自动排版为练习卷。')
    }
    this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
  },
  useExample(e) {
    const prompt = e.currentTarget.dataset.prompt || DEFAULT_PROMPT
    const inferred = applyPromptMeta(this.data, prompt)
    const patch = {
      prompt,
      ...inferred.patch,
      smartHint: inferred.applied.length ? `已按输入更新：${inferred.applied.join(' · ')}` : '',
      promptGuardState: inferred.assessment.state,
      promptGuardMessage: inferred.assessment.hint,
      promptSuggestions: inferred.assessment.suggestions,
      canGenerate: !!this.data.filePath || (canGenerateFrom({ prompt }) && inferred.assessment.allowGenerate)
    }
    this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
  },
  applyPromptSuggestion(e) {
    this.useExample({ currentTarget: { dataset: { prompt: e.currentTarget.dataset.prompt } } })
  },
  toggleMore() { this.setData({ showMore: !this.data.showMore }) },
  selectMode(e) {
    const mode = e.currentTarget.dataset.mode
    const info = billing.getGenerationMode(mode)
    const patch = { ...modePatch(mode), statusType: 'empty', statusMessage: `${info.label} 将消耗 ${info.cost} 点。` }
    this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
  },
  selectSimulationPageCount(e) {
    const count = Number(e.currentTarget.dataset.count)
    this.setData({ simulationPageCount: count, statusType: count > 5 ? 'error' : 'empty', statusMessage: count > 5 ? '当前版本最多支持上传 5 页试卷。' : '整卷仿真会根据原卷结构生成新题。' })
  },
  chooseGrade() { this.setData({ openDropdown: this.data.openDropdown === 'grade' ? '' : 'grade' }) },
  chooseSubject() { this.setData({ openDropdown: this.data.openDropdown === 'subject' ? '' : 'subject' }) },
  selectGrade(e) {
    const grade = e.currentTarget.dataset.value
    const subjectOptions = subjectOptionsForGrade(grade)
    const subject = normalizeSubjectForGrade(this.data.subject, grade)
    const inferred = applyPromptMeta({ ...this.data, grade, subject }, this.data.prompt)
    const patch = {
      grade,
      subjectOptions,
      subject,
      ...inferred.patch,
      openDropdown: '',
      smartHint: '',
      promptGuardState: inferred.assessment.state,
      promptGuardMessage: inferred.assessment.hint,
      promptSuggestions: inferred.assessment.suggestions,
      canGenerate: !!this.data.filePath || (canGenerateFrom({ prompt: this.data.prompt }) && inferred.assessment.allowGenerate)
    }
    this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
  },
  selectSubject(e) {
    const subject = e.currentTarget.dataset.value
    const inferred = applyPromptMeta({ ...this.data, subject }, this.data.prompt)
    const patch = {
      subject,
      ...inferred.patch,
      openDropdown: '',
      smartHint: '',
      promptGuardState: inferred.assessment.state,
      promptGuardMessage: inferred.assessment.hint,
      promptSuggestions: inferred.assessment.suggestions,
      canGenerate: !!this.data.filePath || (canGenerateFrom({ prompt: this.data.prompt }) && inferred.assessment.allowGenerate)
    }
    this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
  },
  chooseDifficulty() {
    const list = ['简单', '中等', '困难', '混合']
    wx.showActionSheet({
      itemList: list,
      success: res => {
        const patch = { difficulty: list[res.tapIndex] }
        this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
      }
    })
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
        const patch = { filePath: meta.path, fileName: meta.name, fileSize: meta.size, fileSizeLabel: meta.sizeLabel, fileExtension: meta.extension, fileTypeLabel: meta.typeLabel, fileParseStatus: meta.parserStatus, fileParseHint: meta.parserHint, canGenerate: true, ...modePatch(nextMode), statusType: 'ready', statusMessage: '资料已选择，生成时会上传到后端解析。' }
        this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
      },
      fail: () => this.setData({ statusType: 'empty', statusMessage: '未选择文件，可继续用文字要求生成。' })
    })
  },
  removeFile() {
    const patch = { filePath: '', fileName: '', fileSize: 0, fileSizeLabel: '', fileExtension: '', fileTypeLabel: '', fileParseStatus: '', fileParseHint: '', canGenerate: canGenerateFrom({ prompt: this.data.prompt, filePath: '' }), statusType: 'empty', statusMessage: '已移除资料，可继续用文字要求生成。' }
    this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
  },
  goPackages() { wx.navigateTo({ url: '/pages/packages/packages' }) },
  goPreview() { if (this.data.hasLastWorksheet) wx.navigateTo({ url: '/pages/preview/preview' }) },
  toggleRecentGeneration() { this.setData({ recentGenerationCollapsed: !this.data.recentGenerationCollapsed }) },
  goGenerationRecords() { wx.navigateTo({ url: '/pages/records/records' }) },
  upsertGenerationTask(task) {
    const next = normalizeJob(task)
    const tasks = [next, ...this.data.generationTasks.filter(item => item.id !== next.id && item.jobId !== next.jobId)].slice(0, 20)
    const activeTaskCount = tasks.filter(isActiveTask).length
    const queueFull = activeTaskCount >= MAX_ACTIVE_GENERATION_TASKS
    saveLocalTasks(tasks)
    const patch = { generationTasks: tasks, ...buildTaskListPatch(tasks), activeTaskCount, queueFull }
    this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
    return next
  },
  activeGenerationTaskCount() { return this.data.generationTasks.filter(isActiveTask).length },
  failGenerationTask(jobId, message, errorMessage) {
    const current = this.data.generationTasks.find(item => item.jobId === jobId || item.id === jobId)
    if (!current || !isActiveTask(current)) return
    this.upsertGenerationTask({
      ...current,
      status: 'failed',
      progress: 100,
      message,
      errorMessage: errorMessage || message,
      updatedAt: new Date().toISOString()
    })
    wx.showToast({ title: '生成失败', icon: 'none' })
  },
  async refreshGenerationJobs() {
    if (!storage.getToken()) return
    try {
      const data = await api.getGenerationJobs()
      const remoteTasks = (data.jobs || []).map(job => normalizeJob(job, this.data.generationTasks.find(local =>
        local.id === job.id || local.jobId === job.jobId || local.requestId === job.requestId
      )))
      const localOnly = this.data.generationTasks.filter(local => !remoteTasks.some(remote => remote.id === local.id || remote.jobId === local.jobId || remote.requestId === local.requestId))
      const tasks = [...remoteTasks, ...localOnly].slice(0, 20)
      saveLocalTasks(tasks)
      const activeTaskCount = tasks.filter(isActiveTask).length
      const patch = { generationTasks: tasks, ...buildTaskListPatch(tasks), activeTaskCount, queueFull: activeTaskCount >= MAX_ACTIVE_GENERATION_TASKS }
      this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
      tasks.filter(isActiveTask).forEach(task => this.pollGenerationJob(task.jobId || task.id))
    } catch (e) {
      loadLocalTasks().filter(isActiveTask).forEach(task => this.pollGenerationJob(task.jobId || task.id))
    }
  },
  completeGenerationTask(task) {
    const result = task.result || {}
    const worksheet = result.worksheet || task.worksheet
    if (!worksheet) return
    const payload = { worksheet, pdfUrl: result.pdfUrl || task.pdfUrl || '', wordUrl: result.wordUrl || task.wordUrl || '', sourceFileInfo: worksheet.sourceFileInfo || null, createdAt: new Date().toLocaleString() }
    getApp().globalData.lastWorksheet = payload
    this.setData({
      hasLastWorksheet: true,
      lastWorksheetTitle: worksheet.title || 'AI 练习卷',
      lastWorksheetMeta: `${worksheet.grade || task.grade || this.data.grade} · ${worksheet.subject || task.subject || this.data.subject} · ${(worksheet.questions || []).length} 题`
    })
    this.refreshBackendPoints()
  },
  previewGenerationTask(e) {
    const id = e.currentTarget.dataset.id
    const task = this.data.generationTasks.find(item => item.id === id || item.jobId === id)
    if (!task) return
    if (task.status === 'succeeded') {
      this.completeGenerationTask(task)
      wx.navigateTo({ url: '/pages/preview/preview' })
      return
    }
    if (task.status === 'failed') {
      modal.showMessage({ title: '生成失败', content: formatGenerationFailureMessage(task.errorMessage || task.message) })
    }
  },
  async pollGenerationJob(jobId) {
    if (!jobId || this.jobPollTimers[jobId]) return
    let pollFailures = 0
    const tick = async () => {
      const current = this.data.generationTasks.find(item => item.jobId === jobId || item.id === jobId)
      const startedAt = Number(current && current.clientCreatedAt || Date.now())
      if (current && isActiveTask(current) && Date.now() - startedAt > JOB_MAX_PENDING_MS) {
        this.failGenerationTask(jobId, '生成超时，请重新生成。', '生成任务超过 10 分钟仍未完成，可能是网络、后端队列或模型服务异常。')
        delete this.jobPollTimers[jobId]
        return
      }
      try {
        const data = await api.getGenerationJob(jobId)
        const job = normalizeJob(data.job || data, this.data.generationTasks.find(item => item.jobId === jobId || item.id === jobId))
        pollFailures = 0
        this.upsertGenerationTask(job)
        if (job.status === 'succeeded') {
          this.completeGenerationTask(job)
          delete this.jobPollTimers[jobId]
          return
        }
        if (job.status === 'failed') {
          delete this.jobPollTimers[jobId]
          return
        }
        this.jobPollTimers[jobId] = setTimeout(tick, JOB_POLL_INTERVAL_MS)
      } catch (e) {
        pollFailures += 1
        if (pollFailures >= MAX_JOB_POLL_FAILURES) {
          this.failGenerationTask(jobId, '进度获取失败，请检查后端服务。', e.message || '连续获取生成进度失败。')
          delete this.jobPollTimers[jobId]
          return
        }
        this.jobPollTimers[jobId] = setTimeout(tick, JOB_POLL_INTERVAL_MS * 2)
      }
    }
    this.jobPollTimers[jobId] = setTimeout(tick, 300)
  },
  buildGenerationPrompt(prompt) {
    return [prompt || DEFAULT_PROMPT, `年级：${this.data.grade}`, `学科：${this.data.subject}`, `难度：${this.data.difficulty}`, `题量：${this.data.questionCount}`, `生成类型：${billing.getGenerationModeLabel(this.data.mode)}`].join('\n')
  },
  async handleGenerate() {
    if (this.data.loading || this.submittingGeneration) return
    if (!storage.getToken()) { wx.navigateTo({ url: '/pages/login/login' }); return }
    const prompt = (this.data.prompt || '').trim()
    if (!prompt && !this.data.filePath) { this.setData({ statusType: 'error', statusMessage: '请先输入出题要求，或上传 PDF / Word / 图片资料。' }); return }
    const assessment = assessPrompt(prompt, this.data)
    if (prompt && !this.data.filePath && !assessment.allowGenerate) {
      this.setData({
        canGenerate: false,
        promptGuardState: assessment.state,
        promptGuardMessage: assessment.hint,
        promptSuggestions: assessment.suggestions,
        statusType: assessment.state === 'invalid' ? 'error' : 'empty',
        statusMessage: assessment.hint
      })
      return
    }
    if ((this.data.mode === 'upload_material' || this.data.mode === 'full_paper_simulation') && !this.data.filePath) {
      modal.showMessage({ title: '需要上传资料', content: '上传资料生成和整卷仿真需要先上传 PDF、Word 或图片资料。' })
      return
    }
    const needPoints = billing.getGenerationPointCost(this.data.mode)
    if (Number(this.data.points || 0) < needPoints) {
      modal.showConfirm({ title: '点数不足', content: `本次生成需要 ${needPoints} 点，你当前剩余 ${this.data.points} 点。购买套餐或点数包后即可继续生成。`, confirmText: '购买', success: res => { if (res.confirm) this.goPackages() } })
      return
    }
    const taskMode = this.data.mode
    const generationPrompt = this.buildGenerationPrompt(prompt)
    const currentSignature = generationSignature(this.data)
    if (this.data.generationTasks.some(task => task.signature === currentSignature && isLockedTask(task))) {
      this.setData({ ...buildSubmitPatch(this.data), statusType: 'success', statusMessage: '这份要求已加入生成队列，完成后会出现在最近生成。' })
      return
    }
    if (!this.data.filePath) {
      const requestId = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      this.submittingGeneration = true
      const loadingPatch = { loading: true, duplicateGenerationLocked: true, statusType: 'loading', statusMessage: '正在创建生成任务，可离开页面，完成后会出现在最近生成。' }
      this.setData({ ...loadingPatch, ...buildSubmitPatch({ ...this.data, ...loadingPatch }) })
      try {
        const data = await api.generateWorksheetAsync({ requestId, prompt: generationPrompt, grade: this.data.grade, subject: this.data.subject, difficulty: this.data.difficulty, mode: taskMode, questionCount: this.data.questionCount })
        const job = normalizeJob(data.job || data, { requestId, prompt, grade: this.data.grade, subject: this.data.subject, mode: taskMode, modeLabel: billing.getGenerationModeLabel(taskMode), questionCount: this.data.questionCount, status: 'queued', message: '正在生成，可离开页面，完成后会出现在最近生成。', signature: currentSignature })
        this.upsertGenerationTask(job)
        this.pollGenerationJob(job.jobId || job.id)
        if (job.status === 'succeeded') this.completeGenerationTask(job)
        this.setData({ statusType: 'success', statusMessage: '生成任务已创建，可离开页面，完成后会出现在最近生成。' })
      } catch (e) {
        const failureMessage = formatGenerationFailureMessage(e.message || '生成任务创建失败')
        this.setData({ statusType: 'error', statusMessage: failureMessage })
        modal.showMessage({ title: '创建失败', content: failureMessage })
      } finally {
        this.submittingGeneration = false
        const patch = { loading: false }
        this.setData({ ...patch, ...buildSubmitPatch({ ...this.data, ...patch }) })
      }
      return
    }
    this.setData({ loading: true, statusType: 'loading', statusMessage: '正在生成练习卷，完成后将进入预览页。' })
    try {
      const res = await api.generateWorksheet({ prompt: generationPrompt, filePath: this.data.filePath, fileName: this.data.fileName, fileType: this.data.fileTypeLabel, fileSize: this.data.fileSize, fileExtension: this.data.fileExtension, grade: this.data.grade, subject: this.data.subject, difficulty: this.data.difficulty, mode: taskMode, questionCount: this.data.questionCount })
      if (!res || !res.success) throw new Error((res && res.message) || '生成失败')
      const worksheet = res.worksheet || res.preview || res
      const pointsUsed = Number(res.pointsUsed || (res.cost && res.cost.pointsUsed) || needPoints)
      const payload = { worksheet, pdfUrl: res.pdfUrl || '', wordUrl: res.wordUrl || '', sourceFileInfo: worksheet.sourceFileInfo || null, createdAt: new Date().toLocaleString() }
      getApp().globalData.lastWorksheet = payload
      this.setData({ statusType: 'success', statusMessage: `生成成功，已扣除 ${pointsUsed} 点。`, points: Math.max(0, Number(this.data.points || 0) - pointsUsed), hasLastWorksheet: true, lastWorksheetTitle: worksheet.title || 'AI 练习卷', lastWorksheetMeta: `${worksheet.grade || this.data.grade} · ${worksheet.subject || this.data.subject} · ${(worksheet.questions || []).length} 题` })
      this.refreshBackendPoints()
      wx.navigateTo({ url: '/pages/preview/preview' })
    } catch (e) {
      const failureMessage = formatGenerationFailureMessage(e.message || '生成失败')
      this.setData({ statusType: 'error', statusMessage: failureMessage })
      modal.showMessage({ title: '生成失败', content: failureMessage })
    } finally {
      this.setData({ loading: false })
    }
  }
})
