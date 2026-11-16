// ─── UI strings: Japanese default, 中文 toggle (persisted in the save) ──────

export type Lang = 'ja' | 'zh'

export const STRINGS = {
  ja: {
    title: 'ドリンクカード',
    subtitle: 'パック開封',
    packName: 'M STAND ドリンクカード',
    packSeries: '5 CARDS · SERIES 01',
    pointsUnit: 'pt',
    openPack: 'パックを開ける',
    openAnother: 'もう1パック開ける',
    packCost: '50 pt',
    recharge: 'ポイント無料チャージ +200',
    notEnough: 'ポイントが足りません',
    tapHint: 'パック上部を横にスワイプして切り開く（タップでも開封）',
    choosePack: 'パックを選んでタップ',
    holdReveal: '長押しでチャージ…',
    tapReveal: 'タップでめくる',
    nextHint: 'タップで次へ',
    resultHint: 'タップで結果へ',
    lastCard: 'ラスト1枚',
    skip: 'スキップ',
    result: '結果',
    pointsGained: '獲得ポイント',
    newCards: '新しいカード',
    collection: 'コレクション',
    close: '閉じる',
    owned: '所持',
    packsOpened: '開封したパック',
    oddsTitle: '提供割合・確定まで',
    oddsNote: '1パック5枚。5枚目は必ずレア以上。カードは開封前に決まっています。',
    epicIn: (n: number) => `あと${n}パック以内に Epic 以上が確定`,
    legendaryIn: (n: number) => `あと${n}パック以内に Legendary が確定`,
    tierNames: {
      common: 'コモン',
      uncommon: 'アンコモン',
      rare: 'レア',
      epic: 'エピック',
      legendary: 'レジェンダリー',
    } as Record<string, string>,
    soundOn: 'サウンド ON',
    soundOff: 'サウンド OFF',
  },
  zh: {
    title: '饮品卡',
    subtitle: '开包',
    packName: 'M STAND 饮品卡',
    packSeries: '5 张 · SERIES 01',
    pointsUnit: 'pt',
    openPack: '开一包',
    openAnother: '再开一包',
    packCost: '50 pt',
    recharge: '免费充值 +200',
    notEnough: '积分不足',
    tapHint: '沿卡包顶部横向滑动撕开（点按也可）',
    choosePack: '选一包，点它',
    holdReveal: '长按蓄力揭晓…',
    tapReveal: '点按翻开',
    nextHint: '点按下一张',
    resultHint: '点按看结果',
    lastCard: '最后一张',
    skip: '跳过',
    result: '结果',
    pointsGained: '获得积分',
    newCards: '新卡',
    collection: '收集图鉴',
    close: '关闭',
    owned: '已收集',
    packsOpened: '已开包数',
    oddsTitle: '概率 · 保底进度',
    oddsNote: '每包 5 张，第 5 张必为稀有以上。卡在开包前就已决定。',
    epicIn: (n: number) => `${n} 包内必出 Epic 以上`,
    legendaryIn: (n: number) => `${n} 包内必出 Legendary`,
    tierNames: {
      common: '普通',
      uncommon: '非凡',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说',
    } as Record<string, string>,
    soundOn: '音效开',
    soundOff: '音效关',
  },
} as const

type JaStrings = (typeof STRINGS)['ja']

/** Widened UI-string shape shared by both languages (ja literals → string). */
export type Strings = {
  [K in keyof JaStrings]: JaStrings[K] extends (...args: never[]) => unknown
    ? JaStrings[K]
    : JaStrings[K] extends Record<string, string>
      ? Record<string, string>
      : string
}
