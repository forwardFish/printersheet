export const repoRoot = new URL('../../..', import.meta.url)

export const defaultRound = 'round1'

export const thresholds = {
  perPageRatio: 0.01,
  averageRatio: 0.008
}

export const pageTargets = [
  {
    id: 'home-normal',
    page: '/pages/index/index',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_17 (1).png',
    settleMs: 1000,
    data: {
      points: 37,
      prompt: '',
      showMore: true,
      mode: 'normal',
      openDropdown: '',
      currentModeLabel: '普通练习卷',
      currentModeDesc: '5 题，适合快速日常练习。',
      currentModeCost: 1,
      generateButtonText: '一键生成练习卷'
    }
  },
  {
    id: 'home-grade-selector',
    page: '/pages/index/index',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_21 (10).png',
    settleMs: 1000,
    data: {
      points: 37,
      prompt: '',
      showMore: true,
      mode: 'extended',
      openDropdown: 'grade',
      currentModeLabel: '加长练习卷',
      currentModeDesc: '10 题，适合一组完整训练。',
      currentModeCost: 2,
      generateButtonText: '生成加长练习卷'
    }
  },
  {
    id: 'preview',
    page: '/pages/preview/preview',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_21 (9).png',
    settleMs: 1000,
    data: {}
  },
  {
    id: 'packages',
    page: '/pages/packages/packages',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_19 (5).png',
    settleMs: 1000,
    data: {}
  },
  {
    id: 'login',
    page: '/pages/login/login',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_20 (8).png',
    settleMs: 1000,
    data: {
      agreed: false,
      mockLoginEnabled: false
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
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_19 (6).png',
    settleMs: 1000,
    data: {
      showShareMock: false
    }
  },
  {
    id: 'my-share-dialog',
    page: '/pages/my/my',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_18 (4).png',
    settleMs: 1000,
    data: {
      showShareMock: true
    }
  }
]

export const assetTargets = [
  {
    id: 'share-poster',
    reference: 'docs/UI/小程序/分享海报.png',
    actual: 'ai-exam-miniapp/miniprogram/assets/share-poster.png'
  }
]

export const pendingTargets = [
  {
    id: 'home-my-transition-composite',
    reference: 'docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_18 (3).png',
    reason: '参考图是首页上半屏与我的页遮罩态下半屏的拼接/过渡画面，不是一个稳定小程序路由状态。'
  }
]
