export type Lang = 'kk' | 'ru' | 'en'

export const LANG_LABELS: Record<Lang, string> = {
  kk: 'Қазақша',
  ru: 'Русский',
  en: 'English',
}

// All UI strings, keyed by language then string ID
export const T: Record<Lang, {
  // Top bar
  appTitle: string
  appSubtitle: string
  freeChip: (free: number, total: number) => string
  // Mobile sheet
  hidePanel: string
  showPanel: string
  mobileStrip: (free: number, total: number) => string
  // ParkingPanel
  statusAvailable: string
  statusLimited: string
  statusFull: string
  spacesFree: string
  lowerDeck: string
  dashFree: string
  free: string
  occupied: string
  unknown: string
  getDirections: string
  navUnavailable: string
  offlineNotice: string
  offline: string
  live: string
  lastUpdated: string
  tierFreeLabel: (free: number, total: number) => string
  // AdminPage (multi-lot)
  adminTitle: string
  adminSubtitle: string
  backToMap: string
  modeMock: string
  modeLive: string
  cameraFeed: string
  cameraOffline: string
  spaceStatuses: string
  navigatorOffline: string
  loading: string
  detectionControls: string
  setBaseline: string
  resumeDetection: string
  pauseDetection: string
  scenario: string
  calibration: string
  calibrationHint: string
  captureSnapshot: string
  setAsBaseline: string
  // Multi-lot admin
  parkingLots: string
  addLot: string
  newLot: string
  editLot: string
  lotId: string
  lotName: string
  lotAddress: string
  cameraIndex: string
  createLot: string
  saveChanges: string
  cancel: string
  disable: string
  enable: string
  delete: string
  disabled: string
  // Settings
  language: string
  settings: string
}> = {
  kk: {
    // Top bar
    appTitle: 'Times Parking Navigator',
    appSubtitle: 'Алматы, Қазақстан',
    freeChip: (free, total) => `${free}/${total} бос`,
    // Mobile sheet
    hidePanel: '↓ жасыру',
    showPanel: '↑ толығырақ',
    mobileStrip: (free, total) => `Times Parking · ${free}/${total} бос`,
    // ParkingPanel
    statusAvailable: 'Бар',
    statusLimited: 'Аз',
    statusFull: 'Толды',
    spacesFree: 'бос орын',
    lowerDeck: 'Төменгі қабат (жабық)',
    dashFree: '—/5 бос',
    free: 'Бос',
    occupied: 'Бос емес',
    unknown: 'Белгісіз',
    getDirections: 'Бағыт алу',
    navUnavailable: 'Бағыт алу демо режимде қол жетімді емес',
    offlineNotice: 'Офлайн — uvicorn main:app --port 9000 іске қосыңыз',
    offline: 'Офлайн',
    live: 'Тікелей · 2с',
    lastUpdated: 'Соңғы жаңарту:',
    tierFreeLabel: (free, total) => `${free}/${total} бос`,
    // AdminPage
    adminTitle: 'Times Parking — Басқару',
    adminSubtitle: 'Камера · детекция · калибровка',
    backToMap: '← Картаға оралу',
    modeMock: 'Имитация',
    modeLive: 'Тікелей',
    cameraFeed: 'Камера — MJPEG',
    cameraOffline: 'Камера офлайн',
    spaceStatuses: 'Орын күйлері',
    navigatorOffline: 'Navigator офлайн — деректер жоқ',
    loading: 'Жүктелуде…',
    detectionControls: 'Детекция басқармасы',
    setBaseline: 'Базалық бейне',
    resumeDetection: 'Детекцияны жалғастыру',
    pauseDetection: 'Детекцияны тоқтату',
    scenario: 'Сценарий',
    calibration: 'Калибровка — нақты жабдық',
    calibrationHint: 'Алдымен Тікелей режиміне ауысыңыз, камераны бос тұрақ алаңына бағыттаңыз, содан кейін суретке түсіріп, базалық бейнені орнатыңыз.',
    captureSnapshot: 'Суретке түсіру',
    setAsBaseline: 'Базалық бейне орнату',
    // Multi-lot admin
    parkingLots: 'Тұрақ алаңдары',
    addLot: '+ Алаң қосу',
    newLot: 'Жаңа тұрақ алаңы',
    editLot: 'Өңдеу',
    lotId: 'Алаң ID',
    lotName: 'Атауы',
    lotAddress: 'Мекенжайы',
    cameraIndex: 'Камера индексі',
    createLot: 'Алаң жасау',
    saveChanges: 'Сақтау',
    cancel: 'Бас тарту',
    disable: 'Өшіру',
    enable: 'Қосу',
    delete: 'Жою',
    disabled: 'өшірілген',
    // Settings
    language: 'Тіл',
    settings: 'Баптаулар',
  },

  ru: {
    // Top bar
    appTitle: 'Times Parking Navigator',
    appSubtitle: 'Алматы, Казахстан',
    freeChip: (free, total) => `${free}/${total} свободно`,
    // Mobile sheet
    hidePanel: '↓ скрыть',
    showPanel: '↑ подробнее',
    mobileStrip: (free, total) => `Times Parking · ${free}/${total} свободно`,
    // ParkingPanel
    statusAvailable: 'Свободно',
    statusLimited: 'Мало мест',
    statusFull: 'Заполнено',
    spacesFree: 'мест свободно',
    lowerDeck: 'Нижний уровень (крытый)',
    dashFree: '—/5 свободно',
    free: 'Свободно',
    occupied: 'Занято',
    unknown: 'Неизвестно',
    getDirections: 'Маршрут',
    navUnavailable: 'Навигация недоступна в демо-режиме',
    offlineNotice: 'Офлайн — запустите uvicorn main:app --port 9000',
    offline: 'Офлайн',
    live: 'Онлайн · 2с',
    lastUpdated: 'Обновлено:',
    tierFreeLabel: (free, total) => `${free}/${total} свободно`,
    // AdminPage
    adminTitle: 'Times Parking — Управление',
    adminSubtitle: 'Камера · управление · калибровка',
    backToMap: '← На карту',
    modeMock: 'Имитация',
    modeLive: 'Реальный',
    cameraFeed: 'Камера — MJPEG',
    cameraOffline: 'Камера офлайн',
    spaceStatuses: 'Статусы мест',
    navigatorOffline: 'Navigator офлайн — нет данных',
    loading: 'Загрузка…',
    detectionControls: 'Управление детекцией',
    setBaseline: 'Базовый кадр',
    resumeDetection: 'Возобновить',
    pauseDetection: 'Приостановить',
    scenario: 'Сценарий',
    calibration: 'Калибровка — реальное оборудование',
    calibrationHint: 'Сначала переключитесь в режим Реальный, направьте камеру на пустую парковку, затем сделайте снимок и установите базовый кадр.',
    captureSnapshot: 'Сделать снимок',
    setAsBaseline: 'Установить базовый',
    // Multi-lot admin
    parkingLots: 'Парковочные зоны',
    addLot: '+ Добавить зону',
    newLot: 'Новая парковочная зона',
    editLot: 'Редактировать',
    lotId: 'ID зоны',
    lotName: 'Название',
    lotAddress: 'Адрес',
    cameraIndex: 'Индекс камеры',
    createLot: 'Создать зону',
    saveChanges: 'Сохранить',
    cancel: 'Отмена',
    disable: 'Отключить',
    enable: 'Включить',
    delete: 'Удалить',
    disabled: 'отключено',
    // Settings
    language: 'Язык',
    settings: 'Настройки',
  },

  en: {
    // Top bar
    appTitle: 'Times Parking Navigator',
    appSubtitle: 'Almaty, Kazakhstan',
    freeChip: (free, total) => `${free}/${total} free`,
    // Mobile sheet
    hidePanel: '↓ hide',
    showPanel: '↑ details',
    mobileStrip: (free, total) => `Times Parking · ${free}/${total} free`,
    // ParkingPanel
    statusAvailable: 'Available',
    statusLimited: 'Limited',
    statusFull: 'Full',
    spacesFree: 'spaces free',
    lowerDeck: 'Lower Deck (Covered)',
    dashFree: '—/5 free',
    free: 'Free',
    occupied: 'Occupied',
    unknown: 'Unknown',
    getDirections: 'Get Directions',
    navUnavailable: 'Navigation not available in demo mode',
    offlineNotice: 'Offline — start uvicorn main:app --port 9000',
    offline: 'Offline',
    live: 'Live · 2s',
    lastUpdated: 'Last updated:',
    tierFreeLabel: (free, total) => `${free}/${total} free`,
    // AdminPage (unchanged — admin stays in the current lang)
    adminTitle: 'Times Parking — Admin',
    adminSubtitle: 'Camera · detection · calibration',
    backToMap: '← Back to map',
    modeMock: 'Mock',
    modeLive: 'Live',
    cameraFeed: 'Camera — MJPEG',
    cameraOffline: 'Camera offline',
    spaceStatuses: 'Space statuses',
    navigatorOffline: 'Navigator offline — no data',
    loading: 'Loading…',
    detectionControls: 'Detection controls',
    setBaseline: 'Set Baseline',
    resumeDetection: 'Resume Detection',
    pauseDetection: 'Pause Detection',
    scenario: 'Scenario',
    calibration: 'Calibration — live hardware',
    calibrationHint: 'Switch to Live mode first, point the camera at the empty lot, then capture and set baseline.',
    captureSnapshot: 'Capture Snapshot',
    setAsBaseline: 'Set as Baseline',
    // Multi-lot admin
    parkingLots: 'Parking Lots',
    addLot: '+ Add Lot',
    newLot: 'New Parking Lot',
    editLot: 'Edit',
    lotId: 'Lot ID',
    lotName: 'Name',
    lotAddress: 'Address',
    cameraIndex: 'Camera Index',
    createLot: 'Create Lot',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    disable: 'Disable',
    enable: 'Enable',
    delete: 'Delete',
    disabled: 'disabled',
    // Settings
    language: 'Language',
    settings: 'Settings',
  },
}
