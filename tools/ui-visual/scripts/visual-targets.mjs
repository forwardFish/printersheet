export const repoRoot = new URL('../../..', import.meta.url)

export const defaultRound = 'round2'
export const defaultCandidateId = 'exam'

export const thresholds = {
  perPageRatio: 0.01,
  averageRatio: 0.008
}

export const candidates = {
  exam: {
    id: 'exam',
    label: 'ai-exam-miniapp/miniprogram',
    projectRoot: '.',
    projectConfig: 'project.config.json'
  },
  worksheet: {
    id: 'worksheet',
    label: 'ai-worksheet-miniprogram',
    projectRoot: 'ai-worksheet-miniprogram',
    projectConfig: 'ai-worksheet-miniprogram/project.config.json'
  }
}

export function getCandidateId(value = process.env.UI_CANDIDATE) {
  const candidateId = value || defaultCandidateId
  if (!candidates[candidateId]) {
    throw new Error(`Unknown UI_CANDIDATE "${candidateId}". Expected one of: ${Object.keys(candidates).join(', ')}`)
  }
  return candidateId
}

export function getCandidate(value = process.env.UI_CANDIDATE) {
  return candidates[getCandidateId(value)]
}

const homeBaseData = {
  points: 126,
  prompt: '',
  grade: '初一',
  subject: '数学',
  difficulty: '中等',
  subjectOptions: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
  showMore: true,
  statusType: 'empty',
  statusMessage: '',
  smartHint: '',
  promptGuardMessage: '',
  promptSuggestions: [],
  canGenerate: false,
  loading: false,
  queueFull: false,
  duplicateGenerationLocked: false,
  currentModeLabel: '普通练习卷',
  currentModeDesc: '5 题，适合快速日常练习。',
  currentModeCost: 1,
  generateButtonText: '一键生成练习卷',
  submitButtonText: '',
  filePath: '',
  fileName: '',
  hasLastWorksheet: false,
  lastWorksheetTitle: '',
  lastWorksheetMeta: ''
}

const recentTasks = [
  {
    id: 'recent-geometry-1',
    jobId: 'recent-geometry-1',
    prompt: '几何题目',
    grade: '初二',
    subject: '数学',
    modeLabel: '普通练习卷',
    status: 'succeeded',
    message: '生成完成，点击预览。',
    progress: 100
  },
  {
    id: 'recent-geometry-2',
    jobId: 'recent-geometry-2',
    prompt: '几何题目',
    grade: '初二',
    subject: '数学',
    modeLabel: '普通练习卷',
    status: 'succeeded',
    message: '生成完成，点击预览。',
    progress: 100
  },
  {
    id: 'recent-geometry-3',
    jobId: 'recent-geometry-3',
    prompt: '初三几何',
    grade: '初三',
    subject: '数学',
    modeLabel: '普通练习卷',
    status: 'succeeded',
    message: '生成完成，点击预览。',
    progress: 100
  }
]

const examPageTargets = [
  {
    id: 'home-normal',
    page: '/pages/index/index',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月18日 22_54_16 (1).png',
    settleMs: 1000,
    data: {
      ...homeBaseData,
      mode: 'normal',
      openDropdown: '',
      screenshotMode: 'visual-reference'
    }
  },
  {
    id: 'home-recent',
    page: '/pages/index/index',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月18日 22_54_16 (2).png',
    settleMs: 1000,
    data: {
      ...homeBaseData,
      mode: 'normal',
      openDropdown: '',
      screenshotMode: 'recent',
      filePath: '',
      fileName: '',
      generationTasks: recentTasks,
      visibleGenerationTasks: recentTasks,
      hasMoreGenerationTasks: true,
      hiddenGenerationTaskCount: 12,
      recentGenerationCollapsed: false,
      hasLastWorksheet: true,
      lastWorksheetTitle: '初三数学几何练习卷',
      lastWorksheetMeta: '初三 · 数学 · 5 题'
    }
  },
  {
    id: 'home-grade-selector',
    page: '/pages/index/index',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月18日 22_54_17 (6).png',
    settleMs: 1000,
    data: {
      ...homeBaseData,
      mode: 'extended',
      openDropdown: 'grade',
      screenshotMode: 'visual-reference',
      currentModeLabel: '加长练习卷',
      currentModeDesc: '10 题，适合一组完整训练。',
      currentModeCost: 2,
      generateButtonText: '生成加长练习卷'
    }
  },
  {
    id: 'preview',
    page: '/pages/preview/preview',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月18日 22_54_17 (4).png',
    settleMs: 1000,
    data: {
      canRemoveWatermark: true,
      canDownloadWord: true,
      isPaid: true
    }
  },
  {
    id: 'packages',
    page: '/pages/packages/packages',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_19 (5).png',
    settleMs: 1000,
    data: {
      selectedId: 'pro_monthly'
    }
  },
  {
    id: 'login',
    page: '/pages/login/login',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月18日 22_54_17 (5).png',
    settleMs: 1000,
    data: {
      agreed: false,
      mockLoginEnabled: true
    }
  },
  {
    id: 'order',
    page: '/pages/order/order',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_20 (7).png',
    settleMs: 1000,
    data: {}
  },
  {
    id: 'my',
    page: '/pages/my/my',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月18日 22_54_17 (3).png',
    settleMs: 1000,
    data: {
      showShareMock: false,
      avatarUrl: '/assets/avatar-boy.png',
      displayName: 'We**',
      displayId: '51467607-c876-4608-a825-e84908aa6cc4',
      displayPoints: 126,
      memberName: 'pro',
      memberExpireText: '到期时间： 2026-07-19'
    }
  },
  {
    id: 'my-share-dialog',
    page: '/pages/my/my',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月18日 23_06_03.png',
    settleMs: 1000,
    data: {
      showShareMock: true,
      avatarUrl: '/assets/avatar-boy.png',
      displayName: 'We**',
      displayId: '104a9c90-5fc0-461e-995a-42928a37b2c5',
      displayPoints: 126,
      memberName: 'pro',
      memberExpireText: '到期时间： 2026-07-19'
    }
  }
]

const worksheetPageOverrides = {
  'home-normal': {
    data: {
      expanded: false,
      grade: '初一'
    }
  },
  'home-recent': {
    page: '/pages/records/records',
    data: {}
  },
  'home-grade-selector': {
    page: '/pages/index/index?expanded=1',
    data: {
      expanded: true,
      grade: '初一'
    }
  },
  packages: {
    page: '/pages/package/package',
    data: {
      selected: 'pro'
    }
  },
  preview: {
    page: '/pages/preview/preview?pro=1',
    data: {
      pro: true
    }
  },
  my: {
    page: '/pages/profile/profile',
    data: {}
  },
  'my-share-dialog': {
    page: '/pages/profile/profile',
    data: {}
  }
}

export function getPageTargets(candidateId = getCandidateId()) {
  if (candidateId === 'exam') return examPageTargets
  if (candidateId === 'worksheet') {
    return examPageTargets.map(target => ({
      ...target,
      ...(worksheetPageOverrides[target.id] || {}),
      candidateEquivalent: target.page
    }))
  }
  return examPageTargets
}

const examAssetTargets = [
  {
    id: 'share-poster',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月18日 22_58_41.png',
    actual: 'ai-exam-miniapp/miniprogram/assets/share-poster.png'
  }
]

export function getAssetTargets(candidateId = getCandidateId()) {
  return candidateId === 'exam' ? examAssetTargets : []
}

export const pageTargets = getPageTargets()
export const assetTargets = getAssetTargets()
export const pendingTargets = []
