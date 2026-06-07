import React, { createContext, useContext, useState, useCallback } from 'react';

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    accountInfo: '账号信息',
    actualReceived: '实收金额',
    addFeeEntry: '录入手续费',
    addImage: '添加',
    additional: '追加投资',
    all: '全部',
    allDividendRecords: '」的所有分红记录',
    amount: '金额',
    amountLabel: '输入金额（元）',
    any: '不限',
    apply: '应用',
    atLeastOneFee: '至少输入一个平台的手续费',
    authSettingsTitle: '登录安全',
    autoByShare: '按股权穿透比例自动分配',
    avatarCropTitle: '调整头像',
    avatarSizeHint: '在不同场景下的显示效果',
    avatarUpdated: '头像已更新',
    backToLogin: '返回登录',
    batchLabel: '{date} · 第{n}次分红',
    bgHint: '选择一张图片作为首页背景',
    bgResultHint: '将作为首页全屏背景',
    bgSettings: '主题设置',
    bgUpdated: '背景图已更新',
    billDate: '账单日期',
    bookBalance: '账面余额',
    bookDiff: '账面差额',
    byRoundAndInvest: '按分红轮次与出资分组',
    cancel: '取消',
    capitalLedger: '合伙人资本账目流水表',
    cardBalance: '卡余额',
    cashBalance: '现金',
    cashOnHand: '在手资金',
    ceo: 'CEO',
    chairman: '董事长',
    changeEmail: '更换邮箱',
    changePassword: '修改密码',
    chooseImage: '选择图片',
    clear: '清空',
    codeSent: '验证码已发送',
    confirm: '确认',
    confirmDelete: '确认删除？',
    confirmDeleteRecord: '确认删除',
    confirmIssue: '确认发放并记账',
    confirmLogout: '确定退出',
    confirmNewPassword: '确认新密码',
    confirmPassword: '确认密码',
    confirmRecord: '确认记录',
    confirmUse: '确认使用',
    copyright: '© 2026 柳味探秘 · 经营查询 · 版权所有',
    coverCropTitle: '编辑封面',
    coverHint: '将作为个人中心顶部封面展示',
    coverUpdated: '封面已更新',
    cropFailed: '裁切失败，请重试',
    cropFlip: '翻转',
    cropPill: '拖动移动 · 双指缩放',
    cropRotate: '旋转',
    cumulativeByShare: '累计派发 · 按比例分配',
    cumulativeExpense: '累计支出',
    cumulativeRevenue: '累计营收',
    currentBalance: '当前结余',
    daily: '日常',
    dailyRevenue: '每日营收',
    dangerZone: '危险操作',
    date: '日期',
    delete: '删除',
    deleteRecord: '删除',
    devCodeLabel: '🔧 开发模式 — 验证码',
    dineIn: '堂食',
    discountAmount: '优惠减免',
    displayName: '用户名称',
    distributedPool: '已派发分红池',
    dividend: '分红',
    dividendHistory: '分红历史',
    dividendRoundFmt: '第{n}次分红 · {date}',
    dividendRoundOnly: '第{n}次分红',
    done: '完成',
    downloadPdf: '下载PDF',
    editBg: '编辑背景图',
    editCover: '更换封面',
    editProfile: '个人中心',
    email: '邮箱',
    emailAction: '邮件',
    emailBodyExtra: '（链接 24 小时内有效）',
    emptyExpenseHint: '每完成一次记账，这里就多一条记录',
    emptyReconHint: '每完成一次对账，这里就多一张小卡片',
    enterAmount: '输入金额',
    enterCode: '输入验证码',
    entryDate: '录入日期',
    errDateFuture: '不能选择未来的日期',
    errDateRange: '结束日期必须晚于开始日期',
    errDateRangeTooLong: '日期范围不能超过 24 个月',
    errEmailInvalid: '邮箱格式不正确',
    errEmptyFields: '请填写所有字段',
    errFileSize: '图片不能超过10MB',
    errNetworkError: '网络错误，请检查网络后重试',
    errOldPwRequired: '请输入当前密码',
    errPwMismatch: '两次密码不一致',
    errPwNeedLetter: '密码必须包含字母',
    errPwNeedNumber: '密码必须包含数字',
    errPwNeedSpecial: '密码必须包含特殊字符',
    errPwTooShort: '密码至少 8 位',
    errWrongCredentials: '账号或密码错误',
    expConfirmMsg: '提交后将无法修改，确定要记录吗？',
    expConfirmTitle: '确认记录',
    expDate: '日期',
    expense: '支出',
    expenseCategory: '支出分类',
    expenseDate: '支出日期',
    expenseHistory: '支出记录',
    expenseNote: '支出说明',
    feeAllMonths: '全部',
    feeCurrent: '当前手续费',
    feeDetail: '更新手续费',
    feeEntry: '今日手续费',
    feeHistory: '历史明细',
    feePreview: '累计手续费',
    feeViewDetail: '查看明细',
    filledBy: '填写人',
    filter: '筛选',
    filterCategory: '支出分类',
    filterDate: '日期',
    flashSale: '闪购',
    forgotPassword: '忘记密码？',
    forgotSendBtn: '发送验证码',
    forgotStep1: '请输入注册邮箱',
    friendlyReminder: '温馨提示',
    fullyPaidBack: '已回本 ✓',
    fullyPaidBackDetail: '已完全回本 ✓',
    fundsInTransit: '在途资金',
    goBack: '返回',
    goods: '采购',
    imgNotLoaded: '图片未加载',
    income: '收入',
    initial: '初始出资',
    initialInvest: '初始出资',
    invest: '出资',
    investComplete: '出资完结',
    issueDividend: '发起分红',
    issueProportional: '发起比例分红',
    janitor: '打杂',
    jd: '京东',
    jokeClosedLoop: '「一个董事长负责画饼，一个CEO负责烙饼，一个打杂的负责吃饼 —— 完美的商业闭环」',
    jokeRecon: '已为您载入最近一次对账数据，请核对账单日期是否正确。',
    language: '语言',
    linkCopied: '链接已复制',
    loadMore: '加载更多',
    loading: '加载中...',
    login: '登录',
    loginBtn: '登 录',
    loginPlaceholder: '用户名 / 邮箱',
    logout: '退出登录',
    logoutConfirm: '确定要退出登录吗？',
    lpControl: '有限合伙控股',
    lpStructure: '有限合伙控股结构',
    meituan: '美团',
    meituanCashier: '美团收银',
    meituanTuan: '美团团购',
    meituanWaimai: '美团外卖',
    mid: '追加',
    month: '本月',
    monthExpense: '本月支出',
    monthIncome: '本月收入',
    monthProfit: '本月利润',
    nameJiang: '江宽',
    nameLan: '蓝柳富',
    nameZhang: '张安武',
    newEmail: '新邮箱',
    newPassword: '新密码',
    noDividendRecords: '暂无分红记录',
    noRecords: '暂无记录',
    notePlaceholder: '如：葱、香菜、电费',
    oldPassword: '当前密码',
    opacity: '透明度',
    paidInRate: '实缴率',
    partnerSeats: '合伙席位',
    partnerStructure: '合伙架构',
    partnerTitle: '柳味探秘科技合伙人',
    password: '密码',
    payAlipay: '支付宝',
    payCash: '现金',
    payWechat: '微信',
    paybackProgress: '回本进度',
    paybackRate: '回本率',
    paymentMethod: '支付方式',
    pdfLoadFailed: 'PDF 加载失败',
    pdfLoading: '加载 PDF 中…',
    pendingPayback: '待回',
    platformFee: '平台手续费',
    preferences: '偏好设置',
    procAddProduct: '添加产品',
    procAll: '全部',
    procBatchCount: '历史批次',
    procBatchLabel: '采购批次',
    procComingSoon: '即将',
    procConfirmOrder: '确认进货单',
    procContinue: '继续进货',
    procCumulative: '累计货款',
    procDeleteBatch: '删除批次',
    procDeleteBatchConfirm: '确定删除第{n}次进货？关联的支出记录也会一并删除。',
    procDeleteBatchConfirmV2: '确定删除「{batch}」？关联的支出记录也会一并删除。',
    procDeleteProduct: '删除产品',
    procDeleteProductConfirm: '确定删除「{name}」？',
    procDeleteProductWarning: '删除后历史批次中该商品将无法显示名称。',
    procDetail: '进货详情',
    procEditBatch: '编辑第{n}次进货',
    procEditProduct: '编辑产品',
    procEmptyHistoryHint: '完成进货后，记录会显示在这里',
    procEmptyHistoryTitle: '还没有进货记录',
    procEmptyNewHint: '请先在「产品维护」中添加产品，再回来下单',
    procEmptyNewTitle: '还没有产品',
    procEmptyProductsHint: '点击上方「+ 添加产品」开始维护产品目录',
    procEmptyProductsTitle: '还没有产品',
    procGenerating: '生成中...',
    procGeneratingPDF: '正在生成进货单…',
    procHistory: '进货记录',
    procImages: '凭证预览',
    procMargin: '货款利润率',
    procNewOrder: '新建进货',
    procNoteHintAddress: '请填写提货联系地址',
    procNoteHintPhone: '请填写提货联系电话',
    procNoteLabel: '备注',
    procNoteOptional: '可选备注',
    procNowBatch: '第{n}次进货',
    procOperator: '经办人',
    procOrderDate: '进货日期',
    procOrderItems: '进货明细',
    procPaymentMethod: '支付方式',
    procPdfTitle: '进货单 #{n}',
    procProduct: '商品',
    procProductMgmt: '产品维护',
    procProductName: '产品名称',
    procProductNote: '备注（选填）',
    procProductPrice: '单价',
    procProductSpec: '规格',
    procProductSupplier: '供应商',
    procPurchase: '采购',
    procSearchHistory: '搜索批次号、日期…',
    procSearchPlaceholder: '搜索商品…',
    procSearchProducts: '搜索产品名、供应商…',
    procSelected: '已选',
    procSubmit: '提交进货单',
    procSubmitted: '进货单已提交',
    procSubmittedMsg: '本次进货记录已保存',
    procSubtotal: '小计',
    procThisBatch: '本次货款',
    procTitle: '进货管理',
    procTotal: '本次合计',
    procUnit: '种',
    procUpdated: '进货单已更新',
    procUpdatedMsg: '本次进货记录已更新',
    procViewDetail: '查看明细',
    procViewRecords: '查看记录',
    procurement: '进货',
    profileEmail: '电子邮箱',
    profit: '利润',
    monthlyProfit: '月度利润',
    monthlyTrend: '月度收支趋势',
    expenseBreakdown: '支出分类占比',
    pwHint: '8位以上，含字母+数字+特殊字符',
    receivable: '应收总额',
    reconComplete: '对账完成',
    reconDate: '对账日期',
    reconHistory: '对账记录',
    reconciledBy: '对账人',
    recordedBy: '录入人',
    recrop: '重新裁剪',
    register: '注册',
    registerBtn: '注 册',
    rememberMe: '记住我',
    rent: '房租',
    resendCode: '重新发送',
    reset: '重置',
    resetBtn: '重 置',
    resetDefault: '恢复默认',
    resetHint: '验证码已发送至',
    revCancelArchive: '取消歇业',
    revClosedReason: '今日歇业',
    revEmpty: '暂无营收记录',
    revEmptyHint: '开始录入今天的营收数据吧',
    revEntered: '已录入',
    revHistory: '近7天记录',
    revHistoryBtn: '历史记录',
    revJD: '京东营收',
    revJDSub: '京东平台收款',
    revMarkArchive: '标记歇业',
    revNotEntered: '未录入',
    revNote: '备注',
    revNoteHint: '如：今日活动、特殊事件',
    revQuickDB4: '前天',
    revQuickToday: '今天',
    revQuickYesterday: '昨天',
    revRevenue: '营业额收入',
    revRevenueSub: '实际到账金额',
    revSaveDayBefore: '储存前日数据',
    revSaveToday: '储存今日数据',
    revSaveYesterday: '储存昨日数据',
    revSubmit: '确认录入',
    revTurnover: '营业额',
    revTurnoverSub: '总销售流水额',
    revWeekJD: '近30日京东营收',
    revWeekRevenue: '近30日营业额收入',
    revWeekTurnover: '近30日营业额',
    revYesterdayLabel: '昨日:',
    revYesterdayNA: '—',
    revenue: '营业额',
    revenueDate: '营收日期',
    roundNote: '轮次备注',
    salary: '薪资',
    saveImage: '保存图片',
    securitySettings: '安全设置',
    sendCode: '发送验证码',
    sessionKickedButton: '我知道了',
    sessionKickedTitle: '账号已退出',
    sessionKickedToast: '您的账号在其他设备登录，当前会话已退出',
    sessionTimeoutDesc: '超过该时长未操作自动退出',
    sessionTimeoutLabel: '超时时间',
    shangouWaimai: '闪购外卖',
    share: '分享',
    shareCalcResult: '穿透股权计算结果：',
    shareFailed: '分享失败',
    shareLink: '分享链接',
    sharePercent: '持股',
    shareholders: '位股东',
    signaturePlaceholder: '这个人很懒，什么都没留下...',
    ssoDesc: '最多一台设备同时登录',
    ssoLabel: '单设备登录',
    stampPrefixBurgundy: '以此身，阅尽这',
    stampPrefixObsidian: '时序轮转，流光已掷下第',
    stampPrefixTeal: '星霜未歇，我们已共渡',
    stampSuffixBurgundy: '日的晨昏与烟火。',
    stampSuffixObsidian: '道鞭影。',
    stampSuffixTeal: '次潮落潮生。',
    status: '状态',
    subscribedTotal: '认缴总额',
    subtitle: '生活不简单，尽量简单过',
    summary: '收支总览',
    tabExpense: '支出',
    tabRecon: '对账',
    tabRevenue: '营业',
    tapForDetail: '点击卡片查看详情',
    themeLabel: '主题',
    themePicker: '主题方案',
    toastLoadFailed: '数据加载失败',
    toastSubmitFailed: '提交失败，请重试',
    today: '今日',
    todayExpense: '今日支出',
    todayIncome: '今日收入',
    todayProfit: '今日利润',
    totalCapital: '合伙初始基金总额',
    totalDividends: '累计分红',
    totalDividendsPaid: '累计分红',
    totalInvest: '总出资',
    totalToPool: '拟向红利池注入的总金额 (元)',
    tuan: '团购',
    uploadFailed: '上传失败，请重试',
    uploadFailedShort: '上传失败',
    uploadImage: '凭证上传',
    uploading: '上传中...',
    useThisAvatar: '使用此头像',
    useThisBg: '使用此背景图',
    useThisCover: '使用此封面',
    username: '账号',
    verifyBtn: '验 证',
    verifyCode: '验证码',
    verifyEmail: '验证邮箱',
    verifyNewBodyPost: '。请前往查收并点击链接完成验证。',
    verifyNewBodyPre: '欢迎加入柳味探秘科技！一封装有激活密码的邮件已经飞往您的邮箱：',
    verifyNewEditEmail: '修改邮箱地址',
    verifyNewNoEmail: '一直没收到？别着急，您可以 ',
    verifyNewOrSpam: ' 或检查一下垃圾箱。',
    verifyNewResend: '重新发送',
    verifyNewTitle: '只差最后一步啦！✨',
    verifyNewWrongEmail: '填错邮箱了？',
    verifying: '验证中...',
    wages: '工资',
    willDelete: '将删除「',
  },
  'zh-TW': {
    accountInfo: '帳號資訊',
    actualReceived: '實收金額',
    addFeeEntry: '錄入手續費',
    addImage: '添加',
    additional: '追加投資',
    all: '全部',
    allDividendRecords: '」的所有分紅記錄',
    amount: '金額',
    amountLabel: '輸入金額（元）',
    any: '不限',
    apply: '應用',
    atLeastOneFee: '至少輸入一個平台的手續費',
    authSettingsTitle: '登入安全',
    autoByShare: '按股權穿透比例自動分配',
    avatarCropTitle: '調整頭像',
    avatarSizeHint: '在不同場景下的顯示效果',
    avatarUpdated: '頭像已更新',
    back: '返回',
    backToLogin: '返回登錄',
    batchLabel: '{date} · 第{n}次分紅',
    bgHint: '選擇一張圖片作為首頁背景',
    bgResultHint: '將作為首頁全屏背景',
    bgSettings: '主題設定',
    bgUpdated: '背景圖已更新',
    billDate: '賬單日期',
    bookBalance: '賬面餘額',
    bookDiff: '賬面差額',
    byRoundAndInvest: '按分紅輪次與出資分組',
    cancel: '取消',
    capitalLedger: '合夥人資本賬目流水表',
    cardBalance: '卡餘額',
    cashBalance: '現金',
    cashOnHand: '在手資金',
    ceo: 'CEO',
    chairman: '董事長',
    changeEmail: '更換郵箱',
    changePassword: '修改密碼',
    chooseImage: '選擇圖片',
    clear: '清空',
    codeSent: '驗證碼已發送',
    confirm: '確認',
    confirmDelete: '確認刪除？',
    confirmDeleteRecord: '確認刪除',
    confirmIssue: '確認發放並記賬',
    confirmLogout: '確定登出',
    confirmNewPassword: '確認新密碼',
    confirmPassword: '確認密碼',
    confirmRecord: '確認記錄',
    confirmUse: '確認使用',
    copyright: '© 2026 柳味探秘 · 經營查詢 · 版權所有',
    coverCropTitle: '編輯封面',
    coverHint: '將作為個人中心頂部封面展示',
    coverUpdated: '封面已更新',
    cropFailed: '裁切失敗，請重試',
    cropFlip: '翻轉',
    cropPill: '拖動移動 · 雙指縮放',
    cropRotate: '旋轉',
    cumulativeByShare: '累計派發 · 按比例分配',
    cumulativeExpense: '累計支出',
    cumulativeRevenue: '累計營收',
    currentBalance: '當前結餘',
    daily: '日常',
    dailyRevenue: '每日營收',
    dangerZone: '危險操作',
    date: '日期',
    delete: '刪除',
    deleteRecord: '刪除',
    devCodeLabel: '🔧 開發模式 — 驗證碼',
    dineIn: '堂食',
    discountAmount: '優惠減免',
    displayName: '用戶名稱',
    distributedPool: '已派發分紅池',
    dividend: '分紅',
    dividendHistory: '分紅歷史',
    dividendRoundFmt: '第{n}次分紅 · {date}',
    dividendRoundOnly: '第{n}次分紅',
    done: '完成',
    downloadPdf: '下載PDF',
    editBg: '編輯背景圖',
    editCover: '更換封面',
    editProfile: '個人中心',
    email: '郵箱',
    emailAction: '郵件',
    emailBodyExtra: '（連結 24 小時內有效）',
    emptyExpenseHint: '每完成一次記賬，這裡就多一條記錄',
    emptyReconHint: '每完成一次對賬，這裡就多一張小卡片',
    enterAmount: '輸入金額',
    enterCode: '輸入驗證碼',
    entryDate: '錄入日期',
    errDateFuture: '不能選擇未來的日期',
    errDateRange: '結束日期必須晚於開始日期',
    errDateRangeTooLong: '日期範圍不能超過 24 個月',
    errEmailInvalid: '郵箱格式不正確',
    errEmptyFields: '請填寫所有字段',
    errFileSize: '圖片不能超過10MB',
    errNetworkError: '網絡錯誤，請檢查網絡後重試',
    errOldPwRequired: '請輸入當前密碼',
    errPwMismatch: '兩次密碼不一致',
    errPwNeedLetter: '密碼必須包含字母',
    errPwNeedNumber: '密碼必須包含數字',
    errPwNeedSpecial: '密碼必須包含特殊字符',
    errPwTooShort: '密碼至少 8 位',
    errWrongCredentials: '帳號或密碼錯誤',
    expConfirmMsg: '提交後將無法修改，確定要記錄嗎？',
    expConfirmTitle: '確認記錄',
    expDate: '日期',
    expense: '支出',
    expenseCategory: '支出分類',
    expenseDate: '支出日期',
    expenseHistory: '支出記錄',
    expenseNote: '支出說明',
    feeAllMonths: '全部',
    feeCurrent: '當期手續費',
    feeDetail: '更新手續費',
    feeEntry: '今日手續費',
    feeHistory: '歷史明細',
    feePreview: '累計手續費',
    feeViewDetail: '檢視明細',
    filledBy: '填寫人',
    filter: '篩選',
    filterCategory: '支出分類',
    filterDate: '日期',
    flashSale: '閃購',
    forgotPassword: '忘記密碼？',
    forgotSendBtn: '發送驗證碼',
    forgotStep1: '請輸入註冊郵箱',
    friendlyReminder: '溫馨提示',
    fullyPaidBack: '已回本 ✓',
    fullyPaidBackDetail: '已完全回本 ✓',
    fundsInTransit: '在途資金',
    goBack: '返回',
    goods: '採購',
    imgNotLoaded: '圖片未加載',
    income: '收入',
    initial: '初始出資',
    initialInvest: '初始出資',
    invest: '出資',
    investComplete: '出資完結',
    issueDividend: '發起分紅',
    issueProportional: '發起比例分紅',
    janitor: '打雜',
    jd: '京東',
    jokeClosedLoop: '「一個董事長負責畫餅，一個CEO負責烙餅，一個打雜的負責吃餅 —— 完美的商業閉環」',
    jokeRecon: '已為您載入最近一次對賬數據，請核對賬單日期是否正確。',
    language: '語言',
    linkCopied: '連結已複製',
    loadMore: '載入更多',
    loading: '載入中...',
    login: '登錄',
    loginBtn: '登 錄',
    loginPlaceholder: '用戶名 / 郵箱',
    logout: '登出',
    logoutConfirm: '確定要登出嗎？',
    lpControl: '有限合夥控股',
    lpStructure: '有限合夥控股結構',
    meituan: '美團',
    meituanCashier: '美團收銀',
    meituanTuan: '美團團購',
    meituanWaimai: '美團外賣',
    mid: '追加',
    month: '本月',
    monthExpense: '本月支出',
    monthIncome: '本月收入',
    monthProfit: '本月利潤',
    nameJiang: '江寬',
    nameLan: '藍柳富',
    nameZhang: '張安武',
    newEmail: '新郵箱',
    newPassword: '新密碼',
    noDividendRecords: '暫無分紅記錄',
    noExpenseRecords: '暫無支出記錄',
    noRecords: '暫無記錄',
    notePlaceholder: '如：蔥、香菜、電費',
    oldPassword: '當前密碼',
    opacity: '透明度',
    paidInRate: '實繳率',
    partnerSeats: '合夥席位',
    partnerStructure: '合夥架構',
    partnerTitle: '柳味探秘科技合夥人',
    password: '密碼',
    payAlipay: '支付寶',
    payCash: '現金',
    payWechat: '微信',
    paybackProgress: '回本進度',
    paybackRate: '回本率',
    paymentMethod: '支付方式',
    pdfLoadFailed: 'PDF 載入失敗',
    pdfLoading: '載入 PDF 中…',
    pendingPayback: '待回',
    platformFee: '平台手續費',
    preferences: '偏好設定',
    procAddProduct: '添加產品',
    procAll: '全部',
    procBatchCount: '歷史批次',
    procBatchLabel: '採購批次',
    procComingSoon: '即將',
    procConfirmOrder: '確認進貨單',
    procContinue: '繼續進貨',
    procCumulative: '累計貨款',
    procDeleteBatch: '刪除批次',
    procDeleteBatchConfirm: '確定刪除第{n}次進貨？關聯的支出記錄也會一併刪除。',
    procDeleteBatchConfirmV2: '確定刪除「{batch}」？關聯的支出記錄也會一併刪除。',
    procDeleteProduct: '刪除產品',
    procDeleteProductConfirm: '確定刪除「{name}」？',
    procDeleteProductWarning: '刪除後歷史批次中該商品將無法顯示名稱。',
    procDetail: '進貨詳情',
    procEditBatch: '編輯第{n}次進貨',
    procEditProduct: '編輯產品',
    procEmptyHistoryHint: '完成進貨後，記錄會顯示在這裡',
    procEmptyHistoryTitle: '還沒有進貨記錄',
    procEmptyNewHint: '請先在「產品維護」中添加產品，再回來下單',
    procEmptyNewTitle: '還沒有產品',
    procEmptyProductsHint: '點擊上方「+ 添加產品」開始維護產品目錄',
    procEmptyProductsTitle: '還沒有產品',
    procGenerating: '生成中...',
    procGeneratingPDF: '正在生成進貨單…',
    procHistory: '進貨記錄',
    procImages: '憑證預覽',
    procMargin: '貨款利潤率',
    procNewOrder: '新建進貨',
    procNoteHintAddress: '請填寫提貨聯繫地址',
    procNoteHintPhone: '請填寫提貨聯繫電話',
    procNoteLabel: '備註',
    procNoteOptional: '可選備註',
    procNowBatch: '第{n}次進貨',
    procOperator: '經辦人',
    procOrderDate: '進貨日期',
    procOrderItems: '進貨明細',
    procPaymentMethod: '支付方式',
    procPdfTitle: '進貨單 #{n}',
    procProduct: '商品',
    procProductMgmt: '產品維護',
    procProductName: '產品名稱',
    procProductNote: '備註（選填）',
    procProductPrice: '單價',
    procProductSpec: '規格',
    procProductSupplier: '供應商',
    procPurchase: '採購',
    procSearchHistory: '搜尋批次號、日期…',
    procSearchPlaceholder: '搜尋商品…',
    procSearchProducts: '搜尋產品名、供應商…',
    procSelected: '已選',
    procSubmit: '提交進貨單',
    procSubmitted: '進貨單已提交',
    procSubmittedMsg: '本次進貨記錄已儲存',
    procSubtotal: '小計',
    procThisBatch: '本次貨款',
    procTitle: '進貨管理',
    procTotal: '本次合計',
    procUnit: '種',
    procUpdated: '進貨單已更新',
    procUpdatedMsg: '本次進貨記錄已更新',
    procViewDetail: '檢視明細',
    procViewRecords: '檢視記錄',
    procurement: '進貨',
    profileEmail: '電子郵箱',
    profit: '利潤',
    monthlyProfit: '月度利潤',
    monthlyTrend: '月度收支趨勢',
    expenseBreakdown: '支出分類佔比',
    pwHint: '8位以上，含字母+數字+特殊字符',
    receivable: '應收總額',
    reconComplete: '對賬完成',
    reconDate: '對賬日期',
    reconHistory: '對賬記錄',
    reconciledBy: '對賬人',
    recordedBy: '錄入人',
    recrop: '重新裁剪',
    register: '註冊',
    registerBtn: '註 冊',
    rememberMe: '記住我',
    rent: '房租',
    resendCode: '重新發送',
    reset: '重置',
    resetBtn: '重 置',
    resetDefault: '恢復默認',
    resetHint: '驗證碼已發送至',
    revCancelArchive: '取消歇業',
    revClosedReason: '今日歇業',
    revEmpty: '暫無營收記錄',
    revEmptyHint: '開始錄入今天的營收數據吧',
    revEntered: '已錄入',
    revHistory: '近7天記錄',
    revHistoryBtn: '歷史記錄',
    revJD: '京東營收',
    revJDSub: '京東平台收款',
    revMarkArchive: '標記歇業',
    revNotEntered: '未錄入',
    revNote: '備註',
    revNoteHint: '如：今日活動、特殊事件',
    revQuickDB4: '前天',
    revQuickToday: '今天',
    revQuickYesterday: '昨天',
    revRevenue: '營業額收入',
    revRevenueSub: '實際到賬金額',
    revSaveDayBefore: '儲存前日數據',
    revSaveToday: '儲存今日數據',
    revSaveYesterday: '儲存昨日數據',
    revSubmit: '確認錄入',
    revTurnover: '營業額',
    revTurnoverSub: '總銷售流水額',
    revWeekJD: '近30日京東營收',
    revWeekRevenue: '近30日營業額收入',
    revWeekTurnover: '近30日營業額',
    revYesterdayLabel: '昨日:',
    revYesterdayNA: '—',
    revenue: '營業額',
    revenueDate: '营收日期',
    roundNote: '輪次備註',
    salary: '薪資',
    saveImage: '儲存圖片',
    securitySettings: '安全設定',
    sendCode: '發送驗證碼',
    sessionKickedButton: '我知道了',
    sessionKickedTitle: '帳號已登出',
    sessionKickedToast: '您的帳號在其他裝置登入，當前工作階段已退出',
    sessionTimeoutDesc: '超過該時長未操作自動退出',
    sessionTimeoutLabel: '超時時間',
    shangouWaimai: '閃購外賣',
    share: '分享',
    shareCalcResult: '穿透股權計算結果：',
    shareFailed: '分享失敗',
    shareLink: '分享連結',
    sharePercent: '持股',
    shareholders: '位股東',
    signaturePlaceholder: '這個人很懶，什麼都沒留下...',
    ssoDesc: '最多一台裝置同時登入',
    ssoLabel: '單一裝置登入',
    stampPrefixBurgundy: '以此身，閱盡這',
    stampPrefixObsidian: '時序輪轉，流光已擲下第',
    stampPrefixTeal: '星霜未歇，我們已共渡',
    stampSuffixBurgundy: '日的晨昏與煙火。',
    stampSuffixObsidian: '道鞭影。',
    stampSuffixTeal: '次潮落潮生。',
    status: '狀態',
    subscribedTotal: '認繳總額',
    subtitle: '生活不簡單，盡量簡單過',
    summary: '收支總覽',
    tabExpense: '支出',
    tabRecon: '對賬',
    tabRevenue: '營業',
    tapForDetail: '點擊卡片檢視詳情',
    themeLabel: '主題',
    themePicker: '主題方案',
    toastLoadFailed: '資料載入失敗',
    toastSubmitFailed: '提交失敗，請重試',
    today: '今日',
    todayExpense: '今日支出',
    todayIncome: '今日收入',
    todayProfit: '今日利潤',
    totalCapital: '合夥初始基金總額',
    totalDividends: '累計分紅',
    totalDividendsPaid: '累計分紅',
    totalInvest: '總出資',
    totalToPool: '擬向紅利池注入的總金額 (元)',
    tuan: '團購',
    uploadFailed: '上傳失敗，請重試',
    uploadFailedShort: '上傳失敗',
    uploadImage: '憑證上傳',
    uploading: '上傳中...',
    useThisAvatar: '使用此頭像',
    useThisBg: '使用此背景圖',
    useThisCover: '使用此封面',
    username: '帳號',
    verifyBtn: '驗 證',
    verifyCode: '驗證碼',
    verifyEmail: '驗證郵箱',
    verifyNewBodyPost: '。請前往查收並點擊鏈接完成驗證。',
    verifyNewBodyPre: '歡迎加入柳味探秘科技！一封装有激活密碼的郵件已經飛往您的郵箱：',
    verifyNewEditEmail: '修改郵箱地址',
    verifyNewNoEmail: '一直沒收到？別着急，您可以 ',
    verifyNewOrSpam: ' 或檢查一下垃圾箱。',
    verifyNewResend: '重新發送',
    verifyNewTitle: '只差最後一步啦！✨',
    verifyNewWrongEmail: '填錯郵箱了？',
    verifying: '驗證中...',
    wages: '工資',
    willDelete: '將刪除「',
  },
  'en': {
    accountInfo: 'Account Info',
    actualReceived: 'Actual Received',
    addFeeEntry: 'Add Fee',
    addImage: 'Add',
    additional: 'Additional Capital',
    all: 'All',
    allDividendRecords: '" all dividend records',
    amount: 'Amount',
    amountLabel: 'Amount (¥)',
    any: 'Any',
    apply: 'Apply',
    atLeastOneFee: 'Please enter at least one platform fee',
    authSettingsTitle: 'Sign-in Security',
    autoByShare: 'Auto-distribute by share ratio',
    avatarCropTitle: 'Adjust Avatar',
    avatarSizeHint: 'Preview in different sizes',
    avatarUpdated: 'Avatar Updated',
    back: 'Back',
    backToLogin: 'Back to login',
    batchLabel: '{date} \u00b7 Batch #{n}',
    bgHint: 'Choose an image as home page background',
    bgResultHint: 'Will be used as fullscreen home background',
    bgSettings: 'Theme',
    bgUpdated: 'Background Updated',
    billDate: 'Bill Date',
    bookBalance: 'Book Balance',
    bookDiff: 'Difference',
    byRoundAndInvest: 'By dividend round & investment',
    cancel: 'Cancel',
    capitalLedger: 'Partner Capital Ledger',
    cardBalance: 'Card Balance',
    cashBalance: 'Cash',
    cashOnHand: 'Cash on Hand',
    ceo: 'CEO',
    chairman: 'Chairman',
    changeEmail: 'Change Email',
    changePassword: 'Change Password',
    chooseImage: 'Choose Image',
    clear: 'Clear',
    codeSent: 'Code sent',
    confirm: 'Confirm',
    confirmDelete: 'Confirm delete?',
    confirmDeleteRecord: 'Confirm Delete',
    confirmIssue: 'Confirm & Record',
    confirmLogout: 'Confirm Logout',
    confirmNewPassword: 'Confirm New Password',
    confirmPassword: 'Confirm Password',
    confirmRecord: 'Record',
    confirmUse: 'Confirm',
    copyright: '© 2026 LiuWei TanMi · Business Dashboard · All Rights Reserved',
    coverCropTitle: 'Edit Cover',
    coverHint: 'Will be displayed as your profile banner',
    coverUpdated: 'Cover Updated',
    cropFailed: 'Crop failed, please retry',
    cropFlip: 'Flip',
    cropPill: 'Drag · Pinch to zoom',
    cropRotate: 'Rotate',
    cumulativeByShare: 'Cumulative · by share ratio',
    cumulativeExpense: 'Cumulative Expense',
    cumulativeRevenue: 'Cumulative Revenue',
    currentBalance: 'Balance',
    daily: 'Daily',
    dailyRevenue: 'Daily Revenue',
    dangerZone: 'Danger Zone',
    date: 'Date',
    delete: 'Delete',
    deleteRecord: 'Delete',
    devCodeLabel: '🔧 Dev Mode — Verification Code',
    dineIn: 'Dine-in',
    discountAmount: 'Discount',
    displayName: 'Username',
    distributedPool: 'Distributed Pool',
    dividend: 'Dividend',
    dividendHistory: 'Dividend History',
    dividendRoundFmt: 'Dividend #{n} · {date}',
    dividendRoundOnly: 'Dividend #{n}',
    done: 'Done',
    downloadPdf: 'Download PDF',
    editBg: 'Edit Background',
    editCover: 'Change Cover',
    editProfile: 'Profile',
    email: 'Email',
    emailAction: 'Email',
    emailBodyExtra: '(link valid for 24h)',
    emptyExpenseHint: 'Each expense record will appear here',
    emptyReconHint: 'Each reconciliation adds a card here',
    enterAmount: 'Enter amount',
    enterCode: 'Enter code',
    entryDate: 'Entry Date',
    errDateFuture: 'Cannot select a future date',
    errDateRange: 'End date must be after start date',
    errDateRangeTooLong: 'Date range cannot exceed 24 months',
    errEmailInvalid: 'Invalid email format',
    errEmptyFields: 'Please fill all fields',
    errFileSize: 'Image must be under 10MB',
    errNetworkError: 'Network error, please check your connection',
    errOldPwRequired: 'Please enter current password',
    errPwMismatch: 'Passwords do not match',
    errPwNeedLetter: 'Password must contain a letter',
    errPwNeedNumber: 'Password must contain a number',
    errPwNeedSpecial: 'Password must contain a special char',
    errPwTooShort: 'Password must be at least 8 chars',
    errWrongCredentials: 'Wrong username or password',
    expConfirmMsg: 'This cannot be edited after submission. Proceed?',
    expConfirmTitle: 'Confirm Record',
    expDate: 'Date',
    expense: 'Expense',
    expenseCategory: 'Category',
    expenseDate: 'Expense Date',
    expenseHistory: 'Expense Records',
    expenseNote: 'Description',
    feeAllMonths: 'All',
    feeCurrent: 'Current Fee',
    feeDetail: 'Update Fees',
    feeEntry: 'Today Fee',
    feeHistory: 'History',
    feePreview: 'Cumulative',
    feeViewDetail: 'View Details',
    filledBy: 'Filled by',
    filter: 'Filter',
    filterCategory: 'Category',
    filterDate: 'Date',
    flashSale: 'Flash Sale',
    forgotPassword: 'Forgot password?',
    forgotSendBtn: 'Send Code',
    forgotStep1: 'Enter registered email',
    friendlyReminder: 'Friendly Reminder',
    fullyPaidBack: 'Paid Back ✓',
    fullyPaidBackDetail: 'Fully Paid Back ✓',
    fundsInTransit: 'Funds in Transit',
    goBack: 'Go back',
    goods: 'Procurement',
    imgNotLoaded: 'Image not loaded',
    income: 'Income',
    initial: 'Initial Capital',
    initialInvest: 'Initial Capital',
    invest: 'Capital',
    investComplete: 'Paid Up',
    issueDividend: 'Issue Dividend',
    issueProportional: 'Issue Proportional Dividend',
    janitor: 'Helper',
    jd: 'JD.com',
    jokeClosedLoop: '「One chairman paints the pie, one CEO bakes it, one helper eats it — the perfect business loop」',
    jokeRecon: 'The latest reconciliation data has been loaded. Please verify the bill date is correct.',
    language: 'Language',
    linkCopied: 'Link copied',
    loadMore: 'Load More',
    loading: 'Loading...',
    login: 'Login',
    loginBtn: 'Login',
    loginPlaceholder: 'Username / Email',
    logout: 'Logout',
    logoutConfirm: 'Are you sure you want to log out?',
    lpControl: 'Limited Partnership Control',
    lpStructure: 'LP Holding Structure',
    meituan: 'Meituan',
    meituanCashier: 'Meituan POS',
    meituanTuan: 'Meituan Tuan',
    meituanWaimai: 'Meituan Waimai',
    mid: 'Additional',
    month: 'Month',
    monthExpense: 'Month Expense',
    monthIncome: 'Month Income',
    monthProfit: 'Month Profit',
    nameJiang: 'Jiang Kuan',
    nameLan: 'Lan Liufu',
    nameZhang: 'Zhang Anwu',
    newEmail: 'New Email',
    newPassword: 'New Password',
    noDividendRecords: 'No dividend records',
    noExpenseRecords: 'No expense records',
    noRecords: 'No records yet',
    notePlaceholder: 'e.g. scallions, cilantro, electricity',
    oldPassword: 'Current Password',
    opacity: 'Opacity',
    paidInRate: 'Paid-in rate',
    partnerSeats: 'Partner Seats',
    partnerStructure: 'Partner Structure',
    partnerTitle: 'LiuWei TanMi Technology Partners',
    password: 'Password',
    payAlipay: 'Alipay',
    payCash: 'Cash',
    payWechat: 'WeChat',
    paybackProgress: 'Payback Progress',
    paybackRate: 'Payback Rate',
    paymentMethod: 'Payment Method',
    pdfLoadFailed: 'Failed to load PDF',
    pdfLoading: 'Loading PDF…',
    pendingPayback: 'Pending',
    platformFee: 'Platform Fees',
    preferences: 'Preferences',
    procAddProduct: 'Add Product',
    procAll: 'All',
    procBatchCount: 'Past Batches',
    procBatchLabel: 'Batch',
    procComingSoon: 'Coming Soon',
    procConfirmOrder: 'Confirm Order',
    procContinue: 'Continue',
    procCumulative: 'Total Spent',
    procDeleteBatch: 'Delete Batch',
    procDeleteBatchConfirm: 'Delete Batch #{n}? The linked expense record will also be removed.',
    procDeleteBatchConfirmV2: 'Delete "{batch}"? The linked expense record will also be removed.',
    procDeleteProduct: 'Delete Product',
    procDeleteProductConfirm: 'Delete "{name}"?',
    procDeleteProductWarning: 'Historical batches will no longer display the product name.',
    procDetail: 'Procurement Detail',
    procEditBatch: 'Edit Batch #{n}',
    procEditProduct: 'Edit Product',
    procEmptyHistoryHint: 'Records will appear here once you complete a procurement',
    procEmptyHistoryTitle: 'No procurement records',
    procEmptyNewHint: 'Add products in "Product Mgmt" first, then come back to order',
    procEmptyNewTitle: 'No products yet',
    procEmptyProductsHint: 'Tap "+ Add Product" above to start building your catalog',
    procEmptyProductsTitle: 'No products yet',
    procGenerating: 'Generating...',
    procGeneratingPDF: 'Generating purchase order...',
    procHistory: 'History',
    procImages: 'Voucher Preview',
    procMargin: 'Margin',
    procNewOrder: 'New Order',
    procNoteHintAddress: 'Pickup address',
    procNoteHintPhone: 'Pickup phone',
    procNoteLabel: 'Note',
    procNoteOptional: 'Note (optional)',
    procNowBatch: 'Batch #{n}',
    procOperator: 'Operator',
    procOrderDate: 'Date',
    procOrderItems: 'Items',
    procPaymentMethod: 'Payment',
    procPdfTitle: 'Order #{n}',
    procProduct: 'Product',
    procProductMgmt: 'Products',
    procProductName: 'Name',
    procProductNote: 'Note (optional)',
    procProductPrice: 'Price',
    procProductSpec: 'Spec',
    procProductSupplier: 'Supplier',
    procPurchase: 'Procurement',
    procSearchHistory: 'Search batch#, date…',
    procSearchPlaceholder: 'Search products…',
    procSearchProducts: 'Search name, supplier…',
    procSelected: 'Selected',
    procSubmit: 'Submit Order',
    procSubmitted: 'Order Submitted',
    procSubmittedMsg: 'Procurement order saved',
    procSubtotal: 'Subtotal',
    procThisBatch: 'This Batch',
    procTitle: 'Procurement',
    procTotal: 'Total',
    procUnit: 'items',
    procUpdated: 'Order Updated',
    procUpdatedMsg: 'Procurement order updated',
    procViewDetail: 'View Details',
    procViewRecords: 'View Records',
    procurement: 'Purchase',
    profileEmail: 'Email Address',
    profit: 'Profit',
    monthlyProfit: 'Monthly Profit',
    monthlyTrend: 'Monthly Trend',
    expenseBreakdown: 'Expense Breakdown',
    pwHint: '8+ chars, letter + number + special',
    receivable: 'Total Receivable',
    reconComplete: 'Complete Recon',
    reconDate: 'Date',
    reconHistory: 'Recon History',
    reconciledBy: 'Reconciled by',
    recordedBy: 'By',
    recrop: 'Re-crop',
    register: 'Register',
    registerBtn: 'Register',
    rememberMe: 'Remember me',
    rent: 'Rent',
    resendCode: 'Resend',
    reset: 'Reset',
    resetBtn: 'Reset',
    resetDefault: 'Reset to Default',
    resetHint: 'Code sent to',
    revCancelArchive: 'Reopen for Business',
    revClosedReason: 'Closed for the day',
    revEmpty: 'No records',
    revEmptyHint: 'Start recording daily revenue',
    revEntered: 'Done',
    revHistory: 'Last 7 Days',
    revHistoryBtn: 'History',
    revJD: 'JD Revenue',
    revJDSub: 'JD Platform',
    revMarkArchive: 'Mark Closed',
    revNotEntered: 'Pending',
    revNote: 'Note',
    revNoteHint: 'e.g. events, promos',
    revQuickDB4: 'DB4',
    revQuickToday: 'Today',
    revQuickYesterday: 'Ytd',
    revRevenue: 'Revenue',
    revRevenueSub: 'Actual Received',
    revSaveDayBefore: 'Save Day Before',
    revSaveToday: 'Save Today',
    revSaveYesterday: 'Save Yesterday',
    revSubmit: 'Submit',
    revTurnover: 'Turnover',
    revTurnoverSub: 'Total Sales',
    revWeekJD: '30-Day JD Revenue',
    revWeekRevenue: '30-Day Revenue',
    revWeekTurnover: '30-Day Turnover',
    revYesterdayLabel: 'Ytd:',
    revYesterdayNA: '—',
    revenue: 'Revenue',
    revenueDate: 'Revenue Date',
    roundNote: 'Round Note',
    salary: 'Salary',
    saveImage: 'Save image',
    securitySettings: 'Security Settings',
    sendCode: 'Send Code',
    sessionKickedButton: 'OK',
    sessionKickedTitle: 'Signed out',
    sessionKickedToast: 'Signed in elsewhere. This session was ended.',
    sessionTimeoutDesc: 'Auto sign-out after this idle period',
    sessionTimeoutLabel: 'Session timeout',
    shangouWaimai: 'Flash Waimai',
    share: 'Share',
    shareCalcResult: 'Share calculation result:',
    shareFailed: 'Share failed',
    shareLink: 'Share link',
    sharePercent: 'Share',
    shareholders: 'shareholders',
    signaturePlaceholder: 'This person is lazy and left nothing...',
    ssoDesc: 'Only one device can stay signed in at a time',
    ssoLabel: 'Single-device sign-in',
    stampPrefixBurgundy: 'In this body, I have witnessed',
    stampPrefixObsidian: 'The light has cast its',
    stampPrefixTeal: 'Under starry frost, we have weathered',
    stampSuffixBurgundy: ' dawns and dusks of mortal life.',
    stampSuffixObsidian: ' lash upon these seasons.',
    stampSuffixTeal: ' tides of rise and fall.',
    status: 'Status',
    subscribedTotal: 'Total Subscription',
    subtitle: 'Life is not simple, keep it simple',
    summary: 'Summary',
    tabExpense: 'Expenses',
    tabRecon: 'Recon',
    tabRevenue: 'Revenue',
    tapForDetail: 'Tap card for details',
    themeLabel: 'Theme',
    themePicker: 'Theme',
    toastLoadFailed: 'Failed to load data',
    toastSubmitFailed: 'Submit failed, please retry',
    today: 'Today',
    todayExpense: 'Today Expense',
    todayIncome: 'Today Income',
    todayProfit: 'Today Profit',
    totalCapital: 'Total Initial Capital',
    totalDividends: 'Total Dividends',
    totalDividendsPaid: 'Total Dividends',
    totalInvest: 'Total Investment',
    totalToPool: 'Total amount to dividend pool (¥)',
    tuan: 'Group Buy',
    uploadFailed: 'Upload failed, please retry',
    uploadFailedShort: 'Upload failed',
    uploadImage: 'Upload Receipt',
    uploading: 'Uploading...',
    useThisAvatar: 'Use This Avatar',
    useThisBg: 'Use This Background',
    useThisCover: 'Use This Cover',
    username: 'Account',
    verifyBtn: 'Verify',
    verifyCode: 'Verification Code',
    verifyEmail: 'Verify Email',
    verifyNewBodyPost: '. Please check your inbox and follow the link to verify.',
    verifyNewBodyPre: 'Welcome to LiuWei TanMi! An activation code email is on its way to: ',
    verifyNewEditEmail: 'Edit email',
    verifyNewNoEmail: 'Haven\'t received it? Don\'t worry, you can ',
    verifyNewOrSpam: ' or check your spam folder.',
    verifyNewResend: 'resend',
    verifyNewTitle: 'Just one last step! ✨',
    verifyNewWrongEmail: 'Wrong email address? ',
    verifying: 'Verifying...',
    wages: 'Wages',
    willDelete: 'Will delete "',
  },
};

type Lang = 'zh-CN' | 'zh-TW' | 'en';

export const langs: [Lang, string][] = [
  ['zh-CN', '简'],
  ['zh-TW', '繁'],
  ['en', 'EN'],
];

// ═══════════════════════════════════════════════════════════════
// Type-safe i18n key — all 365 zh-CN keys. Use this type for
// variables that hold i18n keys to catch typos at compile time.
// For dynamic keys from DB enums, cast with `as I18nKey`.
// ═══════════════════════════════════════════════════════════════
export type I18nKey =
  | 'accountInfo'
  | 'actualReceived'
  | 'addFeeEntry'
  | 'addImage'
  | 'additional'
  | 'all'
  | 'allDividendRecords'
  | 'amount'
  | 'amountLabel'
  | 'any'
  | 'apply'
  | 'atLeastOneFee'
  | 'authSettingsTitle'
  | 'autoByShare'
  | 'avatarCropTitle'
  | 'avatarSizeHint'
  | 'avatarUpdated'
  | 'backToLogin'
  | 'batchLabel'
  | 'bgHint'
  | 'bgResultHint'
  | 'bgSettings'
  | 'bgUpdated'
  | 'billDate'
  | 'bookBalance'
  | 'bookDiff'
  | 'byRoundAndInvest'
  | 'cancel'
  | 'capitalLedger'
  | 'cardBalance'
  | 'cashBalance'
  | 'cashOnHand'
  | 'ceo'
  | 'chairman'
  | 'changeEmail'
  | 'changePassword'
  | 'chooseImage'
  | 'clear'
  | 'codeSent'
  | 'confirm'
  | 'confirmDelete'
  | 'confirmDeleteRecord'
  | 'confirmIssue'
  | 'confirmLogout'
  | 'confirmNewPassword'
  | 'confirmPassword'
  | 'confirmRecord'
  | 'confirmUse'
  | 'copyright'
  | 'coverCropTitle'
  | 'coverHint'
  | 'coverUpdated'
  | 'cropFailed'
  | 'cropFlip'
  | 'cropPill'
  | 'cropRotate'
  | 'cumulativeByShare'
  | 'cumulativeExpense'
  | 'cumulativeRevenue'
  | 'currentBalance'
  | 'daily'
  | 'dailyRevenue'
  | 'dangerZone'
  | 'date'
  | 'delete'
  | 'deleteRecord'
  | 'devCodeLabel'
  | 'dineIn'
  | 'discountAmount'
  | 'displayName'
  | 'distributedPool'
  | 'dividend'
  | 'dividendHistory'
  | 'dividendRoundFmt'
  | 'dividendRoundOnly'
  | 'done'
  | 'downloadPdf'
  | 'editBg'
  | 'editCover'
  | 'editProfile'
  | 'email'
  | 'emailAction'
  | 'emailBodyExtra'
  | 'emptyExpenseHint'
  | 'emptyReconHint'
  | 'enterAmount'
  | 'enterCode'
  | 'entryDate'
  | 'errDateFuture'
  | 'errDateRange'
  | 'errDateRangeTooLong'
  | 'errEmailInvalid'
  | 'errEmptyFields'
  | 'errFileSize'
  | 'errNetworkError'
  | 'errOldPwRequired'
  | 'errPwMismatch'
  | 'errPwNeedLetter'
  | 'errPwNeedNumber'
  | 'errPwNeedSpecial'
  | 'errPwTooShort'
  | 'errWrongCredentials'
  | 'expConfirmMsg'
  | 'expConfirmTitle'
  | 'expDate'
  | 'expense'
  | 'expenseCategory'
  | 'expenseDate'
  | 'expenseHistory'
  | 'expenseNote'
  | 'expenseBreakdown'
  | 'feeAllMonths'
  | 'feeCurrent'
  | 'feeDetail'
  | 'feeEntry'
  | 'feeHistory'
  | 'feePreview'
  | 'feeViewDetail'
  | 'filledBy'
  | 'filter'
  | 'filterCategory'
  | 'filterDate'
  | 'flashSale'
  | 'forgotPassword'
  | 'forgotSendBtn'
  | 'forgotStep1'
  | 'friendlyReminder'
  | 'fullyPaidBack'
  | 'fullyPaidBackDetail'
  | 'fundsInTransit'
  | 'goBack'
  | 'goods'
  | 'imgNotLoaded'
  | 'income'
  | 'initial'
  | 'initialInvest'
  | 'invest'
  | 'investComplete'
  | 'issueDividend'
  | 'issueProportional'
  | 'janitor'
  | 'jd'
  | 'jokeClosedLoop'
  | 'jokeRecon'
  | 'language'
  | 'linkCopied'
  | 'loadMore'
  | 'loading'
  | 'login'
  | 'loginBtn'
  | 'loginPlaceholder'
  | 'logout'
  | 'logoutConfirm'
  | 'lpControl'
  | 'lpStructure'
  | 'meituan'
  | 'meituanCashier'
  | 'meituanTuan'
  | 'meituanWaimai'
  | 'mid'
  | 'month'
  | 'monthExpense'
  | 'monthIncome'
  | 'monthProfit'
  | 'monthlyProfit'
  | 'monthlyTrend'
  | 'nameJiang'
  | 'nameLan'
  | 'nameZhang'
  | 'newEmail'
  | 'newPassword'
  | 'noDividendRecords'
  | 'noRecords'
  | 'notePlaceholder'
  | 'oldPassword'
  | 'opacity'
  | 'paidInRate'
  | 'partnerSeats'
  | 'partnerStructure'
  | 'partnerTitle'
  | 'password'
  | 'payAlipay'
  | 'payCash'
  | 'payWechat'
  | 'paybackProgress'
  | 'paybackRate'
  | 'paymentMethod'
  | 'pdfLoadFailed'
  | 'pdfLoading'
  | 'pendingPayback'
  | 'platformFee'
  | 'preferences'
  | 'procAddProduct'
  | 'procAll'
  | 'procBatchCount'
  | 'procBatchLabel'
  | 'procComingSoon'
  | 'procConfirmOrder'
  | 'procContinue'
  | 'procCumulative'
  | 'procDeleteBatch'
  | 'procDeleteBatchConfirm'
  | 'procDeleteBatchConfirmV2'
  | 'procDeleteProduct'
  | 'procDeleteProductConfirm'
  | 'procDeleteProductWarning'
  | 'procDetail'
  | 'procEditBatch'
  | 'procEditProduct'
  | 'procEmptyHistoryHint'
  | 'procEmptyHistoryTitle'
  | 'procEmptyNewHint'
  | 'procEmptyNewTitle'
  | 'procEmptyProductsHint'
  | 'procEmptyProductsTitle'
  | 'procGenerating'
  | 'procGeneratingPDF'
  | 'procHistory'
  | 'procImages'
  | 'procMargin'
  | 'procNewOrder'
  | 'procNoteHintAddress'
  | 'procNoteHintPhone'
  | 'procNoteLabel'
  | 'procNoteOptional'
  | 'procNowBatch'
  | 'procOperator'
  | 'procOrderDate'
  | 'procOrderItems'
  | 'procPaymentMethod'
  | 'procPdfTitle'
  | 'procProduct'
  | 'procProductMgmt'
  | 'procProductName'
  | 'procProductNote'
  | 'procProductPrice'
  | 'procProductSpec'
  | 'procProductSupplier'
  | 'procPurchase'
  | 'procSearchHistory'
  | 'procSearchPlaceholder'
  | 'procSearchProducts'
  | 'procSelected'
  | 'procSubmit'
  | 'procSubmitted'
  | 'procSubmittedMsg'
  | 'procSubtotal'
  | 'procThisBatch'
  | 'procTitle'
  | 'procTotal'
  | 'procUnit'
  | 'procUpdated'
  | 'procUpdatedMsg'
  | 'procViewDetail'
  | 'procViewRecords'
  | 'procurement'
  | 'profileEmail'
  | 'profit'
  | 'pwHint'
  | 'receivable'
  | 'reconComplete'
  | 'reconDate'
  | 'reconHistory'
  | 'reconciledBy'
  | 'recordedBy'
  | 'recrop'
  | 'register'
  | 'registerBtn'
  | 'rememberMe'
  | 'rent'
  | 'resendCode'
  | 'reset'
  | 'resetBtn'
  | 'resetDefault'
  | 'resetHint'
  | 'revCancelArchive'
  | 'revClosedReason'
  | 'revEmpty'
  | 'revEmptyHint'
  | 'revEntered'
  | 'revHistory'
  | 'revHistoryBtn'
  | 'revJD'
  | 'revJDSub'
  | 'revMarkArchive'
  | 'revNotEntered'
  | 'revNote'
  | 'revNoteHint'
  | 'revQuickDB4'
  | 'revQuickToday'
  | 'revQuickYesterday'
  | 'revRevenue'
  | 'revRevenueSub'
  | 'revSaveDayBefore'
  | 'revSaveToday'
  | 'revSaveYesterday'
  | 'revSubmit'
  | 'revTurnover'
  | 'revTurnoverSub'
  | 'revWeekJD'
  | 'revWeekRevenue'
  | 'revWeekTurnover'
  | 'revYesterdayLabel'
  | 'revYesterdayNA'
  | 'revenue'
  | 'revenueDate'
  | 'roundNote'
  | 'salary'
  | 'saveImage'
  | 'securitySettings'
  | 'sendCode'
  | 'sessionKickedButton'
  | 'sessionKickedTitle'
  | 'sessionKickedToast'
  | 'sessionTimeoutDesc'
  | 'sessionTimeoutLabel'
  | 'shangouWaimai'
  | 'share'
  | 'shareCalcResult'
  | 'shareFailed'
  | 'shareLink'
  | 'sharePercent'
  | 'shareholders'
  | 'signaturePlaceholder'
  | 'ssoDesc'
  | 'ssoLabel'
  | 'stampPrefixBurgundy'
  | 'stampPrefixObsidian'
  | 'stampPrefixTeal'
  | 'stampSuffixBurgundy'
  | 'stampSuffixObsidian'
  | 'stampSuffixTeal'
  | 'status'
  | 'subscribedTotal'
  | 'subtitle'
  | 'summary'
  | 'tabExpense'
  | 'tabRecon'
  | 'tabRevenue'
  | 'tapForDetail'
  | 'themeLabel'
  | 'themePicker'
  | 'toastLoadFailed'
  | 'toastSubmitFailed'
  | 'today'
  | 'todayExpense'
  | 'todayIncome'
  | 'todayProfit'
  | 'totalCapital'
  | 'totalDividends'
  | 'totalDividendsPaid'
  | 'totalInvest'
  | 'totalToPool'
  | 'tuan'
  | 'uploadFailed'
  | 'uploadFailedShort'
  | 'uploadImage'
  | 'uploading'
  | 'useThisAvatar'
  | 'useThisBg'
  | 'useThisCover'
  | 'username'
  | 'verifyBtn'
  | 'verifyCode'
  | 'verifyEmail'
  | 'verifyNewBodyPost'
  | 'verifyNewBodyPre'
  | 'verifyNewEditEmail'
  | 'verifyNewNoEmail'
  | 'verifyNewOrSpam'
  | 'verifyNewResend'
  | 'verifyNewTitle'
  | 'verifyNewWrongEmail'
  | 'verifying'
  | 'wages'
  | 'willDelete';

export function t(key: I18nKey): string {
  const lang = (typeof window !== 'undefined' ? (window as any).curLang : null) || 'zh-CN';
  return I18N[lang]?.[key] || I18N['zh-CN']?.[key] || key;
}

export function getLang(): string {
  if (typeof window !== 'undefined') {
    return (window as any).curLang || 'zh-CN';
  }
  return 'zh-CN';
}

interface LangContextValue {
  lang: string;
  setLang: (lang: string) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: 'zh-CN',
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const [lang, setLangState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (window as any).curLang || localStorage.getItem('lang') || 'zh-CN';
    }
    return 'zh-CN';
  });

  const setLang = useCallback((l: string) => {
    setLangState(l);
    if (typeof window !== 'undefined') {
      (window as any).curLang = l;
      try { localStorage.setItem('lang', l); } catch {}
    }
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
