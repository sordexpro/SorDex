import {
  createPublicClient, createWalletClient, custom, http, parseUnits, formatUnits,
  parseAbi, privateKeyToAccount, generatePrivateKey, encodeFunctionData,
} from '/viem.js';

const CONFIG = {
  rpc: window.__SORDEX__.rpc,
  book: window.__SORDEX__.book,
  listing: window.__SORDEX__.listing,
  feeVault: window.__SORDEX__.feeVault,
  settler: window.__SORDEX__.settler,
  router: window.__SORDEX__.router,
  vault: window.__SORDEX__.vault,
  mmRegistry: window.__SORDEX__.mmRegistry,
  quoteToken: window.__SORDEX__.quoteToken,
  chainId: window.__SORDEX__.chainId,

  apiBase: window.__SORDEX__.apiBase || '/api',
};

const CHAIN = {
  id: CONFIG.chainId,
  name: CONFIG.chainId === 56 ? 'BNB Smart Chain' : CONFIG.chainId === 97 ? 'BSC Testnet' : ('Chain ' + CONFIG.chainId),
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: [ (typeof location !== 'undefined' ? location.origin : '') + CONFIG.rpc ] } },
};

const api = (path) => CONFIG.apiBase + path;

const bookAbi = parseAbi([
  'function placeBuy(uint256 pairId, uint256 qty, uint256 priceNum, uint256 priceDen, uint64 expiry) returns (uint256)',
  'function placeSell(uint256 pairId, uint256 qty, uint256 priceNum, uint256 priceDen, uint64 expiry) returns (uint256)',
  'function cancelOrder(uint256 id)',
  'function amendOrder(uint256 id, uint256 newPriceNum, uint256 newPriceDen, uint256 newQty)',
  'function getOrder(uint256 id) view returns ((uint256 id, address owner, uint256 pairId, uint8 side, uint256 priceNum, uint256 priceDen, uint256 originalBaseQty, uint256 remainingBaseQty, uint256 lockedQuote, uint64 createdSeq, uint64 expiry, uint16 feeBps, uint16 makerFeeBps, uint16 buyTaxBps, uint16 sellTaxBps, address taxRecipient, uint8 status, uint256 firstSeq))',
  'function orderCount() view returns (uint256)',
]);
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function decimals() view returns (uint8)',
]);

const routerAbi = parseAbi([
  'function takeMixed((uint256 pairId, bool takerBuys, uint256 limitNum, uint256 limitDen, uint256 deadline, uint256 maxOnchainBase, uint256[] onchainMakerIds, uint256 maxSignedBase, (address maker,uint256 pairId,uint8 side,uint256 priceNum,uint256 priceDen,uint256 baseQty,uint64 expiry,uint256 nonce,uint256 salt)[] quotes, bytes[] signatures, uint256 maxTotalBase, uint256 minTakerOut) pr) returns (uint256, uint256)',
]);

const vaultAbi = parseAbi([
  'function deposit(uint256 pairId, address token, uint256 amount)',
  'function deposit2(uint256 pairId, address tokenA, uint256 amtA, address tokenB, uint256 amtB)',
  'function availableOf(address mm, uint256 pairId, address token) view returns (uint256)',
  'function requestWithdraw(uint256 pairId, address token, uint256 amount)',
  'function executeWithdraw(uint256 pairId, address token)',
  'function cancelWithdraw(uint256 pairId, address token)',
  'function pendingWithdraw(address mm, uint256 pairId, address token) view returns (uint256)',
  'function unlockAt(address mm, uint256 pairId, address token) view returns (uint256)',
  'function withdrawDelay() view returns (uint64)',
]);

const settlerCancelAbi = parseAbi([
  'function cancelQuoteUpTo(uint256 newMinNonce)',
  'function minValidNonce(address) view returns (uint256)',
]);

const settlerAgentAbi = parseAbi([
  'function setAgent(address agent, uint64 expiry)',
  'function isAuthorizedAgent(address maker, address agent) view returns (bool)',
  'function agentExpiry(address, address) view returns (uint64)',
]);

const settlerCustodyAbi = parseAbi([
  'function setCustody(uint8 mode)',
  'function makerCustody(address) view returns (uint8)',
]);
const settlerBandAbi = parseAbi([
  'function setPriceBand(uint256 pairId, uint256 minNum, uint256 minDen, uint256 maxNum, uint256 maxDen)',
  'function makerBand(address, uint256) view returns (uint256 minNum, uint256 minDen, uint256 maxNum, uint256 maxDen, bool set)',
]);

const listingCreateAbi = parseAbi([
  'function createPair(address base, uint256 tickNum, uint256 tickDen, uint256 minBaseQty, uint256 minNotional, uint64 openTime) payable returns (uint256)',
  'function pairCount() view returns (uint256)',
  'function createFee() view returns (uint256)',
  'function quoteToken() view returns (address)',
  'event PairCreated(uint256 indexed pairId, address indexed base, address indexed creator, uint64 openTime)',

  'error PairExists()',
  'error NotContract()',
  'error BadFee()',
  'error ZeroAddress()',
  'error BadTick()',
  'error OpenTooFar()',
  'error BadParams()',
]);

const LISTING_ERR_KEY = {
  PairExists: 'wiz.errExists', NotContract: 'wiz.errNotContract', BadFee: 'wiz.errBadFee',
  ZeroAddress: 'wiz.errZeroAddr', BadTick: 'wiz.errBadTick', OpenTooFar: 'wiz.errOpenTooFar', BadParams: 'wiz.errBadParams',
};

const LISTING_ERR_SELECTOR = {
  '0x3d77e891': 'wiz.errExists', '0x6f7c43f1': 'wiz.errNotContract', '0x917f1a53': 'wiz.errBadFee',
  '0xd92e233d': 'wiz.errZeroAddr', '0xbad690b4': 'wiz.errBadTick', '0x8f012ea9': 'wiz.errOpenTooFar', '0x019af637': 'wiz.errBadParams',
};
function listingErrMsg(e) {
  const name = e?.cause?.data?.errorName || e?.cause?.cause?.data?.errorName || e?.data?.errorName || '';
  if (LISTING_ERR_KEY[name]) return t(LISTING_ERR_KEY[name]);
  const hay = (() => { try { return JSON.stringify(e?.cause ?? ''); } catch { return ''; } })()
    + ' ' + (e?.details || '') + ' ' + (e?.shortMessage || '') + ' ' + (e?.message || '');
  const sels = hay.match(/0x[0-9a-fA-F]{8}/g);
  if (sels) for (const s of sels) { const k = LISTING_ERR_SELECTOR[s.toLowerCase()]; if (k) return t(k); }
  return t('wiz.errSimFail');
}

function txErrMsg(e, fallback) {
  if (e?.userMsg) return e.userMsg;
  const hay = ((e?.shortMessage || '') + ' ' + (e?.message || '') + ' ' + (e?.details || '') + ' ' + (e?.code || '')).toLowerCase();
  if (/user rejected|user denied|rejected the request|4001|denied transaction/.test(hay)) return t('pool.userRejected');
  if (hay.includes('0x3482428a') || hay.includes('nothingfilled')) return t('order.noFill');
  if (hay.includes('0xbb2875c3') || hay.includes('insufficientoutput')) return t('order.slippage');
  return fallback || t('pool.opFail');
}

function mmxErrMsg(status, j) {
  if (lang === 'zh' && j && typeof j.error === 'string' && /[\u4e00-\u9fa5]/.test(j.error)) return j.error;
  if (status === 403) return t('mmx.errBanned');
  if (status === 429) return t('mmx.errLimit');
  if (status === 401 || status === 409) return t('mmx.errSig');
  if (status === 400) return t('mmx.errBadInput');
  return t('mmx.issueFail');
}

async function waitOk(hash) {
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success') throw Object.assign(new Error('tx-reverted'), { userMsg: t('tx.reverted') });
  return rc;
}

async function sendContractTx({ address, abi, functionName, args, account: from, gas, value }) {
  if (!wallet) throw Object.assign(new Error('wallet not connected'), { userMsg: t('pool.needWallet') });
  const data = encodeFunctionData({ abi, functionName, args: args ?? [] });
  const tx = { account: from || account, to: address, data };
  if (gas !== undefined) tx.gas = gas;
  if (value !== undefined && value !== 0n) tx.value = value;
  return await wallet.sendTransaction(tx);
}

const I18N = {
  zh: {
    'nav.trade': '交易', 'nav.markets': '行情', 'nav.home': '首页', 'title.home': '非托管现货订单簿',
    'nav.account': '账户', 'nav.poolList': '添加流动性 · 上币', 'nav.apiDocs': 'API 文档', 'nav.mmKey': '做市商 · API Key',
    'chart.toggle': 'K线', 'acct.greenUpS': '绿涨', 'acct.redUpS': '红涨',
    'wallet.viewAccount': '查看我的资产', 'wallet.notConnected': '未连接钱包',
    'acct.guestTitle': '你的资产，始终在你自己的钱包里',
    'acct.guestDesc': 'SORDEX 不托管资金：没有充值和提现，挂单和做市资金锁在合约里，随时可以取回。连接钱包后，这里会汇总你的余额、委托和流动性。',
    'acct.p1': '资金不经过平台，成交一笔原子交割', 'acct.p2': '随时撤单、随时取回做市资金', 'acct.p3': '所有记录都可以在区块浏览器上核对',
    'acct.viewScan': '浏览器查看', 'acct.orders': '我的委托', 'acct.ordersN': '{n} 笔进行中', 'acct.apiKey': '做市商 API Key',
    'acct.colors': '涨跌颜色', 'theme.label': '外观', 'theme.dark': '深色', 'theme.light': '浅色', 'theme.toggle': '切换深色/浅色', 'acct.greenUp': '绿涨红跌', 'acct.redUp': '红涨绿跌',
    'home.badge': '无许可 · 链上订单簿', 'home.recommend2': '推荐行情', 'tk.fee': '手续费', 'tk.tx': '交易哈希',
    'mkt.lhPair': '交易对 / 24h 成交额', 'mkt.lhPrice': '价格 / 24h 涨跌', 'mkt.fee': '协议手续费', 'mkt.metaVal': '{n} 个交易对 · 计价 USDT',
    'mkt.note': '所有交易对协议手续费：吃单 0.30% · 挂单 0.10%。点一个交易对查看详情。', 'home.title1': '非托管', 'home.title2': '现货订单簿 DEX',
    'home.chk1': '非托管', 'home.chk2': '原子交割', 'home.chk3': '无充值提现',
    'home.qkPool': '添加流动性', 'home.qkSwap': '一步买卖，自动聚合最优价', 'home.qkPoolD': '一键上币，平台自动做市', 'home.qkMm': '零审核领取 API Key', 'home.qkApi': '行情与做市接口',
    'home.factTaker': '吃单手续费', 'home.factMaker': '挂单手续费', 'home.factQuote': '统一计价币', 'home.factDep': '充值和提现', 'home.factTx': '原子交割',
    'home.eyebrow': '为什么选 SORDEX', 'home.whyTitle': '无许可交易，不交出资产托管',
    'mkt.sub': '现货交易对，统一以 USDT 计价', 'mkt.dimFav': '自选', 'mkt.favEmpty': '还没有自选。在币种详情页点名称旁的星标即可加入自选。',
    'mkt.favAdd': '已加入自选', 'mkt.favDel': '已取消自选',
    'pp.title': '选择交易对', 'order.summary': '订单摘要', 'order.lPrice': '价格', 'order.lQty': '数量', 'order.lTotal': '成交额',
    't.vol24s': '24h量', 'book.lockedTag': '链上锁仓单', 'order.avbl': '可用', 'mkt.tapHint': '点一行切换交易对',
    'tab.assets': '资产', 'tab.lockNote': '挂单资产锁在合约里，成交或撤单前不会动',
    'pa.wallet': '钱包可用', 'pa.locked': '挂单锁定', 'pa.vault': '做市金库', 'pa.needWallet': '连接钱包后查看本交易对的资产。',
    'ord.reprice': '改价', 'ord.cancel': '撤单', 'ord.repriceTitle': '修改委托', 'ord.newPrice': '新价格', 'ord.newQty': '数量（只能减少）',
    'ord.confirm': '确认修改', 'ord.amended': '委托已修改', 'ord.badQty': '数量需要大于 0，且不能超过剩余数量 {n}。', 'ord.samePx': '价格和数量都没有变化。',
    'ord.time': '时间', 'ord.remain': '剩余', 'ord.partial': '部分成交',
    'swap.recent': '最近快捷交易', 'swap.route': '成交路径', 'swap.routeVal': '吃 {n} 档 · {src}', 'swap.srcMm': '做市商报价', 'swap.srcBook': '链上挂单', 'swap.srcBoth': '做市商报价 + 链上挂单',
    'acct.value': '资产估值 (USDT)', 'acct.today': '今日盈亏', 'acct.total': '累计盈亏',
    'acct.sTotal': '总收益', 'acct.sTrading': '交易', 'acct.sMm': '做市', 'acct.all': '全部',
    'acct.pnlNote': '按你在 SORDEX 的成交和做市记录计算，不含钱包外的转入转出。交易收益按平均成本法，做市收益 = 金库现值 − 净投入。',
    'acct.pnlEmpty': '还没有交易或做市记录，第一笔成交后这里会出现收益曲线。', 'acct.pnlSyncing': '正在同步做市记录，做市收益稍后更新。',
    'acct.tAssets': '资产', 'acct.tTrades': '成交', 'acct.tLiq': '流动性',
    'acct.colToken': '币种', 'acct.colTotal': '合计', 'acct.colValue': '估值',
    'acct.noOrders': '没有进行中的委托。', 'acct.noTrades': '还没有成交记录。', 'acct.noLiq': '还没有做市中的交易对。',
    'acct.roleTaker': '吃单', 'acct.roleMaker': '挂单', 'acct.roleMm': '做市', 'acct.vaultAvail': '金库可用', 'acct.vaultPending': '待提取',
    'acct.manage': '管理', 'acct.trade': '交易', 'acct.loading': '加载中…',
    'foot.product': '产品', 'foot.dev': '开发者', 'foot.reclaim': '历史合约资产取回', 'foot.terms': '计价币 USDT · 挂单 0.10% · 吃单 0.30%',
    'nf.title': '页面不存在', 'nf.desc': '你访问的页面不存在，可能是链接写错了，或者页面已经下线。', 'nf.home': '返回首页',
    'foot.api': 'API 文档', 'foot.mm': '成为做市商',
    'swap.balShort': '钱包里的 {sym} 不够，当前余额 {n}（买入还需加 {fee}% 手续费）。请减少金额。', 'swap.balShortSell': '钱包里的 {sym} 不够，当前余额 {n}。请减少数量。',
    'nav.list': '上币', 'nav.mm': '做市', 'nav.pool': '流动性', 'nav.mmpro': '做市商', 'nav.referral': '返佣', 'nav.api': 'API', 'nav.swap': '快捷交易', 'nav.lang': '语言',
    'mmx.heroTitle': '成为 SORDEX 做市商', 'mmx.heroSub': '非托管、零审核、即时开通。用自己的资金地址签名领取 API Key，自建策略对接订单簿。',
    'mmx.f1t': '非托管', 'mmx.f1d': '资金始终锁在你自己的做市金库或钱包授权额度内，平台零提现权，撤回随时。',
    'mmx.f2t': 'maker 费率 0', 'mmx.f2d': '认证做市商挂单免协议费，只有吃单按普通费率。盘口越好，激励越高。',
    'mmx.f3t': '零审核即时开通', 'mmx.f3d': '资金地址签名即时领取 API Key，无需等待人工审核。随时自助轮换、更新 IP。',
    'mmx.f4t': '自建策略', 'mmx.f4d': '用 API 提交你自己的签名报价，完全掌控价格与节奏；也可用平台公开自动做市规则一键托管。',
    'mmx.flowTitle': '接入流程',
    'mmx.s1t': '准备资金', 'mmx.s1d': '资金放在 EOA 钱包，或放在合约金库 / 多签（无私钥）。',
    'mmx.s2t': '签名领取 Key', 'mmx.s2d': 'EOA 直接本地址签名；合约金库先 setAgent 授权一个签名地址，再用该地址代签。',
    'mmx.s3t': '配置 IP 白名单', 'mmx.s3d': '填入你的做市程序出口 IP 或网段，只有白名单内的 IP 能用这把 Key 报价。',
    'mmx.s4t': '对接 API 报价', 'mmx.s4d': '请求头带 x-mm-key 提交签名报价。接口文档见 API 页。',
    'mmx.applyTitle': '领取 API Key',
    'mmx.connectFirst': '请先连接钱包，再领取或管理你的 API Key。', 'mmx.connectBtn': '连接钱包',
    'mmx.maker': '资金地址（做市资金所在地址）',
    'mmx.tipContract': '检测到这是合约地址（金库 / 多签）。请先用冷钱包对它 setAgent 授权一个签名地址，再用该签名地址连接本页签名领取。',
    'mmx.tipEoaSelf': '这是你当前连接的钱包地址，可直接签名领取。',
    'mmx.tipEoaOther': '这是一个外部钱包地址。若要为它领取，请用该地址本人连接签名；若它是合约金库，请改用其授权的签名地址。',
    'mmx.ips': '允许的 IP / 网段（每行一个，支持 1.2.3.4 或 1.2.3.0/24）', 'mmx.myip': '填入我的当前出口 IP',
    'mmx.labelName': '名称（可选）', 'mmx.email': '邮箱（可选）',
    'mmx.issueBtn': '签名并领取 API Key',
    'mmx.keyWarn': '请立刻复制保存，这把 Key 只显示这一次，关闭后无法再次查看。', 'mmx.copy': '复制',
    'mmx.curStatus': '当前状态', 'mmx.curIps': '当前白名单', 'mmx.stActive': '已启用',
    'mmx.ipsHidden': '出于安全考虑不公开显示。如需修改，请在下方重新填写完整的白名单后提交。',
    'mmx.updateIpBtn': '更新 IP 白名单', 'mmx.rotateTip': '重新点「签名并领取」会轮换 Key，旧 Key 立即失效。',
    'mmx.needWallet': '请先连接钱包。', 'mmx.badMaker': '请填写有效的资金地址。', 'mmx.needIp': '请至少填写一个允许的 IP 或网段。',
    'mmx.signing': '请在钱包中完成签名…', 'mmx.submitting': '正在提交…', 'mmx.issued': 'API Key 已生成，请复制保存。',
    'mmx.ipUpdated': 'IP 白名单已更新。', 'mmx.issueFail': '领取失败，请稍后再试。', 'mmx.myipFail': '获取出口 IP 失败，请手动填写。',
    'pool.addTitle': '添加流动性', 'pool.quoteFixed': '计价币 USDT',
    'pool.tabAdd': '添加流动性', 'pool.tabMine': '我的流动性', 'pool.curToken': '代币',
    'pool.youPayBase': '投入代币', 'pool.youPayQuote': '投入 USDT', 'pool.bal': '余额 {n}', 'ui.max': '最大',
    'pool.addIntro': '填入代币合约地址，投入代币和等值 USDT，平台按公开规则自动把盘口铺好并长期维持。两边金额的比值就是开盘价；已上线的币则按当前盘口价自动配比。资金锁在做市金库，成交原子交割，平台不托管。',
    'pool.token': '代币合约地址', 'pool.detect': '识别', 'pool.tokenPh': '0x… 代币合约地址', 'pool.namePh': '名称',
    'pool.name': '名称', 'pool.symbol': '符号', 'pool.decimals': '精度', 'pool.quote': '计价币', 'pool.logo': 'Logo 链接',
    'pool.detecting': '正在识别币种…', 'pool.badAddr': '请填写有效的 BSC（BNB 智能链）代币合约地址。',
    'pool.modeCreate': '这是新币，你填入的代币与 USDT 数量的比值将作为开盘价。',
    'pool.modeAdd': '这个币已经上线，将按当前盘口价为它追加流动性。',
    'pool.tagNew': '新币上币', 'pool.tagAdd': '追加流动性', 'pool.tagResume': '待完成上币',
    'pool.priceInput': '上币价格（1 代币 = ? USDT）', 'pool.priceConfirm': '我已核对这个价格。托管做市会按它挂单，价格错了会被人低价买走。',
    'pool.refBook': '盘口参考价 {p}', 'pool.refTrade': '最近成交价 {p}', 'pool.refSep': '；', 'pool.refNone': '这个币暂时没有可参考的盘口价和成交价，请按你掌握的真实价格填写。',
    'pool.priceFar': '你填的价格和参考价相差超过 20%，请再核对一遍。盘口里也可能有人故意挂了偏离的单子，请以你掌握的真实价格为准。',
    'pool.priceNeed': '请先填写上币价格。', 'pool.priceConfirmNeed': '请先核对上币价格，并勾选下方的确认框。',
    'pool.rebandTitle': '确认价带中心价', 'pool.rebandIntro': '价带会设为这个价格的 1/{f} 到 {f} 倍，托管做市只会在这个范围内挂单。请按真实价格确认，不要直接照搬盘口价。', 'pool.rebandConfirm': '确认并重设价带', 'pool.rebandCancel': '取消',
    'pool.price': '中间价（1 代币 = ? USDT）', 'pool.createFee': '建对费（防止抢注，付给平台）',
    'pool.createFeeShort': '新币上币需要支付 {fee} BNB 建对费，另外还要少量 BNB 付网络手续费。你钱包里的 BNB 不够，请先充值。', 'pool.vaultBase': '池内代币可用', 'pool.vaultQuote': '池内 USDT 可用',
    'pool.baseAmt': '代币数量', 'pool.quoteAmt': 'USDT 数量',
    'pool.ratioHint': '填任一边，另一边按开盘价/当前盘口价自动算出。首次上币时，你填的两边金额比值就是开盘价。',
    'pool.pvLevels': '每侧铺单档数', 'pool.pvWidth': '盘口覆盖范围', 'pool.pvDepth': '双边投入（折 USDT）',
    'pool.pvHint': '档数、覆盖范围、每档厚度由投入金额按平台公开规则自动决定：投得越多盘口越厚、覆盖越宽。预览只是本地计算，不花 gas。',
    'pool.tooThin': '投入金额太小，撑不起有效盘口。请增加代币和 USDT 的投入数量。',
    'pool.balShortBase': '钱包里的 {sym} 不够，当前余额 {n}。请减少投入数量。',
    'pool.balShortQuote': '钱包里的 USDT 不够，当前余额 {n}。请减少投入数量。',
    'pool.levelsVal': '每侧 {n} 档', 'pool.widthVal': '±{p}%',
    'pool.needWallet': '请先连接钱包，再添加流动性。', 'pool.needToken': '请先填写并识别代币。',
    'pool.needAmt': '请输入要投入的代币和 USDT 数量。', 'pool.noContract': '上币合约未配置，暂时无法添加流动性。',
    'pool.notConfigured': '做市相关合约尚未配置，暂时无法添加流动性，请稍后再试或联系平台。',
    'pool.addBtn': '添加流动性并上币', 'pool.adding': '正在添加流动性，请在钱包中依次确认…',
    'pool.stCreating': '正在建对，请在钱包中确认…', 'pool.stCreated': '建对完成',
    'pool.stDepositing': '正在注入做市资金，请在钱包中确认…', 'pool.stDeposited': '资金已注入金库',
    'pool.stAuthorizing': '正在授权平台做市代理，请在钱包中确认…',
    'pool.stBanding': '正在设置做市价格带，请在钱包中确认…',
    'pool.stSigning': '请在钱包里接连确认各步（会连续弹出，逐个签名）…', 'pool.stConfirming': '已提交，等待各笔上链确认…',
    'pool.bandFail': '做市价格带没能设置成功，上币尚未完成。资金已在金库里，请稍后在「我的流动性」里重试。',
    'pool.stSubscribing': '正在启动自动做市…', 'pool.done': '已完成，盘口即将铺好并长期维持。',
    'pool.stIndexing': '正在登记上币信息…', 'pool.subFail': '自动做市没能启动，上币尚未完成。资金已在金库里，请稍后在「我的流动性」里重试。', 'pool.metaFail': '上币信息登记失败，请稍后重试。', 'err.noWallet': '没有检测到浏览器钱包，请先安装钱包插件。', 'err.wrongNet': '请在钱包里切换到正确的网络。', 'err.connectFail': '钱包连接没有成功，请稍后再试。',
    'wallet.disconnected': '已断开钱包连接', 'book.clickFill': '点击填入价格', 'chart.source': '数据来源：链上成交', 'chart.candles': '根',
    'tax.buy': '买', 'tax.sell': '卖', 'order.noBookForMarket': '当前盘口没有报价，无法按市价成交，请改用限价单。', 'order.noCrossable': '当前盘口没有可成交的对手单。',
    'punct.comma': '，', 'ref.bindOk': '绑定成功', 'ref.claimOk': '领取成功', 'order.sizeUnit': '数量', 'order.failGeneric': '交易没有成功，请稍后再试。',
    'pool.detectFail': '暂时无法识别这个代币，请检查地址后再试。',
    'mmx.errBanned': '该做市地址已被平台停用，请联系平台处理。', 'mmx.errLimit': '领取次数已达上限，请稍后再试或联系平台。', 'mmx.errSig': '签名没有通过，请重新签名。', 'mmx.errBadInput': '填写的信息有误，请检查后再提交。', 'pool.metaNotCreator': '只有创建这个交易对的钱包才能登记名称和图标。', 'pool.metaSkip': '名称和图标暂未登记，不影响做市，之后可以联系平台补登。',
    'ob.title': '上币进度', 'ob.needSign': '还需在钱包确认 {n} 次',
    'ob.stepCreate': '创建交易对', 'ob.stepIndex': '登记名称和图标（链下保存，无需签名）', 'ob.stepApproveBase': '授权代币', 'ob.stepApproveQuote': '授权 USDT', 'ob.stepDeposit': '注入做市资金', 'ob.stepAgent': '授权做市代理', 'ob.stepBand': '设置价格带', 'ob.stepSubscribe': '启动自动做市',
    'ob.pending': '待处理', 'ob.doing': '进行中', 'ob.done': '完成', 'ob.skip': '已就绪', 'ob.signBtn': '签名下一步',
    'ob.signHint': '每一步会弹出钱包，请逐一确认，中途别关页面。',
    'ob.resumeTitle': '上次上币未完成', 'ob.resumeDesc': '你上次 {sym} 的上币没走完。已充入金库的资金是安全的，可以接续完成，或取消本次（资金仍在金库，可随时在「我的流动性」里提取）。', 'ob.resume': '接续完成', 'ob.cancel': '取消本次',
    'pool.exists': '这个代币已经上线了，已切换为「追加流动性」。',
    'pool.mineTitle': '我的做市', 'pool.mineSrc': '资金锁在做市金库',
    'pool.mineIntro': '你在各交易对投入的做市资金与当前盘口。撤资就是按比例撤掉这些挂单并把资金取回金库；从金库提现走安全锁定窗口，窗口内可随时取消。',
    'pool.mineEmpty': '还没有做市中的交易对。在上方添加流动性即可开始。',
    'pool.mineLoading': '正在加载你的做市仓位…',
    'pool.cardBase': '代币库存', 'pool.cardQuote': 'USDT 库存', 'pool.cardPending': '待提现', 'pool.reqAt': '申请', 'pool.unlockAt': '解锁', 'pool.leftMin': '还剩 {n} 分钟', 'pool.unlocked': '已解锁，可以执行提现',
    'pool.cardAvail': '可用',
    'pool.removeLabel': '撤资比例', 'pool.removeBtn': '撤资',
    'pool.removeAmt': '将赎回 {n} {sym}', 'pool.removeAmtPair': '将按比例取出：{list}', 'pool.removeConfirm': '确认赎回',
    'pool.execBtn': '执行提现', 'pool.cancelBtn': '取消提现',
    'pool.hostTitle': '托管做市', 'pool.hostAgent': '托管代理', 'pool.hostOn': '已授权，{d} 到期', 'pool.hostOff': '未授权（托管做市已停）', 'pool.hostExpired': '授权已过期（托管做市已停）',
    'pool.hostBand': '价格保护带', 'pool.hostBandNone': '未设置，代理签的报价会被链上拒绝', 'pool.hostBandRange': '{lo} ~ {hi} USDT',
    'pool.hostBandOut': '当前价格 {p} 已超出保护带，托管做市会暂停，请按当前价重设。',
    'pool.hostRebandBtn': '按当前价重设价带', 'pool.hostRevokeBtn': '撤销托管代理',
    'pool.hostRevokeAsk': '撤销后，平台将无法再替你挂单，已发出的报价也会立即作废。确定撤销吗？',
    'pool.hostNoMid': '这个交易对现在没有可参考的价格，暂时无法重设价带。', 'pool.hostBadPrice': '价格太小，无法换算成有效的价带，请联系平台处理。',
    'pool.hostBusy': '请在钱包中确认…', 'pool.hostRebandOk': '价带已更新为当前价的 1/{f} ~ {f} 倍。', 'pool.hostRevokeOk': '已撤销托管代理，旧报价已全部作废。',
    'pool.hostFail': '操作没有成功，请稍后再试。',
    'pool.removing': '正在发起撤资，请在钱包中确认…', 'pool.removed': '已发起撤资，资金进入提现锁定窗口。',
    'pool.execOk': '提现已到账。', 'pool.cancelOk': '已取消提现。',
    'pool.noPending': '当前没有待执行的提现。', 'pool.notUnlocked': '提现还在锁定窗口内，解锁时间：',
    'pool.advTitle': '我是专业做市商 / 想要自定义做市策略',
    'pool.advIntro': '上面的一键做市适合绝大多数发币方。如果你是专业做市商、或需要自定义策略（手动布单、资金不入金库只授权的额度做市等），留下邮箱，我们会与你联系接入。',
    'pool.advEmail': '邮箱', 'pool.advToken': '代币合约地址（可选）', 'pool.advNote': '需求说明（可选）',
    'pool.advBtn': '提交申请', 'pool.advSubmitting': '正在提交…',
    'pool.advBadEmail': '请填写有效的邮箱地址。', 'pool.advOk': '已收到，我们会尽快通过邮箱与你联系。',
    'pool.advFail': '提交失败，请稍后再试。',
    'pool.advTooMany': '提交太频繁了，请过一会儿再试。',
    'pool.detectFail': '识别币种失败，请检查代币合约地址是否正确，或稍后再试。',
    'pool.addFail': '添加流动性没有成功，请稍后再试。',
    'pool.txReverted': '「{step}」这一步在链上没有执行成功，资金没有损失。请再点一次「添加流动性并上币」，已完成的步骤会自动跳过，从这一步接着做。',
    'pool.rebandReverted': '重设价格带的交易在链上没有执行成功，请稍后再试。',
    'pool.opFail': '操作没有成功，请稍后再试。',
    'pool.userRejected': '你在钱包里取消了这次操作。',
    'swap.title': '快捷交易', 'swap.sub': '选币种与数量，按当前盘口市价成交',
    'swap.buy': '买入', 'swap.sell': '卖出', 'swap.youPay': '支付', 'swap.youGet': '预计获得',
    'swap.token': '币种', 'swap.slip': '滑点上限', 'swap.avgPrice': '均价', 'swap.impact': '价格影响',
    'swap.minGet': '最少获得', 'swap.fee': '手续费', 'swap.btnBuy': '市价买入', 'swap.btnSell': '市价卖出',
    'swap.transferTax': '代币转账税', 'swap.taxUnknown': '该代币可能收取转账税，实际到账以钱包为准。',
    'swap.submitting': '提交中…', 'swap.done': '交易已提交，等待上链确认。',
    'swap.badAmount': '请输入有效的数量。', 'swap.selectToken': '请先选择要交易的币种。',
    'swap.noLiq': '当前盘口没有可成交的对手单，请稍后再试或改用交易页限价单。',
    'swap.insufficient': '当前盘口深度不足，只能部分成交。',
    'swap.enterAmount': '输入数量后自动显示预估成交。', 'swap.flip': '切换买卖方向',
    'mkt.hint': '点任意一行看币种详情', 'mkt.depth': '盘口深度', 'mkt.open': '挂单数',
    'mkt.chg': '24h涨跌', 'mkt.vol': '24h成交额', 'mkt.notOpen': '未开盘',
    'mkt.dimVol': '成交额', 'mkt.dimGain': '涨幅榜', 'mkt.dimNew': '新币', 'mkt.dimAll': '全部',
    'mkt.topVol': '成交额榜', 'mkt.topGain': '涨幅榜', 'mkt.topNew': '新上线', 'mkt.pairsCount': '个交易对 · 计价 USDT',
    'home.title': '非托管现货订单簿 DEX', 'home.sub': '挂单即把资产锁进合约，成交一笔原子交割，资产直接回你钱包。平台没有充值提现，也无权动用你的资金。',
    'home.ctaTrade': '开始交易', 'home.ctaList': '添加流动性 · 上币', 'home.recommend': '热门行情', 'home.viewAll': '查看全部',
    'home.tvl': '总锁仓 TVL', 'home.vol24': '24h 交易量', 'home.listed': '上线币种',
    'home.ctaCardTitle': '现在就开始交易，或几分钟内发行你的代币', 'home.ctaCardSub': '计价币固定 USDT，一键添加流动性即完成上币并开放交易。',
    'home.f1t': '非托管订单簿', 'home.f1d': '链上锁仓挂单、无许可撮合，成交原子交割，平台碰不到你的本金。',
    'home.f2t': '无许可上币', 'home.f2d': '任何人用自己的钱包一键添加流动性即完成上币，计价币固定 USDT，建好立即开放交易。',
    'home.f3t': '项目方自管税', 'home.f3d': '交易税写在代币自己的合约里，成交时按代币自己的规则扣一次，和 AMM 一样，平台不额外加税。',
    'home.f4t': '聚合商可收录', 'home.f4d': '提供 CoinGecko/CMC 标准数据接口，第三方行情站可直接收录。',
    'tk.goTrade': '去交易', 'tk.chart': '价格走势', 'tk.info': '交易对信息',
    'tk.base': '基础币合约', 'tk.quote': '计价币', 'tk.vol24': '24h成交额', 'tk.bestBid': '买一价',
    'tk.bestAsk': '卖一价', 'tk.spread': '买卖价差', 'tk.open': '开放交易', 'tk.openNow': '已开放', 'tk.lastPrice': '最新价',
    'tk.backMkt': '行情', 'tk.price': '价格', 'tk.high': '24h最高', 'tk.low': '24h最低', 'tk.trades24': '24h成交数',
    'tk.contract': '合约地址', 'tk.decimals': '精度', 'tk.takerFee': '吃单费', 'tk.makerFee': '挂单费', 'tk.projTax': '项目方税', 'tk.opened': '开盘时间',
    'tk.website': '官网', 'tk.telegram': 'Telegram', 'tk.explorer': '区块浏览器', 'tax.none': '无（sordexTax）',
    'tk.tf1h': '1H', 'tk.tf24h': '24H', 'tk.tf7d': '7D', 'tk.tf30d': '30D', 'tk.tfall': '全部',
    'mkt.tax': '项目方税', 'mkt.empty': '还没有已上线的交易对。', 'mkt.enter': '去交易',
    'list.title': '上币前自查', 'list.intro': '输入代币合约地址，先做一次链上安全检测。检测只读、不花 gas。通过检测不等于安全，上币仍需人工复核。',
    'list.token': '代币地址', 'list.scan': '开始检测', 'list.scanning': '正在检测…',
    'list.apply': '提交上币申请', 'list.applyHint': '上币由审核制：提交代币地址、交易对、tick 与最小下单量后，由平台多签审批。审核通过才会开放交易。',
    'list.base': '基础币', 'list.quote': '计价币', 'list.email': '联系方式', 'list.submit': '提交申请',
    'list.badAddress': '请输入有效的代币合约地址', 'list.applied': '申请已提交，我们会尽快联系你。',
    'list.mmTitle': '冷启动做市', 'list.mmIntro': '新交易对上线后往往没有深度。在这里存入做市保证金，按 AMM 曲线一次性布一排限价报价，把盘口铺起来。资金锁在做市金库，成交原子交割，不托管。',
    'list.mmPair': '做市交易对', 'list.mmConnectFirst': '请先连接钱包，再进行做市。',
    'list.mmDeposit': '第一步：存入做市保证金', 'list.mmDepositHint': '卖单消耗金库 base、买单消耗金库 quote，是两种不同的币，各自计算、互不借用。所有报价总量不会超过对应币种的金库余额。',
    'list.mmVaultBase': '金库可用 base', 'list.mmVaultQuote': '金库可用 quote',
    'list.mmBaseAmt': '存入 base 数量', 'list.mmQuoteAmt': '存入 quote 数量',
    'list.mmDepBase': '存入 base', 'list.mmDepQuote': '存入 quote',
    'list.mmWithdraw': '撤回保证金', 'list.mmWithdrawHint': '提现分两步：先提交申请，经过锁定期后再执行到账；锁定期内可随时取消。锁定期是为了保证在途的签名报价仍能正常结算。',
    'list.mmPendBase': 'base 待提现', 'list.mmPendQuote': 'quote 待提现', 'list.mmNone': '无',
    'list.mmUnlockAt': '解锁时间', 'list.mmUnlocked': '可执行', 'list.mmNoPair': '请先选择一个交易对。',
    'list.mmWdBaseAmt': '提现 base 数量', 'list.mmWdQuoteAmt': '提现 quote 数量', 'list.mmWdReq': '申请提现',
    'list.mmWdExecBase': '执行 base 提现', 'list.mmWdExecQuote': '执行 quote 提现', 'list.mmWdCancelBase': '取消 base 提现', 'list.mmWdCancelQuote': '取消 quote 提现',
    'list.mmWdRequesting': '正在提交提现申请，请在钱包中确认…', 'list.mmWdRequested': '提现申请已提交。锁定期结束后点"执行提现"即可到账。',
    'list.mmWdExecuting': '正在执行提现，请在钱包中确认…', 'list.mmWdDone': '提现成功，资金已回到你的钱包。',
    'list.mmWdCancelling': '正在取消提现…', 'list.mmWdCancelled': '已取消提现申请。',
    'list.mmNoPending': '当前没有待执行的提现申请。', 'list.mmNotUnlocked': '还没到解锁时间，请在此时间后再执行：',
    'list.mmLadder': '第二步：曲线布单参数', 'list.mmLadderHint': '沿 AMM 曲线把保证金离散成一排限价单：中间价两侧各布若干档，离中间价越远每档量越小。这是机器人的布单算法在浏览器里跑一次。',
    'list.mmMid': '中间价', 'list.mmLevels': '每侧档数', 'list.mmHalfSpread': '半价差 (bps)', 'list.mmWidth': '区间宽度 (bps)',
    'list.mmPreview': '预览布单', 'list.mmPreviewHint': '预览只是本地计算，不花 gas、不提交。确认后再签名布单。',
    'list.mmSide': '方向', 'list.mmPrice': '价格', 'list.mmQty': '数量', 'list.mmSell': '卖', 'list.mmBuy': '买',
    'list.mmTotalBase': '卖单合计 base', 'list.mmTotalQuote': '买单合计付出 quote',
    'list.mmPlace': '第三步：签名并布单', 'list.mmPlaceHint': '用你的钱包对每一档报价做 EIP-712 签名并提交到撮合层。签名不花 gas。行情变化时重新签名改价、同样零 gas，资金始终锁在金库。',
    'list.agentState': '代理状态：', 'list.agentTitle': '做市免签授权（推荐）', 'list.agentHint': '授权一个"只能挂单、不能提现"的本地代理密钥（一次链上签名，默认 30 天有效）。授权后，下面的布单由代理在本地自动签名，不再逐笔弹钱包；随时可撤销、到期自动失效，资金始终锁在你的金库。',
    'list.agentOn': '已授权，有效至', 'list.agentOff': '未授权（布单将逐笔用钱包签名）',
    'list.agentAuth': '授权做市代理', 'list.agentRevoke': '撤销授权',
    'list.agentAuthorizing': '正在授权，请在钱包中确认…', 'list.agentAuthorized': '已授权。现在布单将自动签名、无需逐笔确认。',
    'list.agentRevoking': '正在撤销授权…', 'list.agentRevoked': '已撤销代理授权。',
    'list.agentNoKey': '无法在本浏览器创建代理密钥，请检查浏览器存储设置。',
    'list.botTitle': '托管做市机器人（可选）',
    'list.botHint': '把做市交给平台的常驻机器人：第一步授权它的代理地址（只能挂单、不能提现，默认 30 天）；第二步按上面选的交易对和参数启动托管。机器人会按你金库里的资金持续挂单、自动增量调价，无需你一直开着网页。随时可撤销/停止、到期自动失效。',
    'list.botAddr': '机器人代理地址：', 'list.botAuthState': '授权状态：', 'list.botSubState': '托管状态：',
    'list.botAuth': '授权托管机器人', 'list.botRevoke': '撤销授权', 'list.botStart': '启动托管做市', 'list.botStop': '停止托管',
    'list.botAuthorizing': '正在授权，请在钱包中确认…', 'list.botAuthorized': '已授权。现在可以启动托管做市了。',
    'list.botRevoking': '正在撤销…', 'list.botRevoked': '已撤销托管机器人授权。',
    'list.botAuthOn': '已授权，有效至', 'list.botAuthOff': '未授权',
    'list.botNeedAuth': '请先授权托管机器人代理。', 'list.botStarting': '正在启动托管…', 'list.botStarted': '托管做市已启动，机器人会持续挂单。',
    'list.botStopping': '正在停止托管…', 'list.botStopped': '已停止托管做市。',
    'list.botSubOn': '托管中（交易对 #', 'list.botSubOff': '未托管',
    'list.botUnavail': '本网络未开通托管做市。',
    'list.mmPlaceBtn': '签名并布单', 'list.mmClearBtn': '撤回全部报价',
    'list.mmBotTitle': '托管做市机器人', 'list.mmBotHint': '机器人在服务器 7x24 持续按行情重算这排曲线布单、零 gas 自动改价，并带库存偏移与波动加宽。本页的"签名并布单"是在浏览器里一次性跑同一套算法的非托管版；需要全天候自动改价时再启用托管机器人。机器人只持签名私钥，碰不到提现。',
    'list.mmNeedParams': '请填写有效的做市参数（中间价、档数、价差）', 'list.mmNoLadder': '当前金库余额与参数算不出任何档位，请先存入保证金或调整参数。',
    'list.mmSigning': '正在签名第', 'list.mmOf': '/', 'list.mmPlaced': '档报价已提交，盘口已更新。', 'list.mmPlacedUnit': '档，其中成功',
    'list.mmCleared': '已撤回全部报价。', 'list.mmDepositing': '正在存入，请在钱包中确认…', 'list.mmDeposited': '存入成功。',
    'list.mmBadAmt': '请输入有效的存入数量',
    'wiz.title': '发行上币', 'wiz.quoteFixed': '计价币固定 USDT',
    'wiz.s1': '发行币种', 'wiz.s2': '充值流动性', 'wiz.s3': '开盘设置', 'wiz.s4': '确认上币', 'wiz.s5': '完成',
    'wiz.s1hint': '填入代币合约地址，自动识别名称、符号与 logo（可手动修改）。计价币固定为 USDT。这一步只读链上数据，不花 gas。',
    'wiz.token': '代币合约地址', 'wiz.detect': '识别币种', 'wiz.name': '名称', 'wiz.symbol': '符号', 'wiz.decimals': '精度', 'wiz.quote': '计价币', 'wiz.logo': 'Logo 链接',
    'wiz.next': '下一步', 'wiz.back': '上一步',
    'wiz.s2hint': '设定开盘价，并把做市资金充入做市金库池。卖单消耗池里的代币、买单消耗池里的 USDT，两种币各自计量、互不借用。资金锁在金库，成交原子交割，平台不托管。',
    'wiz.price': '开盘价（1 代币 = ? USDT）', 'wiz.deposit': '充值做市资金',
    'wiz.vaultBase': '池内代币可用', 'wiz.vaultQuote': '池内 USDT 可用',
    'wiz.baseAmt': '代币数量', 'wiz.quoteAmt': '对应 USDT 数量', 'wiz.depBoth': '充值做市资金（两种币）', 'wiz.depBothHint': '按开盘价等值充入两种币：填任一边，另一边会自动算出。点击后钱包会先按需授权两种币，再一笔同时充入。', 'wiz.depositingBoth': '正在充值两种币，请在钱包中确认…',
    'wiz.autoTitle': '自动布单', 'wiz.auto': '开盘后按 AMM 曲线自动布一排限价单（浏览器逐档签名，非托管）',
    'wiz.s3mm': '开盘做市', 'wiz.s3mmHint': '开盘后按 AMM 曲线在开盘价两侧布一排限价单，交给平台托管代理常驻维持：价格固定不随行情移动，被吃掉的档会自动补回，长期维持你的盘口。资金始终锁在做市金库，代理只能替你挂单、无法提现（非托管），你随时可在做市页停止。这一步是必须的。',
    'wiz.needMMParams': '请填写有效的做市参数：每侧档数≥1、半价差>0、区间宽度须大于半价差。',
    'wiz.sumMM': '开盘做市', 'wiz.mmAgentUnavail': '平台托管代理暂不可用，请稍后再试或联系平台。',
    'wiz.mmAuthorizing': '正在授权平台托管代理，请在钱包中确认…', 'wiz.mmSubscribing': '正在启动固定网格做市…',
    'wiz.mmStarted': '固定网格做市已启动', 'wiz.mmSubFailed': '启动做市失败，请稍后在做市页重试。',
    'wiz.levels': '每侧档数', 'wiz.half': '半价差 (bps)', 'wiz.width': '区间宽度 (bps)', 'wiz.preview': '预览布单',
    'wiz.previewEmpty': '当前充值额与参数算不出任何档位，请先充值或调整参数。',
    'wiz.s3hint': '设定交易对开放交易的时间。开盘前你可以先把报价铺好（挂进池子但没人能吃），到点自动开放，无需任何人操作。留下联系方式方便平台在异常时联系你。',
    'wiz.openDelay': '开盘时间', 'wiz.now': '立即', 'wiz.in10': '10 分钟后', 'wiz.in30': '30 分钟后', 'wiz.custom': '自定义', 'wiz.customMin': '自定义（分钟）',
    'wiz.tg': 'Telegram', 'wiz.email': '邮箱',
    'wiz.s4hint': '确认信息后，用你的钱包完成上币：先发一笔建对交易（你自付 gas），建对后授权平台托管代理并启动固定网格做市（一次授权交易 + 一次签名），平台代理随即替你把盘口铺好并长期维持。',
    'wiz.sumOpen': '开放交易时间', 'wiz.yes': '是', 'wiz.no': '否', 'wiz.create': '确认并上币',
    'wiz.creating': '正在建对，请在钱包中确认…', 'wiz.created': '建对成功，交易对',
    'wiz.checking': '正在做建对前的检查，请稍候…',
    'wiz.errExists': '这个代币已经上过币了，无需重复建对。你可以直接在交易页里找到它开始交易。',
    'wiz.errNotContract': '这个地址不是有效的代币合约，请确认你填写的是 BSC（BNB 智能链）主网上的代币合约地址。',
    'wiz.errZeroAddr': '代币地址无效，或者填成了计价币 USDT 本身，请重新填写要上币的代币合约地址。',
    'wiz.errBadFee': '建对手续费和当前设置对不上，请刷新页面后重试。',
    'wiz.errBadTick': '价格精度参数不合法，请返回上一步重新设置开盘价。',
    'wiz.errOpenTooFar': '开盘时间最多只能设在 7 天以内，请把开盘时间调得近一些。',
    'wiz.errBadParams': '最小下单量或最小下单额设置得太大了，请返回检查参数。',
    'wiz.errSimFail': '建对前的检查没有通过，可能是这个代币已经上过币，或参数不符合要求，请核对后再试。',
    'wiz.needToken': '请先识别代币', 'wiz.needPrice': '请填写有效的开盘价', 'wiz.noContract': '上币合约未配置，暂时无法建对。',
    'wiz.pairId': '交易对编号', 'wiz.doneTitle': '上币完成', 'wiz.nowOpen': '已开放交易',
    'wiz.doneTip': '交易对已建好。到开盘时间后自动开放交易，无需任何人操作。你可以在做市页随时补充或调整盘口。',
    'wiz.another': '再上一个币', 'wiz.goMM': '前往做市',
    'mm.title': '做市指标', 'mm.src': '来自链上订单簿', 'mm.mid': '中间价', 'mm.spread': '买卖价差',
    'mm.bidDepth': '买盘深度', 'mm.askDepth': '卖盘深度', 'mm.twoSided': '双边报价', 'mm.mine': '我的挂单',
    'mm.hint': '做市考核看双边深度、价差与在线率。挂单费 0.1%、吃单费 0.3%；认证做市商的挂单费在成交后全额返还，可在返佣页领取。',
    'mm.modeHosted': '托管机器人', 'mm.modeManual': '手动布单', 'mm.recommended': '推荐', 'mm.step3': '第三步：开始做市',
    'mm.hostedDesc': '交给平台常驻机器人替你全天候按行情挂单、自动改价，无需一直开着网页。资金锁在你的金库，机器人只能挂单、碰不到提现。',
    'mm.manualDesc': '你自己在浏览器里按曲线签名布单。可选授权一个本地免签代理，之后改价不再逐笔弹钱包。适合一次性铺盘或高级用户。',
    'cust.title': '资金托管方式', 'cust.vault': '存入金库', 'cust.allowance': '钱包授权',
    'mmkey.title': '做市资格', 'mmkey.status': '资格状态：',
    'mmkey.intro': '做市报价需先申请资格：用你的做市地址签名提交申请，平台审核通过后领取一把 API Key，网页会自动带上它提交报价。API Key 只是准入凭证，不托管资金、不能提现、也不能替别的地址报价。',
    'mmkey.applyBtn': '申请做市资格', 'mmkey.fetchBtn': '领取 API Key',
    'mmkey.stNone': '未申请', 'mmkey.stPending': '审核中', 'mmkey.stApproved': '已通过', 'mmkey.stRejected': '已拒绝', 'mmkey.stRevoked': '已撤销',
    'mmkey.haveKey': '已通过，API Key 已保存在本机', 'mmkey.notRequired': '当前无需申请',
    'mmkey.applied': '申请已提交，请等待平台审核', 'mmkey.fetched': 'API Key 已领取并保存在本机，现在可以正常报价了',
    'mmkey.needApprove': '申请尚未通过审核，暂时无法领取', 'mmkey.connectFirst': '请先连接钱包',
    'cust.vaultDesc': '把做市资金存入平台的做市金库合约，成交时从金库扣款。适合愿意把资金托管在合约里的普通做市商。',
    'cust.allowanceDesc': '资金留在你自己的钱包或金库合约里，只对结算合约授权一个可动用额度；成交时直接从你钱包按额度划扣，随时可加额或撤销。适合不愿把资金转入平台的项目方和专业做市商。',
    'cust.enableTitle': '启用授权做市', 'cust.state': '授权做市状态：', 'cust.on': '已启用', 'cust.off': '未启用',
    'cust.enableHint': '把你的做市模式切换为“钱包授权”。启用后，你（或你授权的代理）签名的报价成交时，直接从你钱包按授权额度划扣，不经过平台金库。随时可切回金库模式。',
    'cust.enableBtn': '启用授权做市', 'cust.disableBtn': '切回金库模式',
    'cust.switching': '正在切换，请在钱包中确认…', 'cust.enabled': '已启用授权做市。', 'cust.disabled': '已切回金库模式。',
    'cust.approveTitle': '授权做市额度',
    'cust.approveHint': '分别对结算合约授权 base 和 quote 的可动用额度：卖单动用 base 授权、买单动用 quote 授权。授权额就是这个模式下的成交上限，也是最坏情况的亏损上限——建议只授权你愿意用于做市的数量，不要无限授权；随时可再授权加额，或一键撤销归零。',
    'cust.budgetBase': '可做市 base 额度', 'cust.budgetQuote': '可做市 quote 额度',
    'cust.budgetNote': '额度取“授权额”与“钱包余额”的较小值。',
    'cust.baseAmt': '授权 base 额度', 'cust.quoteAmt': '授权 quote 额度',
    'cust.approveBase': '授权 base', 'cust.approveQuote': '授权 quote', 'cust.revokeAll': '撤销全部授权',
    'cust.approving': '正在授权，请在钱包中确认…', 'cust.approved': '授权成功。',
    'cust.revoking': '正在撤销授权，请在钱包中确认…', 'cust.revoked': '已撤销全部做市授权。',
    'cust.bandTitle': '价格带保护（可选，强烈推荐）',
    'cust.bandHint': '用你的主钱包为这个交易对设定可成交价带：成交价低于下限或高于上限的报价一律被拒绝。这样即使代理 key 泄露或被滥用，也只能在你划定的价带内成交，把坏价损失锁死。某一侧留空即该侧不设限。',
    'cust.bandFloor': '最低成交价（1 base = ? quote）', 'cust.bandCeil': '最高成交价（1 base = ? quote）',
    'cust.bandSet': '设置价格带', 'cust.bandClear': '清除价格带',
    'cust.bandSetting': '正在提交价格带，请在钱包中确认…', 'cust.bandDone': '价格带已更新。',
    'cust.bandBad': '最低成交价不能高于最高成交价。', 'cust.bandCurLabel': '当前价带：', 'cust.bandNone': '未设置',
    'mm.strategy': '曲线布单', 'mm.strategyHint': '按 AMM 曲线把资金离散成一排限价单，随价格平移用改价而不是撤单重挂。这不是 AMM 池，产物就是普通限价单。',
    'mm.yes': '有', 'mm.no': '无',
    'ref.title': '返佣', 'ref.src': '以实收手续费为基数', 'ref.inviter': '邀请人地址',
    'ref.bind': '绑定邀请关系', 'ref.bindHint': '绑定只能在首次成交前完成，绑定后不可更改。',
    'ref.claimable': '可领取手续费返佣', 'ref.myAddress': '我的地址', 'ref.claimableAmt': '累计可领取',
    'ref.claim': '领取', 'ref.hint': '分账比例：平台 50%、一级邀请 30%、二级邀请 10%、安全储备 10%。返佣是手续费的子集，刷量无法获利。',
    'ref.needWallet': '请先连接钱包', 'ref.badInviter': '请输入有效的邀请人地址',
    'scan.pass': '通过', 'scan.review': '需人工复核', 'scan.block': '拒绝', 'scan.address': '地址', 'scan.owner': '所有者', 'scan.none': '未发现风险项',
    'wallet.connect': '连接钱包', 'wallet.connectShort': '连接', 'wallet.connected': '已连接', 'wallet.title': '钱包',
    'status.connecting': '正在连接网络…', 'status.ok': '已连接钱包', 'status.fail': 'BSC 网络连接失败',
    'tx.pending': '交易已提交，等待上链确认…', 'tx.success': '交易成功，已上链。', 'tx.failed': '交易失败或被拒绝，请重试。', 'tx.reverted': '交易在链上没有成功，资产没有变化。请稍后再试，如果一直失败请联系平台。', 'tx.placed': '挂单成功，已上链。',
    'book.title': '订单簿', 'book.src': '用户锁仓单',
    'book.price': '价格', 'book.qty': '数量', 'book.total': '合计',
    'order.buy': '买入', 'order.sell': '卖出', 'order.limit': '限价', 'order.market': '市价(聚合吃单)', 'order.type': '类型',
    'order.price': '价格', 'order.qty': '数量', 'order.percent': '仓位比例', 'order.total': '成交额 (USDT)',
    'order.notional': '成交额', 'order.fee': '协议手续费', 'order.feeMode': '收费方式',
    'order.feeModeVal': '挂单 0.1% / 吃单 0.3%（认证做市商挂单费全额返还）', 'order.available': '可用余额', 'order.locked': '挂单锁定',
    'order.tax': '项目方税', 'order.sdxWarn': '注意：这个币的交易税由代币合约自己设定，项目方可以随时调整。挂单按成交那一刻的税率扣，可能和你现在看到的不同。平台暂不自动撮合这个币的挂单。',
    'order.youPay': '你将付出', 'order.youGet': '你将到手',
    'order.estMarket': '以上为按当前盘口估算，实际成交价可能在你设定的滑点范围内浮动。',
    'order.estLimit': '以上为该委托完全成交后的收支（含手续费），未成交前不会扣款。',
    'order.gasNote': '挂单、撤单、改价都需要你支付链上手续费（gas）。平台不代付。',
    'order.submitBuy': '买入', 'order.submitSell': '卖出', 'order.submitBusy': '请在钱包中确认…',
    'order.needWallet': '请先连接钱包', 'order.badInput': '请输入有效的价格和数量',
    'order.insufficientQuote': '钱包里的可用余额不够这笔订单（含手续费），请减少数量或先充值。', 'order.insufficientBase': '钱包里可卖出的代币数量不够，请减少数量。',
    'order.selfTrade': '盘口上能成交的都是你自己的挂单或做市报价，不能和自己成交。请换一个钱包来吃单，或等其他用户/做市商的报价。',
    'order.slippage': '成交量比预期少很多（盘口在你确认的瞬间被别人吃掉了），为保护你，这笔已被取消，没有扣款。请刷新后重试。',
    'order.noFill': '这笔没有成交：对手报价可能刚被吃掉或已过期，请刷新后重试。',
    'order.minQty': '低于最小下单量，至少需要', 'order.minNotional': '低于最小下单额，本单金额至少需要',
    'order.restTooSmall': '能成交的部分已经成交。剩下的数量太小，没有挂到盘口上，挂单金额至少需要',
    'order.approving': '正在授权该代币（仅首次需要）…',
    'order.approveSync': '授权已确认，正在等待网络同步…',
    'order.quotesMoved': '盘口报价刚刚更新，这一单按当前价格已经无法成交。请看一下最新盘口后再下单。',
    'tab.orders': '当前委托', 'tab.trades': '最近成交', 'tab.myTrades': '我的成交',
    't.emptyMyTrades': '你在这个交易对还没有成交。', 't.connectMyTrades': '连接钱包后，这里会显示你在这个交易对的成交。',
    't.time': '时间', 't.pair': '交易对', 't.side': '方向', 't.price': '价格',
    't.qty': '数量', 't.filled': '已成交', 't.status': '状态', 't.action': '操作', 't.total': '成交额',
    't.notional': '成交额', 't.fee': '手续费', 't.tx': '交易哈希',
    't.emptyOrders': '还没有委托。挂单后，资产会锁定在合约里，直到成交、撤单或到期。',
    't.emptyTrades': '这个交易对还没有成交记录。',
    't.cancel': '撤单', 't.none': '无',
    'st.open': '挂单中', 'st.filled': '已成交', 'st.cancelled': '已撤销', 'st.expired': '已过期',

    'ticker.vol': '24h成交额', 'ticker.bid': '买一', 'ticker.ask': '卖一', 'ticker.spread': '价差', 'ticker.fee': '手续费',
    'ticker.spot': '现货', 'ticker.details': '币种详情',
    'chart.chart': '图表', 'chart.depth': '深度', 'chart.candle': '蜡烛', 'chart.line': '折线',
    'chart.tf1m': '1m', 'chart.tf5m': '5m', 'chart.tf15m': '15m', 'chart.tf1h': '1H', 'chart.tf4h': '4H', 'chart.tf1d': '1D',

    'mtab.chart': '图表', 'mtab.book': '盘口', 'mtab.trades': '成交',
    'chart.src': '链上成交聚合',
    'chart.noTrades': '暂无成交，第一笔成交后这里会显示 K 线', 'chart.noOrders': '暂无挂单和成交',
    'chart.depthLegend': '订单簿累计深度', 'chart.depthFallback': '暂无成交，显示订单簿深度',
    'mkt.trend': '走势',

    'wallet.copy': '复制', 'wallet.copied': '已复制', 'wallet.network': '网络', 'wallet.quote': '可用 USDT',
    'wallet.base': '可用基础币', 'wallet.disconnect': '断开连接', 'wallet.search': '搜索交易对', 'wallet.availPrefix': '可用',
    'wallet.noResult': '没有匹配的交易对',

    'order.qtyUnit': '数量单位', 'order.crossNote': '该价格可立即成交，将优先按对手方更优价撮合，剩余部分才挂单。',
    'order.sheetClose': '关闭',
    'foot.note': 'SorDex 是非托管订单簿。挂单即把资产锁进合约，成交一笔原子交割，资产直接回到你的钱包。平台没有充值提现，也没有权力动用你的资金。',
  },
  en: {
    'nav.trade': 'Trade', 'nav.markets': 'Markets', 'nav.home': 'Home', 'title.home': 'Non-custodial spot order book',
    'nav.account': 'Account', 'nav.poolList': 'Add liquidity · List a token', 'nav.apiDocs': 'API docs', 'nav.mmKey': 'Market maker · API key',
    'chart.toggle': 'Chart', 'acct.greenUpS': 'Green up', 'acct.redUpS': 'Red up',
    'wallet.viewAccount': 'View my assets', 'wallet.notConnected': 'Wallet not connected',
    'acct.guestTitle': 'Your assets always stay in your own wallet',
    'acct.guestDesc': "SORDEX never holds your funds: there are no deposits or withdrawals, and order and market-making funds stay locked in the contract, ready to take back at any time. Connect your wallet to see your balances, orders and liquidity in one place.",
    'acct.p1': 'Funds never pass through the platform; every fill settles atomically', 'acct.p2': 'Cancel orders or take back market-making funds any time', 'acct.p3': 'Every record can be checked on the block explorer',
    'acct.viewScan': 'View on explorer', 'acct.orders': 'My orders', 'acct.ordersN': '{n} open', 'acct.apiKey': 'Market maker API key',
    'acct.colors': 'Price colors', 'theme.label': 'Appearance', 'theme.dark': 'Dark', 'theme.light': 'Light', 'theme.toggle': 'Switch dark / light', 'acct.greenUp': 'Green up / red down', 'acct.redUp': 'Red up / green down',
    'home.badge': 'Permissionless · On-chain order book', 'home.recommend2': 'Recommended markets', 'tk.fee': 'Fee', 'tk.tx': 'Tx hash',
    'mkt.lhPair': 'Pair / 24h vol', 'mkt.lhPrice': 'Price / 24h', 'mkt.fee': 'Protocol fee', 'mkt.metaVal': '{n} pairs · Quote USDT',
    'mkt.note': 'Protocol fee on every pair: taker 0.30% · maker 0.10%. Tap a pair to see its details.', 'home.title1': 'Non-custodial', 'home.title2': 'spot order-book DEX',
    'home.chk1': 'Non-custodial', 'home.chk2': 'Atomic settlement', 'home.chk3': 'No deposits or withdrawals',
    'home.qkPool': 'Add liquidity', 'home.qkSwap': 'Buy or sell in one step at the best price', 'home.qkPoolD': 'List in one step, auto market making', 'home.qkMm': 'Get an API key, no review', 'home.qkApi': 'Market data and maker APIs',
    'home.factTaker': 'Taker fee', 'home.factMaker': 'Maker fee', 'home.factQuote': 'Quote asset', 'home.factDep': 'Deposits or withdrawals', 'home.factTx': 'Atomic settlement',
    'home.eyebrow': 'Why SORDEX', 'home.whyTitle': 'Permissionless trading, without giving up custody',
    'mkt.sub': 'Spot pairs, always quoted in USDT', 'mkt.dimFav': 'Favorites', 'mkt.favEmpty': "No favorites yet. Tap the star next to a pair's name on its detail page to add it.",
    'mkt.favAdd': 'Added to favorites', 'mkt.favDel': 'Removed from favorites',
    'pp.title': 'Select a pair', 'order.summary': 'Order summary', 'order.lPrice': 'Price', 'order.lQty': 'Size', 'order.lTotal': 'Total',
    't.vol24s': '24h vol', 'book.lockedTag': 'Locked orders', 'order.avbl': 'Avbl', 'mkt.tapHint': 'Tap a row to switch pairs',
    'tab.assets': 'Assets', 'tab.lockNote': 'Assets in open orders stay locked in the contract until filled or cancelled',
    'pa.wallet': 'In wallet', 'pa.locked': 'In orders', 'pa.vault': 'MM vault', 'pa.needWallet': 'Connect your wallet to see your assets for this pair.',
    'ord.reprice': 'Reprice', 'ord.cancel': 'Cancel', 'ord.repriceTitle': 'Edit order', 'ord.newPrice': 'New price', 'ord.newQty': 'Amount (can only go down)',
    'ord.confirm': 'Confirm', 'ord.amended': 'Order updated', 'ord.badQty': 'The amount must be above 0 and no more than the remaining {n}.', 'ord.samePx': 'Neither the price nor the amount has changed.',
    'ord.time': 'Time', 'ord.remain': 'Remaining', 'ord.partial': 'Partially filled',
    'swap.recent': 'Recent quick trades', 'swap.route': 'Route', 'swap.routeVal': '{n} levels · {src}', 'swap.srcMm': 'market maker quotes', 'swap.srcBook': 'on-chain orders', 'swap.srcBoth': 'market maker quotes + on-chain orders',
    'acct.value': 'Asset value (USDT)', 'acct.today': "Today's P&L", 'acct.total': 'Total P&L',
    'acct.sTotal': 'Total', 'acct.sTrading': 'Trading', 'acct.sMm': 'Market making', 'acct.all': 'All',
    'acct.pnlNote': 'Based on your trades and market making on SORDEX; transfers in or out of your wallet elsewhere are not included. Trading P&L uses average cost; market-making P&L is the vault value minus your net deposits.',
    'acct.pnlEmpty': 'No trading or market-making activity yet. Your P&L curve will appear after your first trade.', 'acct.pnlSyncing': 'Syncing your market-making history; that part will update shortly.',
    'acct.tAssets': 'Assets', 'acct.tTrades': 'Trades', 'acct.tLiq': 'Liquidity',
    'acct.colToken': 'Token', 'acct.colTotal': 'Total', 'acct.colValue': 'Value',
    'acct.noOrders': 'No open orders.', 'acct.noTrades': 'No trades yet.', 'acct.noLiq': 'No pairs with liquidity yet.',
    'acct.roleTaker': 'Taker', 'acct.roleMaker': 'Maker', 'acct.roleMm': 'Market making', 'acct.vaultAvail': 'Vault available', 'acct.vaultPending': 'Pending withdrawal',
    'acct.manage': 'Manage', 'acct.trade': 'Trade', 'acct.loading': 'Loading…',
    'foot.product': 'Product', 'foot.dev': 'Developers', 'foot.reclaim': 'Recover assets from earlier contracts', 'foot.terms': 'Quote asset USDT · maker 0.10% · taker 0.30%',
    'nf.title': 'Page not found', 'nf.desc': "The page you're looking for doesn't exist. The link may be wrong, or the page has been taken down.", 'nf.home': 'Back to home',
    'foot.api': 'API docs', 'foot.mm': 'Become a market maker',
    'swap.balShort': "You don't have enough {sym} in your wallet (balance: {n}; buying also needs a {fee}% fee). Please lower the amount.", 'swap.balShortSell': "You don't have enough {sym} in your wallet (balance: {n}). Please lower the amount.",
    'nav.list': 'List', 'nav.mm': 'Market making', 'nav.pool': 'Liquidity', 'nav.mmpro': 'Market maker', 'nav.referral': 'Referral', 'nav.api': 'API', 'nav.swap': 'Quick Trade', 'nav.lang': 'Language',
    'mmx.heroTitle': 'Become a SORDEX market maker', 'mmx.heroSub': 'Non-custodial, no review, instant onboarding. Sign with your funding address to get an API Key and run your own strategy against the order book.',
    'mmx.f1t': 'Non-custodial', 'mmx.f1d': 'Funds stay locked in your own market-making vault or wallet allowance; the platform can never withdraw, and you can pull out anytime.',
    'mmx.f2t': 'Zero maker fee', 'mmx.f2d': 'Verified makers pay no protocol fee on resting orders; only takers pay the normal fee. Better quotes, better rewards.',
    'mmx.f3t': 'Instant, no review', 'mmx.f3d': 'Sign with your funding address and get an API Key instantly — no manual approval. Rotate the key or update IPs yourself anytime.',
    'mmx.f4t': 'Your own strategy', 'mmx.f4d': 'Submit your own signed quotes via the API with full control of price and timing; or use the public auto market-making rules for one-click hosting.',
    'mmx.flowTitle': 'How it works',
    'mmx.s1t': 'Prepare funds', 'mmx.s1d': 'Keep funds in an EOA wallet, or in a contract vault / multisig (no private key).',
    'mmx.s2t': 'Sign for a key', 'mmx.s2d': 'An EOA signs with its own address; a contract vault first authorizes a signer via setAgent, then that signer signs on its behalf.',
    'mmx.s3t': 'Set IP allowlist', 'mmx.s3d': 'Add your bot egress IPs or ranges — only allowlisted IPs can quote with this key.',
    'mmx.s4t': 'Quote via API', 'mmx.s4d': 'Submit signed quotes with the x-mm-key header. See the API page for docs.',
    'mmx.applyTitle': 'Get your API Key',
    'mmx.connectFirst': 'Connect your wallet to get or manage your API Key.', 'mmx.connectBtn': 'Connect wallet',
    'mmx.maker': 'Funding address (where your market-making funds sit)',
    'mmx.tipContract': 'This is a contract address (vault / multisig). First authorize a signer on it via setAgent from your cold wallet, then connect with that signer address to sign and claim.',
    'mmx.tipEoaSelf': 'This is your connected wallet address — you can sign and claim directly.',
    'mmx.tipEoaOther': 'This is an external wallet address. To claim for it, connect as that address and sign; if it is a contract vault, use its authorized signer instead.',
    'mmx.ips': 'Allowed IPs / ranges (one per line, e.g. 1.2.3.4 or 1.2.3.0/24)', 'mmx.myip': 'Fill in my current egress IP',
    'mmx.labelName': 'Name (optional)', 'mmx.email': 'Email (optional)',
    'mmx.issueBtn': 'Sign and get API Key',
    'mmx.keyWarn': 'Copy and save it now — this key is shown only once and cannot be viewed again after you leave.', 'mmx.copy': 'Copy',
    'mmx.curStatus': 'Status', 'mmx.curIps': 'Allowlist', 'mmx.stActive': 'Active',
    'mmx.ipsHidden': 'Hidden for security. To change it, enter the full allowlist below and submit.',
    'mmx.updateIpBtn': 'Update IP allowlist', 'mmx.rotateTip': 'Clicking "Sign and get API Key" again rotates the key; the old key stops working immediately.',
    'mmx.needWallet': 'Please connect your wallet first.', 'mmx.badMaker': 'Enter a valid funding address.', 'mmx.needIp': 'Add at least one allowed IP or range.',
    'mmx.signing': 'Please complete the signature in your wallet…', 'mmx.submitting': 'Submitting…', 'mmx.issued': 'API Key generated — copy and save it.',
    'mmx.ipUpdated': 'IP allowlist updated.', 'mmx.issueFail': 'Could not get the key, please try again later.', 'mmx.myipFail': 'Could not fetch egress IP, please enter it manually.',
    'pool.addTitle': 'Add liquidity', 'pool.quoteFixed': 'Quote USDT',
    'pool.tabAdd': 'Add liquidity', 'pool.tabMine': 'My liquidity', 'pool.curToken': 'Token',
    'pool.youPayBase': 'Token in', 'pool.youPayQuote': 'USDT in', 'pool.bal': 'Balance {n}', 'ui.max': 'Max',
    'pool.addIntro': 'Enter the token contract address, put in your token and an equal value of USDT, and the platform lays out and maintains the order book automatically under a public rule set. The ratio of the two amounts is the opening price; for already-listed tokens the pairing follows the current book price. Funds stay locked in the market-making vault, settled atomically on each fill, never custodied.',
    'pool.token': 'Token contract address', 'pool.detect': 'Detect', 'pool.tokenPh': '0x… token contract address', 'pool.namePh': 'Name',
    'pool.name': 'Name', 'pool.symbol': 'Symbol', 'pool.decimals': 'Decimals', 'pool.quote': 'Quote', 'pool.logo': 'Logo URL',
    'pool.detecting': 'Detecting token…', 'pool.badAddr': 'Enter a valid BSC (BNB Smart Chain) token contract address.',
    'pool.modeCreate': 'New token: the ratio between your token and USDT amounts sets the opening price.',
    'pool.modeAdd': 'This token is already listed; liquidity will be added at the current book price.',
    'pool.tagNew': 'New listing', 'pool.tagAdd': 'Add to pool', 'pool.tagResume': 'Finish listing',
    'pool.priceInput': 'Listing price (1 token = ? USDT)', 'pool.priceConfirm': 'I have checked this price. Hosted market making will quote around it, so a wrong price could let someone buy your tokens cheaply.',
    'pool.refBook': 'Order book reference {p}', 'pool.refTrade': 'recent trade price {p}', 'pool.refSep': '; ', 'pool.refNone': "There's no order book or trade price to go by yet. Please enter the real price you know.",
    'pool.priceFar': "Your price is more than 20% away from the reference. Please double-check it. Someone may also have placed an off-market order on purpose, so go by the real price you know.",
    'pool.priceNeed': 'Please enter a listing price first.', 'pool.priceConfirmNeed': 'Please check the listing price and tick the confirmation box below.',
    'pool.rebandTitle': 'Confirm the band center price', 'pool.rebandIntro': 'The band will be set from 1/{f} to {f} times this price, and hosted market making will only quote inside it. Please confirm the real price rather than copying the order book.', 'pool.rebandConfirm': 'Confirm and reset band', 'pool.rebandCancel': 'Cancel',
    'pool.price': 'Mid price (1 token = ? USDT)', 'pool.createFee': 'Listing fee (deters squatting, paid to the platform)',
    'pool.createFeeShort': "Listing a new token costs a {fee} BNB listing fee, plus a little BNB for network gas. Your wallet doesn't have enough BNB, so please top up first.", 'pool.vaultBase': 'Token available in pool', 'pool.vaultQuote': 'USDT available in pool',
    'pool.baseAmt': 'Token amount', 'pool.quoteAmt': 'USDT amount',
    'pool.ratioHint': 'Enter either side and the other is filled in at the opening / current book price. On a first listing, the ratio of your two amounts is the opening price.',
    'pool.pvLevels': 'Levels per side', 'pool.pvWidth': 'Book coverage', 'pool.pvDepth': 'Total committed (in USDT)',
    'pool.pvHint': 'The number of levels, coverage and per-level size are decided automatically from your amounts under the platform rules: the more you put in, the deeper and wider the book. The preview is computed locally and costs no gas.',
    'pool.tooThin': 'The amount is too small to support a usable book. Please increase both your token and USDT amounts.',
    'pool.balShortBase': "You don't have enough {sym} in your wallet (balance: {n}). Please lower the amount.",
    'pool.balShortQuote': "You don't have enough USDT in your wallet (balance: {n}). Please lower the amount.",
    'pool.levelsVal': '{n} per side', 'pool.widthVal': '±{p}%',
    'pool.needWallet': 'Connect your wallet before adding liquidity.', 'pool.needToken': 'Enter and detect a token first.',
    'pool.needAmt': 'Enter the token and USDT amounts to commit.', 'pool.noContract': 'The listing contract is not configured; adding liquidity is unavailable.',
    'pool.notConfigured': 'The market-making contracts are not configured yet; adding liquidity is unavailable. Please try again later or contact the platform.',
    'pool.addBtn': 'Add liquidity & list', 'pool.adding': 'Adding liquidity, confirm each step in your wallet…',
    'pool.stCreating': 'Creating the pair, confirm in your wallet…', 'pool.stCreated': 'Pair created',
    'pool.stDepositing': 'Depositing market-making funds, confirm in your wallet…', 'pool.stDeposited': 'Funds deposited to the vault',
    'pool.stAuthorizing': 'Authorizing the platform market-making agent, confirm in your wallet…',
    'pool.stBanding': 'Setting the market-making price band, confirm in your wallet…',
    'pool.stSigning': 'Confirm each step in your wallet (popups appear back to back)…', 'pool.stConfirming': 'Submitted; waiting for each to confirm on-chain…',
    'pool.bandFail': 'The market-making price band could not be set, so the listing is not complete yet. Your funds are in the vault — please retry from “My liquidity” shortly.',
    'pool.stSubscribing': 'Starting automated market making…', 'pool.done': 'Done. Your book is being laid out and will be maintained over time.',
    'pool.stIndexing': 'Registering the listing…', 'pool.subFail': 'Market making did not start, so the listing is not complete yet. Your funds are in the vault — please retry from “My liquidity” shortly.', 'pool.metaFail': 'Registering the listing failed, please try again shortly.', 'err.noWallet': 'No browser wallet detected. Please install a wallet extension first.', 'err.wrongNet': 'Please switch to the correct network in your wallet.', 'err.connectFail': 'Could not connect your wallet. Please try again.',
    'wallet.disconnected': 'Wallet disconnected', 'book.clickFill': 'Click to fill price', 'chart.source': 'Source: on-chain fills', 'chart.candles': 'candles',
    'tax.buy': 'buy', 'tax.sell': 'sell', 'order.noBookForMarket': 'There are no quotes on the book to market-fill against, so please place a limit order instead.', 'order.noCrossable': 'There are no crossable orders on the book right now.',
    'punct.comma': ', ', 'ref.bindOk': 'Bound successfully', 'ref.claimOk': 'Claimed successfully', 'order.sizeUnit': 'Size', 'order.failGeneric': 'The transaction did not go through. Please try again.',
    'pool.detectFail': 'We could not recognize this token right now. Please check the address and try again.',
    'mmx.errBanned': 'This market-maker address has been suspended by the platform. Please contact us.', 'mmx.errLimit': 'You have reached the limit for claiming keys. Please try later or contact us.', 'mmx.errSig': 'The signature was not accepted. Please sign again.', 'mmx.errBadInput': 'Some of the details are invalid. Please check and submit again.', 'pool.metaNotCreator': 'Only the wallet that created this pair can register its name and logo.', 'pool.metaSkip': 'The name and logo were not registered. Market making is not affected, and you can ask the platform to add them later.',
    'ob.title': 'Listing progress', 'ob.needSign': '{n} wallet confirmation(s) left',
    'ob.stepCreate': 'Create pair', 'ob.stepIndex': 'Save name and logo (off-chain, no signature)', 'ob.stepApproveBase': 'Approve token', 'ob.stepApproveQuote': 'Approve USDT', 'ob.stepDeposit': 'Deposit funds', 'ob.stepAgent': 'Authorize MM agent', 'ob.stepBand': 'Set price band', 'ob.stepSubscribe': 'Start market making',
    'ob.pending': 'Pending', 'ob.doing': 'In progress', 'ob.done': 'Done', 'ob.skip': 'Ready', 'ob.signBtn': 'Sign next step',
    'ob.signHint': 'Each step opens your wallet — confirm them one by one and keep this page open.',
    'ob.resumeTitle': 'Previous listing unfinished', 'ob.resumeDesc': 'Your previous {sym} listing did not finish. Any funds already deposited are safe in the vault. You can resume, or cancel this (funds stay in the vault and can be withdrawn anytime from “My liquidity”).', 'ob.resume': 'Resume', 'ob.cancel': 'Cancel',
    'pool.exists': 'This token is already listed; switched to adding liquidity.',
    'pool.mineTitle': 'My market making', 'pool.mineSrc': 'Funds locked in the vault',
    'pool.mineIntro': 'Your market-making funds and current book per pair. Removing liquidity pulls the quotes proportionally and returns funds to the vault; withdrawing from the vault goes through a safe lock-up window you can cancel anytime.',
    'pool.mineEmpty': 'No active market-making pairs yet. Add liquidity above to begin.',
    'pool.mineLoading': 'Loading your positions…',
    'pool.cardBase': 'Token balance', 'pool.cardQuote': 'USDT balance', 'pool.cardPending': 'Pending withdrawal', 'pool.reqAt': 'Requested', 'pool.unlockAt': 'Unlocks', 'pool.leftMin': '{n} min left', 'pool.unlocked': 'Unlocked, ready to withdraw',
    'pool.cardAvail': 'Available',
    'pool.removeLabel': 'Remove', 'pool.removeBtn': 'Remove',
    'pool.removeAmt': 'You will redeem {n} {sym}', 'pool.removeAmtPair': 'You will withdraw proportionally: {list}', 'pool.removeConfirm': 'Confirm redeem',
    'pool.execBtn': 'Execute withdrawal', 'pool.cancelBtn': 'Cancel withdrawal',
    'pool.hostTitle': 'Hosted market making', 'pool.hostAgent': 'Hosting agent', 'pool.hostOn': 'Authorized until {d}', 'pool.hostOff': 'Not authorized (hosted quoting is off)', 'pool.hostExpired': 'Authorization expired (hosted quoting is off)',
    'pool.hostBand': 'Price guard band', 'pool.hostBandNone': 'Not set, so quotes signed by the agent will be rejected on-chain', 'pool.hostBandRange': '{lo} to {hi} USDT',
    'pool.hostBandOut': 'The current price {p} is outside your guard band, so hosted quoting is paused. Reset the band to the current price.',
    'pool.hostRebandBtn': 'Reset band to current price', 'pool.hostRevokeBtn': 'Revoke hosting agent',
    'pool.hostRevokeAsk': 'Once revoked, the platform can no longer quote for you, and every quote it already sent is cancelled right away. Revoke now?',
    'pool.hostNoMid': 'There is no reference price for this pair right now, so the band cannot be reset yet.', 'pool.hostBadPrice': 'The price is too small to turn into a valid band. Please contact the platform.',
    'pool.hostBusy': 'Please confirm in your wallet…', 'pool.hostRebandOk': 'Band updated to 1/{f}x to {f}x of the current price.', 'pool.hostRevokeOk': 'Hosting agent revoked. All earlier quotes are now void.',
    'pool.hostFail': 'That did not go through. Please try again in a moment.',
    'pool.removing': 'Starting removal, confirm in your wallet…', 'pool.removed': 'Removal started; funds entered the withdrawal lock-up window.',
    'pool.execOk': 'Withdrawal received.', 'pool.cancelOk': 'Withdrawal cancelled.',
    'pool.noPending': 'No pending withdrawal to execute.', 'pool.notUnlocked': 'The withdrawal is still within the lock-up window, unlocks at:',
    'pool.advTitle': 'I am a professional market maker / want a custom strategy',
    'pool.advIntro': 'The one-click market making above suits most token issuers. If you are a professional market maker or need a custom strategy (manual quoting, allowance-based market making where funds stay in your own wallet, etc.), leave your email and we will reach out to onboard you.',
    'pool.advEmail': 'Email', 'pool.advToken': 'Token contract address (optional)', 'pool.advNote': 'What you need (optional)',
    'pool.advBtn': 'Submit', 'pool.advSubmitting': 'Submitting…',
    'pool.advBadEmail': 'Please enter a valid email address.', 'pool.advOk': 'Got it. We will reach out to you by email shortly.',
    'pool.advFail': 'Submission failed, please try again later.',
    'pool.advTooMany': 'Too many submissions, please try again in a moment.',
    'pool.detectFail': 'Could not detect the token. Please check the contract address and try again.',
    'pool.addFail': 'Adding liquidity did not go through, please try again later.',
    'pool.txReverted': 'The step "{step}" did not go through on-chain, and no funds were lost. Click "Add liquidity & list" again: finished steps are skipped and it picks up from here.',
    'pool.rebandReverted': 'Resetting the price band did not go through on-chain. Please try again shortly.',
    'pool.opFail': 'The operation did not go through, please try again later.',
    'pool.userRejected': 'You cancelled the request in your wallet.',
    'swap.title': 'Quick Trade', 'swap.sub': 'Pick a token and amount, fill at market against the live book',
    'swap.buy': 'Buy', 'swap.sell': 'Sell', 'swap.youPay': 'You pay', 'swap.youGet': 'You receive (est.)',
    'swap.token': 'Token', 'swap.slip': 'Max slippage', 'swap.avgPrice': 'Avg price', 'swap.impact': 'Price impact',
    'swap.minGet': 'Min received', 'swap.fee': 'Fee', 'swap.btnBuy': 'Market buy', 'swap.btnSell': 'Market sell',
    'swap.transferTax': 'Token transfer tax', 'swap.taxUnknown': 'This token may charge a transfer tax; the amount you actually receive can be lower.',
    'swap.submitting': 'Submitting…', 'swap.done': 'Trade submitted, waiting for on-chain confirmation.',
    'swap.badAmount': 'Please enter a valid amount.', 'swap.selectToken': 'Please pick a token to trade first.',
    'swap.noLiq': 'There are no crossable orders on the book right now. Try again later or use a limit order on the Trade page.',
    'swap.insufficient': 'Not enough depth on the book; only a partial fill is possible.',
    'swap.enterAmount': 'Enter an amount to see the estimated fill.', 'swap.flip': 'Flip buy/sell',
    'mkt.hint': 'Tap any row for token details', 'mkt.depth': 'Book depth', 'mkt.open': 'Open orders',
    'mkt.chg': '24h change', 'mkt.vol': '24h volume', 'mkt.notOpen': 'Not open',
    'mkt.dimVol': 'Volume', 'mkt.dimGain': 'Gainers', 'mkt.dimNew': 'New', 'mkt.dimAll': 'All',
    'mkt.topVol': 'Top volume', 'mkt.topGain': 'Top gainers', 'mkt.topNew': 'New listings', 'mkt.pairsCount': 'pairs · Quote USDT',
    'home.title': 'Non-custodial spot order-book DEX', 'home.sub': 'Placing an order locks assets in the contract; each fill settles atomically back to your wallet. No deposits or withdrawals, and the platform can never touch your funds.',
    'home.ctaTrade': 'Start trading', 'home.ctaList': 'List a token', 'home.recommend': 'Recommended markets', 'home.viewAll': 'View all',
    'home.tvl': 'Total value locked', 'home.vol24': '24h volume', 'home.listed': 'Listed tokens',
    'home.ctaCardTitle': 'Start trading, or list your token in minutes', 'home.ctaCardSub': 'Quote is always USDT; add liquidity once and your token is listed and open for trading.',
    'home.f1t': 'Non-custodial order book', 'home.f1d': 'On-chain escrowed orders, permissionless matching, atomic settlement — the platform never holds your principal.',
    'home.f2t': 'Permissionless listing', 'home.f2d': 'Anyone lists a token straight from their wallet — add liquidity once and it is live. Quote is always USDT and trading opens right away.',
    'home.f3t': 'Self-managed token tax', 'home.f3d': 'Transfer tax lives in the token’s own contract and is charged once per fill by its own rules, just like an AMM — the platform adds none of its own.',
    'home.f4t': 'Aggregator-ready', 'home.f4d': 'Standard CoinGecko/CMC data endpoints so third-party trackers can list SorDex directly.',
    'tk.goTrade': 'Trade', 'tk.chart': 'Price', 'tk.info': 'Pair info',
    'tk.base': 'Base token', 'tk.quote': 'Quote', 'tk.vol24': '24h volume', 'tk.bestBid': 'Best bid',
    'tk.bestAsk': 'Best ask', 'tk.spread': 'Spread', 'tk.open': 'Opens', 'tk.openNow': 'Open', 'tk.lastPrice': 'Last price',
    'tk.backMkt': 'Markets', 'tk.price': 'Price', 'tk.high': '24h high', 'tk.low': '24h low', 'tk.trades24': 'Trades (24h)',
    'tk.contract': 'Contract', 'tk.decimals': 'Decimals', 'tk.takerFee': 'Taker fee', 'tk.makerFee': 'Maker fee', 'tk.projTax': 'Project tax', 'tk.opened': 'Opened',
    'tk.website': 'Website', 'tk.telegram': 'Telegram', 'tk.explorer': 'Explorer', 'tax.none': 'None (sordexTax)',
    'tk.tf1h': '1H', 'tk.tf24h': '24H', 'tk.tf7d': '7D', 'tk.tf30d': '30D', 'tk.tfall': 'All',
    'mkt.tax': 'Project tax', 'mkt.empty': 'No pairs listed yet.', 'mkt.enter': 'Trade',
    'list.title': 'Pre-listing check', 'list.intro': 'Enter a token address to run an on-chain safety scan. The scan is read-only and costs no gas. Passing does not mean the token is safe; listing still requires manual review.',
    'list.token': 'Token address', 'list.scan': 'Run scan', 'list.scanning': 'Scanning…',
    'list.apply': 'Submit listing request', 'list.applyHint': 'Listing is reviewed: submit the token, pair, tick and minimum order size; the platform multisig approves. Trading opens only after approval.',
    'list.base': 'Base token', 'list.quote': 'Quote token', 'list.email': 'Contact', 'list.submit': 'Submit',
    'list.badAddress': 'Enter a valid token contract address', 'list.applied': 'Request received. We will contact you shortly.',
    'list.mmTitle': 'Bootstrap market making', 'list.mmIntro': 'A newly listed pair usually has no depth. Deposit market-making collateral here and place a row of limit quotes along an AMM curve to seed the book. Funds stay locked in the market-making vault, settlement is atomic, and nothing is custodial.',
    'list.mmPair': 'Market-making pair', 'list.mmConnectFirst': 'Connect your wallet before market making.',
    'list.mmDeposit': 'Step 1: deposit collateral', 'list.mmDepositHint': 'Sell quotes consume vault base, buy quotes consume vault quote. They are two different currencies, each accounted separately and never borrowing from the other. Total quotes on each side never exceed that currency vault balance.',
    'list.mmVaultBase': 'Vault base available', 'list.mmVaultQuote': 'Vault quote available',
    'list.mmBaseAmt': 'Base amount to deposit', 'list.mmQuoteAmt': 'Quote amount to deposit',
    'list.mmDepBase': 'Deposit base', 'list.mmDepQuote': 'Deposit quote',
    'list.mmWithdraw': 'Withdraw collateral', 'list.mmWithdrawHint': 'Withdrawing takes two steps: submit a request, then execute it after a lock-up window; you can cancel anytime during the window. The lock-up lets in-flight signed quotes settle safely.',
    'list.mmPendBase': 'Base pending', 'list.mmPendQuote': 'Quote pending', 'list.mmNone': 'None',
    'list.mmUnlockAt': 'unlocks at', 'list.mmUnlocked': 'ready', 'list.mmNoPair': 'Select a trading pair first.',
    'list.mmWdBaseAmt': 'Base amount to withdraw', 'list.mmWdQuoteAmt': 'Quote amount to withdraw', 'list.mmWdReq': 'Request withdrawal',
    'list.mmWdExecBase': 'Execute base withdrawal', 'list.mmWdExecQuote': 'Execute quote withdrawal', 'list.mmWdCancelBase': 'Cancel base', 'list.mmWdCancelQuote': 'Cancel quote',
    'list.mmWdRequesting': 'Submitting withdrawal request, confirm in your wallet…', 'list.mmWdRequested': 'Withdrawal requested. After the lock-up ends, click Execute to receive funds.',
    'list.mmWdExecuting': 'Executing withdrawal, confirm in your wallet…', 'list.mmWdDone': 'Withdrawal complete; funds are back in your wallet.',
    'list.mmWdCancelling': 'Cancelling withdrawal…', 'list.mmWdCancelled': 'Withdrawal request cancelled.',
    'list.mmNoPending': 'No pending withdrawal to execute.', 'list.mmNotUnlocked': 'Not unlocked yet; execute after:',
    'list.mmLadder': 'Step 2: curve ladder parameters', 'list.mmLadderHint': 'Discretize the collateral into a row of limit orders along an AMM curve: several levels on each side of the mid, with smaller size the further from the mid. This runs the bot ladder algorithm once in your browser.',
    'list.mmMid': 'Mid price', 'list.mmLevels': 'Levels per side', 'list.mmHalfSpread': 'Half spread (bps)', 'list.mmWidth': 'Range width (bps)',
    'list.mmPreview': 'Preview ladder', 'list.mmPreviewHint': 'Preview is a local calculation only. It costs no gas and submits nothing. Sign and place once it looks right.',
    'list.mmSide': 'Side', 'list.mmPrice': 'Price', 'list.mmQty': 'Size', 'list.mmSell': 'Sell', 'list.mmBuy': 'Buy',
    'list.mmTotalBase': 'Total sell base', 'list.mmTotalQuote': 'Total buy quote spent',
    'list.mmPlace': 'Step 3: sign and place', 'list.mmPlaceHint': 'Sign each quote with your wallet via EIP-712 and submit it to the matching layer. Signing costs no gas. When the market moves, re-signing to reprice is also gasless, and funds stay locked in the vault.',
    'list.agentState': 'Agent status: ', 'list.agentTitle': 'Gasless market-making approval (recommended)', 'list.agentHint': 'Authorize a local agent key that can only place quotes and can never withdraw (one on-chain signature, valid 30 days by default). After that, the ladder below is signed locally by the agent with no per-quote wallet pop-ups. Revoke anytime; it also expires automatically, and funds always stay locked in your vault.',
    'list.agentOn': 'Authorized, valid until', 'list.agentOff': 'Not authorized (the ladder will be signed per quote with your wallet)',
    'list.agentAuth': 'Authorize market-making agent', 'list.agentRevoke': 'Revoke',
    'list.agentAuthorizing': 'Authorizing, confirm in your wallet…', 'list.agentAuthorized': 'Authorized. The ladder will now sign automatically with no per-quote confirmations.',
    'list.agentRevoking': 'Revoking authorization…', 'list.agentRevoked': 'Agent authorization revoked.',
    'list.agentNoKey': 'Could not create an agent key in this browser; check your browser storage settings.',
    'list.botTitle': 'Hosted market-making bot (optional)',
    'list.botHint': 'Let the platform bot market-make for you: first authorize its agent address (quote-only, never withdraws, 30 days by default); then start it on the pair and parameters selected above. The bot keeps quoting from your vault funds and repricing incrementally, with no need to keep this page open. Revoke/stop anytime; it also auto-expires.',
    'list.botAddr': 'Bot agent address: ', 'list.botAuthState': 'Authorization: ', 'list.botSubState': 'Hosting: ',
    'list.botAuth': 'Authorize hosted bot', 'list.botRevoke': 'Revoke', 'list.botStart': 'Start hosted market-making', 'list.botStop': 'Stop hosting',
    'list.botAuthorizing': 'Authorizing, confirm in your wallet…', 'list.botAuthorized': 'Authorized. You can start hosted market-making now.',
    'list.botRevoking': 'Revoking…', 'list.botRevoked': 'Hosted bot authorization revoked.',
    'list.botAuthOn': 'Authorized, valid until', 'list.botAuthOff': 'Not authorized',
    'list.botNeedAuth': 'Authorize the hosted bot agent first.', 'list.botStarting': 'Starting…', 'list.botStarted': 'Hosted market-making started; the bot will keep quoting.',
    'list.botStopping': 'Stopping…', 'list.botStopped': 'Hosted market-making stopped.',
    'list.botSubOn': 'Hosting (pair #', 'list.botSubOff': 'Not hosting',
    'list.botUnavail': 'Hosted market-making is not enabled on this network.',
    'list.mmPlaceBtn': 'Sign and place', 'list.mmClearBtn': 'Withdraw all quotes',
    'list.mmBotTitle': 'Managed market-making bot', 'list.mmBotHint': 'The bot runs on the server around the clock, recomputing this curve ladder as the market moves, repricing gaslessly, with inventory skew and volatility widening. The "Sign and place" above is the non-custodial version that runs the same algorithm once in your browser; enable the managed bot when you need continuous repricing. The bot holds only a signing key and cannot withdraw.',
    'list.mmNeedParams': 'Enter valid market-making parameters (mid, levels, spread)', 'list.mmNoLadder': 'The current vault balance and parameters produce no levels. Deposit collateral or adjust the parameters first.',
    'list.mmSigning': 'Signing quote', 'list.mmOf': 'of', 'list.mmPlaced': 'quotes submitted; the book is updated.', 'list.mmPlacedUnit': 'placed, succeeded',
    'list.mmCleared': 'All quotes withdrawn.', 'list.mmDepositing': 'Depositing, confirm in your wallet…', 'list.mmDeposited': 'Deposit confirmed.',
    'list.mmBadAmt': 'Enter a valid amount to deposit',
    'wiz.title': 'List a token', 'wiz.quoteFixed': 'Quote fixed to USDT',
    'wiz.s1': 'Token', 'wiz.s2': 'Liquidity', 'wiz.s3': 'Opening', 'wiz.s4': 'Confirm', 'wiz.s5': 'Done',
    'wiz.s1hint': 'Enter the token contract address. Name, symbol and logo are detected automatically and can be edited. The quote currency is fixed to USDT. This step only reads on-chain data and costs no gas.',
    'wiz.token': 'Token contract address', 'wiz.detect': 'Detect token', 'wiz.name': 'Name', 'wiz.symbol': 'Symbol', 'wiz.decimals': 'Decimals', 'wiz.quote': 'Quote', 'wiz.logo': 'Logo URL',
    'wiz.next': 'Next', 'wiz.back': 'Back',
    'wiz.s2hint': 'Set the opening price and deposit market-making funds into the vault pool. Sell quotes draw on the pool’s tokens and buy quotes on its USDT; the two are counted separately and never borrow from each other. Funds stay locked in the vault, settled atomically on each fill, never custodied.',
    'wiz.price': 'Opening price (1 token = ? USDT)', 'wiz.deposit': 'Deposit market-making funds',
    'wiz.vaultBase': 'Token available in pool', 'wiz.vaultQuote': 'USDT available in pool',
    'wiz.baseAmt': 'Token amount', 'wiz.quoteAmt': 'USDT amount', 'wiz.depBoth': 'Deposit market-making funds (both)', 'wiz.depBothHint': 'Both sides are funded at the opening price: enter either amount and the other is filled in automatically. Your wallet will approve each token as needed, then deposit both in a single transaction.', 'wiz.depositingBoth': 'Depositing both tokens, confirm in your wallet…',
    'wiz.autoTitle': 'Auto-place quotes', 'wiz.auto': 'Place a ladder of limit quotes along the AMM curve at open (signed per level in your browser, non-custodial)',
    'wiz.s3mm': 'Opening market-making', 'wiz.s3mmHint': 'At open, a ladder of limit quotes is placed around the opening price along the AMM curve and kept alive by the platform hosted agent: the price is fixed and does not move with the market, filled levels are automatically replenished, and your book is maintained over time. Funds always stay locked in the market-making vault; the agent can only place quotes for you and can never withdraw (non-custodial). You can stop it anytime on the market-making page. This step is required.',
    'wiz.needMMParams': 'Enter valid market-making parameters: levels per side ≥ 1, half spread > 0, and range width greater than the half spread.',
    'wiz.sumMM': 'Opening market-making', 'wiz.mmAgentUnavail': 'The platform hosted agent is unavailable right now; please try again later or contact the platform.',
    'wiz.mmAuthorizing': 'Authorizing the platform hosted agent, confirm in your wallet…', 'wiz.mmSubscribing': 'Starting fixed-grid market-making…',
    'wiz.mmStarted': 'Fixed-grid market-making started', 'wiz.mmSubFailed': 'Failed to start market-making; please retry on the market-making page.',
    'wiz.levels': 'Levels per side', 'wiz.half': 'Half spread (bps)', 'wiz.width': 'Range width (bps)', 'wiz.preview': 'Preview ladder',
    'wiz.previewEmpty': 'The current deposits and parameters produce no levels. Deposit more or adjust the parameters.',
    'wiz.s3hint': 'Choose when the pair opens for trading. Before it opens you can lay out your quotes (they sit in the pool but no one can take them); at the opening time it opens automatically, with no action from anyone. Leave a contact so the platform can reach you if something goes wrong.',
    'wiz.openDelay': 'Opening time', 'wiz.now': 'Immediately', 'wiz.in10': 'In 10 minutes', 'wiz.in30': 'In 30 minutes', 'wiz.custom': 'Custom', 'wiz.customMin': 'Custom (minutes)',
    'wiz.tg': 'Telegram', 'wiz.email': 'Email',
    'wiz.s4hint': 'After you confirm, your wallet completes the listing: first one transaction to create the pair (you pay the gas), then you authorize the platform hosted agent and start fixed-grid market-making (one approval transaction + one signature); the agent then lays out and maintains your book.',
    'wiz.sumOpen': 'Opens for trading', 'wiz.yes': 'Yes', 'wiz.no': 'No', 'wiz.create': 'Confirm and list',
    'wiz.creating': 'Creating the pair, please confirm in your wallet…', 'wiz.created': 'Pair created,',
    'wiz.checking': 'Running pre-flight checks, please wait…',
    'wiz.errExists': 'This token already has a trading pair, so there is no need to create it again. You can find it on the Trade page and start trading.',
    'wiz.errNotContract': 'This address is not a valid token contract. Please make sure you entered a token contract address on BNB Smart Chain (BSC) mainnet.',
    'wiz.errZeroAddr': 'The token address is invalid, or it is the USDT quote token itself. Please enter the contract address of the token you want to list.',
    'wiz.errBadFee': 'The listing fee does not match the current on-chain setting. Please refresh the page and try again.',
    'wiz.errBadTick': 'The price precision is invalid. Please go back and set the opening price again.',
    'wiz.errOpenTooFar': 'The opening time can be at most 7 days from now. Please choose an earlier opening time.',
    'wiz.errBadParams': 'The minimum order size or value is set too large. Please go back and check the parameters.',
    'wiz.errSimFail': 'The pre-flight check for creating this pair did not pass. The token may already be listed, or a parameter may be invalid. Please check and try again.',
    'wiz.needToken': 'Please detect the token first', 'wiz.needPrice': 'Please enter a valid opening price', 'wiz.noContract': 'Listing contract is not configured, cannot create a pair right now.',
    'wiz.pairId': 'Pair ID', 'wiz.doneTitle': 'Listing complete', 'wiz.nowOpen': 'Open for trading',
    'wiz.doneTip': 'The pair is created. It opens for trading automatically at the opening time, with no action from anyone. You can add to or adjust the book any time on the market-making page.',
    'wiz.another': 'List another', 'wiz.goMM': 'Go to market-making',
    'mm.title': 'Market making metrics', 'mm.src': 'From the on-chain book', 'mm.mid': 'Mid price', 'mm.spread': 'Spread',
    'mm.bidDepth': 'Bid depth', 'mm.askDepth': 'Ask depth', 'mm.twoSided': 'Two-sided', 'mm.mine': 'My orders',
    'mm.hint': 'Market makers are assessed on two-sided depth, spread and uptime. Maker fee is 0.1% and taker fee 0.3%; a certified market maker’s maker fee is fully rebated after each fill and claimable on the referral page.',
    'mm.modeHosted': 'Managed bot', 'mm.modeManual': 'Manual', 'mm.recommended': 'Recommended', 'mm.step3': 'Step 3 · Start market-making',
    'mm.hostedDesc': 'Hand it to the platform’s always-on bot: it quotes around the clock and reprices automatically — no need to keep the page open. Funds stay locked in your vault; the bot can only place orders, never withdraw.',
    'mm.manualDesc': 'Place the ladder yourself by signing in the browser. Optionally authorize a local gasless agent so repricing no longer prompts each time. Best for one-off seeding or advanced users.',
    'cust.title': 'Fund custody', 'cust.vault': 'Deposit to vault', 'cust.allowance': 'Wallet allowance',
    'mmkey.title': 'Market-maker access', 'mmkey.status': 'Access status: ',
    'mmkey.intro': 'Market making requires approval first: sign an application with your market-making address, and once the platform approves it you can claim an API key. The page attaches it to your quotes automatically. The key is an access credential only — it is non-custodial, cannot withdraw, and cannot quote for any other address.',
    'mmkey.applyBtn': 'Apply for access', 'mmkey.fetchBtn': 'Claim API key',
    'mmkey.stNone': 'Not applied', 'mmkey.stPending': 'Under review', 'mmkey.stApproved': 'Approved', 'mmkey.stRejected': 'Rejected', 'mmkey.stRevoked': 'Revoked',
    'mmkey.haveKey': 'Approved — API key saved on this device', 'mmkey.notRequired': 'No application needed right now',
    'mmkey.applied': 'Application submitted, please wait for review', 'mmkey.fetched': 'API key claimed and saved on this device — you can quote now',
    'mmkey.needApprove': 'Your application is not approved yet', 'mmkey.connectFirst': 'Please connect your wallet first',
    'cust.vaultDesc': 'Deposit market-making funds into the platform vault contract; fills are debited from the vault. Best for ordinary market makers who are fine custodying funds in the contract.',
    'cust.allowanceDesc': 'Keep funds in your own wallet or treasury contract and only grant the settlement contract a spending allowance; fills debit your wallet directly up to that allowance, which you can raise or revoke anytime. Best for project teams and pro market makers who will not move funds onto the platform.',
    'cust.enableTitle': 'Enable allowance market-making', 'cust.state': 'Allowance mode: ', 'cust.on': 'On', 'cust.off': 'Off',
    'cust.enableHint': 'Switch your market-making mode to wallet allowance. Once on, quotes you (or your authorized agent) sign settle straight from your wallet up to the allowance, bypassing the platform vault. You can switch back to vault mode anytime.',
    'cust.enableBtn': 'Enable allowance mode', 'cust.disableBtn': 'Switch back to vault',
    'cust.switching': 'Switching, confirm in your wallet…', 'cust.enabled': 'Allowance market-making enabled.', 'cust.disabled': 'Switched back to vault mode.',
    'cust.approveTitle': 'Approve market-making allowance',
    'cust.approveHint': 'Grant the settlement contract a spending allowance for base and quote separately: sell quotes draw on the base allowance, buy quotes on the quote allowance. The allowance is the fill ceiling in this mode, and your worst-case loss ceiling — approve only what you are willing to market-make with, never unlimited; you can top it up anytime, or revoke it to zero in one click.',
    'cust.budgetBase': 'Base available to quote', 'cust.budgetQuote': 'Quote available to quote',
    'cust.budgetNote': 'Each is the lesser of your allowance and your wallet balance.',
    'cust.baseAmt': 'Base allowance amount', 'cust.quoteAmt': 'Quote allowance amount',
    'cust.approveBase': 'Approve base', 'cust.approveQuote': 'Approve quote', 'cust.revokeAll': 'Revoke all allowances',
    'cust.approving': 'Approving, confirm in your wallet…', 'cust.approved': 'Approved.',
    'cust.revoking': 'Revoking allowances, confirm in your wallet…', 'cust.revoked': 'All market-making allowances revoked.',
    'cust.bandTitle': 'Price-band protection (optional, strongly recommended)',
    'cust.bandHint': 'Use your main wallet to set an acceptable price band for this pair: any quote filling below the floor or above the ceiling is rejected. Even if an agent key leaks or is misused, fills can only happen inside the band you set, capping bad-price losses. Leave a side blank to leave it unbounded.',
    'cust.bandFloor': 'Minimum fill price (1 base = ? quote)', 'cust.bandCeil': 'Maximum fill price (1 base = ? quote)',
    'cust.bandSet': 'Set price band', 'cust.bandClear': 'Clear price band',
    'cust.bandSetting': 'Submitting price band, confirm in your wallet…', 'cust.bandDone': 'Price band updated.',
    'cust.bandBad': 'The minimum fill price cannot be higher than the maximum.', 'cust.bandCurLabel': 'Current band: ', 'cust.bandNone': 'Not set',
    'mm.strategy': 'Curve laddering', 'mm.strategyHint': 'Discretize capital into a row of limit orders along an AMM curve, and shift them by amending prices instead of cancelling and re-placing. This is not an AMM pool; the output is ordinary limit orders.',
    'mm.yes': 'Yes', 'mm.no': 'No',
    'ref.title': 'Referral', 'ref.src': 'Based on fees actually collected', 'ref.inviter': 'Referrer address',
    'ref.bind': 'Bind referrer', 'ref.bindHint': 'Binding is only possible before your first trade and cannot be changed afterwards.',
    'ref.claimable': 'Claimable fee rebate', 'ref.myAddress': 'My address', 'ref.claimableAmt': 'Total claimable',
    'ref.claim': 'Claim', 'ref.hint': 'Split: platform 50%, level-1 referrer 30%, level-2 referrer 10%, safety reserve 10%. Rebates are a subset of fees, so volume farming cannot profit.',
    'ref.needWallet': 'Connect your wallet first', 'ref.badInviter': 'Enter a valid referrer address',
    'scan.pass': 'Pass', 'scan.review': 'Manual review', 'scan.block': 'Rejected', 'scan.address': 'Address', 'scan.owner': 'Owner', 'scan.none': 'No risks found',
    'wallet.connect': 'Connect wallet', 'wallet.connectShort': 'Connect', 'wallet.connected': 'Connected', 'wallet.title': 'Wallet',
    'status.connecting': 'Connecting to the network…', 'status.ok': 'Wallet connected', 'status.fail': 'BSC network unreachable',
    'tx.pending': 'Transaction submitted, waiting for confirmation…', 'tx.success': 'Transaction confirmed on-chain.', 'tx.failed': 'Transaction failed or rejected, please try again.', 'tx.reverted': "The transaction didn't go through on-chain and nothing changed. Please try again later, and contact us if it keeps failing.", 'tx.placed': 'Limit order placed on-chain.',
    'book.title': 'Order book', 'book.src': 'Locked orders',
    'book.price': 'Price', 'book.qty': 'Size', 'book.total': 'Total',
    'order.buy': 'Buy', 'order.sell': 'Sell', 'order.limit': 'Limit', 'order.market': 'Market (mixed)', 'order.type': 'Type',
    'order.price': 'Price', 'order.qty': 'Size', 'order.percent': 'Percent', 'order.total': 'Total (USDT)',
    'order.notional': 'Notional', 'order.fee': 'Protocol fee', 'order.feeMode': 'Paid by',
    'order.feeModeVal': 'Maker 0.1% / taker 0.3% (certified MM maker fee fully rebated)', 'order.available': 'Available', 'order.locked': 'Locked in orders',
    'order.tax': 'Project tax', 'order.sdxWarn': "Heads up: this token sets its own trading tax in its contract, and the project can change it at any time. Orders are taxed at the rate in effect when they fill, which may differ from what you see now. The platform doesn't auto-match resting orders on this token for now.",
    'order.youPay': 'You pay', 'order.youGet': 'You receive',
    'order.estMarket': 'Estimated from the current book; the actual fill price may vary within your slippage limit.',
    'order.estLimit': 'Amounts shown are the settlement (fees included) once this order fully fills; nothing is charged until it does.',
    'order.gasNote': 'Placing, cancelling and repricing all cost network fees (gas), paid by you. The platform does not cover them.',
    'order.submitBuy': 'Buy', 'order.submitSell': 'Sell', 'order.submitBusy': 'Confirm in your wallet…',
    'order.needWallet': 'Connect your wallet first', 'order.badInput': 'Enter a valid price and size',
    'order.insufficientQuote': 'Your wallet balance is not enough for this order (fees included). Lower the size or add funds first.', 'order.insufficientBase': 'You do not have enough of this token to sell. Please lower the size.',
    'order.selfTrade': 'Everything you could fill on the book is your own orders or market-making quotes, and you cannot trade against yourself. Use a different wallet to take the order, or wait for quotes from other users or market makers.',
    'order.slippage': 'The fill would have been much smaller than expected because the book moved while you were confirming. To protect you, the order was cancelled and nothing was charged. Please refresh and try again.',
    'order.noFill': 'This order did not fill: the matching quotes may have just been taken or expired. Please refresh and try again.',
    'order.minQty': 'Below the minimum order size; you need at least', 'order.minNotional': 'Below the minimum order value; this order must be at least',
    'order.restTooSmall': 'The fillable part of your order went through. The rest was too small to post on the book; a resting order must be at least',
    'order.approving': 'Approving this token (first time only)…',
    'order.approveSync': 'Approval confirmed, waiting for the network to catch up…',
    'order.quotesMoved': 'The quotes on the book just changed, so this order can no longer fill at the current price. Please check the latest book and try again.',
    'tab.orders': 'Open orders', 'tab.trades': 'Recent trades', 'tab.myTrades': 'My trades',
    't.emptyMyTrades': "You haven't traded this pair yet.", 't.connectMyTrades': 'Connect your wallet to see your trades on this pair.',
    't.time': 'Time', 't.pair': 'Pair', 't.side': 'Side', 't.price': 'Price',
    't.qty': 'Size', 't.filled': 'Filled', 't.status': 'Status', 't.action': 'Action', 't.total': 'Total',
    't.notional': 'Notional', 't.fee': 'Fee', 't.tx': 'Tx hash',
    't.emptyOrders': 'No orders yet. Once you place one, the assets stay locked in the contract until it fills, is cancelled, or expires.',
    't.emptyTrades': 'No trades on this pair yet.',
    't.cancel': 'Cancel', 't.none': 'None',
    'st.open': 'Open', 'st.filled': 'Filled', 'st.cancelled': 'Cancelled', 'st.expired': 'Expired',

    'ticker.vol': '24h volume', 'ticker.bid': 'Best bid', 'ticker.ask': 'Best ask', 'ticker.spread': 'Spread', 'ticker.fee': 'Taker fee',
    'ticker.spot': 'Spot', 'ticker.details': 'Token details',
    'chart.chart': 'Chart', 'chart.depth': 'Depth', 'chart.candle': 'Candles', 'chart.line': 'Line',
    'chart.tf1m': '1m', 'chart.tf5m': '5m', 'chart.tf15m': '15m', 'chart.tf1h': '1H', 'chart.tf4h': '4H', 'chart.tf1d': '1D',

    'mtab.chart': 'Chart', 'mtab.book': 'Order book', 'mtab.trades': 'Trades',
    'chart.src': 'On-chain fills',
    'chart.noTrades': 'No trades yet. The candlestick chart will appear after the first trade.', 'chart.noOrders': 'No orders or trades yet',
    'chart.depthLegend': 'Cumulative order book depth', 'chart.depthFallback': 'No trades yet, showing order book depth',
    'mkt.trend': 'Trend',

    'wallet.copy': 'Copy', 'wallet.copied': 'Copied', 'wallet.network': 'Network', 'wallet.quote': 'Available USDT',
    'wallet.base': 'Available base', 'wallet.disconnect': 'Disconnect', 'wallet.search': 'Search pairs', 'wallet.availPrefix': 'Available',
    'wallet.noResult': 'No matching pair',

    'order.qtyUnit': 'Size unit', 'order.crossNote': 'This price can fill immediately. It will match against the better resting price first and only the remainder rests.',
    'order.sheetClose': 'Close',
    'foot.note': 'SorDex is a non-custodial order book. Placing an order locks your assets in the contract; settlement happens atomically in one transaction and the assets go straight back to your wallet. There is no deposit or withdrawal, and the platform cannot touch your funds.',
  },
};

let lang = localStorage.getItem('sordex.lang') || (navigator.language.startsWith('zh') ? 'zh' : 'en');
const t = (k) => I18N[lang][k] ?? k;

let nodeOk = null;

function renderStatus() {
  const dot = $('statusDot');
  const txt = $('statusText');
  if (!dot || !txt) return;
  if (nodeOk === true) {
    dot.className = account ? 'dot ok' : 'dot';
    txt.textContent = account ? t('status.ok') : t('wallet.notConnected');
  } else if (nodeOk === false) {
    dot.className = 'dot bad';
    txt.textContent = t('status.fail');
  } else {
    dot.className = 'dot';
    txt.textContent = t('status.connecting');
  }
}

function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const k = el.dataset.i18n;

    if (k === 'status.connecting' || k === 'status.ok' || k === 'status.fail') continue;
    if (el.id === 'connectTxt' && account) { el.textContent = short(account); continue; }
    el.textContent = t(k);
  }
  for (const b of document.querySelectorAll('#lang button, #langDw button, #langAcct button')) b.classList.toggle('on', b.dataset.lang === lang);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);

  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);

  const ps = $('pairSearch'); if (ps) ps.placeholder = t('wallet.search');
  renderStatus();
  refreshSubmitLabel();
  renderOrders();
  renderTrades();
  updateSummary();
  setTitle();
}

const TITLE_KEYS = { home: 'title.home', markets: 'nav.markets', swap: 'nav.swap', pool: 'nav.pool', mm: 'nav.mmpro', notfound: 'nf.title', account: 'nav.account' };
function setTitle() {
  let head;
  if ((view === 'trade' || view === 'token') && curPair) {
    const px = book?.asks?.[0]?.price && book?.bids?.[0]?.price ? (book.asks[0].price + book.bids[0].price) / 2 : 0;
    head = `${curPair.baseSymbol || '?'}/${curPair.quoteSymbol || 'USDT'}` + (px > 0 ? ' ' + fmt(px, priceDp() + 1) : '');
  } else head = t(TITLE_KEYS[view] || 'title.home');
  document.title = `${head} · SORDEX`;
}

const pub = createPublicClient({ transport: http(CONFIG.rpc), pollingInterval: 1000 });
let wallet = null;
let account = null;
let pairs = [];
let curPair = null;
let side = 'buy';
let orderType = 'limit';
let book = { bids: [], asks: [] };
let myOrders = [];
let trades = [];
let decimalsBase = 18;
let decimalsQuote = 18;
let lastPrice = null;

let mmPair = null;

const $ = (id) => document.getElementById(id);

const fmt = (v, d = 4) => (v === null || v === undefined || Number.isNaN(v) ? '-' : Number(v).toFixed(d));

const fmtTiny = (v, d = 4) => { const n = Number(v); return n > 0 && n < 10 ** -d ? '<' + (10 ** -d).toFixed(d) : fmt(v, d); };

let chainClockSkew = 0, chainClockAt = 0;
async function syncChainClock() {
  try { const b = await pub.getBlock(); chainClockSkew = Number(b.timestamp) - Date.now() / 1000; chainClockAt = Date.now(); } catch {}
}
const chainNow = () => Date.now() / 1000 + chainClockSkew;

async function ensureChainClock() {
  if (Date.now() - chainClockAt > 60_000) await syncChainClock();
}

function fmtLocalTs(sec) {
  if (!(Number(sec) > 0)) return '';
  const d = new Date(Number(sec) * 1000);
  const p2 = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const tz = 'UTC' + (off >= 0 ? '+' : '-') + Math.floor(Math.abs(off) / 60) + (Math.abs(off) % 60 ? ':' + p2(Math.abs(off) % 60) : '');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} (${tz})`;
}

function unlockLeftText(unlockSec) {
  const left = Number(unlockSec) - chainNow();
  return left <= 0 ? t('pool.unlocked') : t('pool.leftMin').replace('{n}', String(Math.max(1, Math.ceil(left / 60))));
}

function fmtLocalTime(ts) {
  if (!ts) return '';
  try { return new Date(Number(ts)).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour12: false }); }
  catch { return ''; }
}
const short = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');

function toast(msg, type = 'info', ms = 3200) {
  const host = $('toastHost');
  if (!host || !msg) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span class="tico"></span><span>${esc(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, ms);
}

function bscscanTx(hash) {
  const base = CONFIG.chainId === 56 ? 'https://bscscan.com/tx/' : 'https://testnet.bscscan.com/tx/';
  return base + hash;
}

let lastTxBlock = 0n, lastTxAt = 0;

async function readFresh(params) {
  const pinned = lastTxBlock > 0n && Date.now() - lastTxAt < 30_000;
  for (let i = 0; ; i++) {
    try {
      if (!pinned) return await pub.readContract(params);
      const head = await pub.getBlockNumber();
      return await pub.readContract({ ...params, blockNumber: head > lastTxBlock ? head : lastTxBlock });
    } catch (e) {
      if (!pinned || i >= 5) throw e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

async function trackTx(hash, opts = {}) {
  const host = $('toastHost');
  let el = null;
  if (host) {
    el = document.createElement('div');
    el.className = 'toast info tx';
    el.innerHTML = `<span class="tico spin"></span><span class="txmsg">${esc(opts.pending || t('tx.pending'))}</span><a class="txlink" href="${esc(bscscanTx(hash))}" target="_blank" rel="noopener">${esc(short(hash))}</a>`;
    host.appendChild(el);
  }
  const finish = (cls, msg) => {
    if (!el) return;
    el.className = 'toast ' + cls + ' tx';
    const ic = el.querySelector('.tico'); if (ic) ic.className = 'tico';
    const m = el.querySelector('.txmsg'); if (m) m.textContent = msg;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, 4000);
  };
  try {
    const rcpt = await pub.waitForTransactionReceipt({ hash });
    if (rcpt.status === 'success') { lastTxBlock = rcpt.blockNumber; lastTxAt = Date.now(); }
    if (rcpt.status === 'success') finish('ok', opts.success || t('tx.success'));
    else finish('bad', t('tx.failed'));
    return rcpt;
  } catch (e) {
    finish('bad', t('tx.failed'));
    throw e;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      return true;
    } catch { return false; }
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function alignPrice(price, pair) {
  const tickNum = BigInt(pair?.tickNum ?? '1');
  const tickDen = BigInt(pair?.tickDen ?? '100');
  const shift = Number(pair?.quoteDecimals ?? 18) - Number(pair?.baseDecimals ?? 18);
  const k = Math.max(1, Math.round(price * 10 ** shift * Number(tickDen) / Number(tickNum)));
  return { num: tickNum * BigInt(k), den: tickDen, human: price, shift };
}

function priceDp(pair = curPair) {
  const tn = Number(pair?.tickNum), td = Number(pair?.tickDen);
  if (!(tn > 0 && td > 0)) return 6;
  const shift = Number(pair?.quoteDecimals ?? 18) - Number(pair?.baseDecimals ?? 18);
  const tick = tn / td / 10 ** shift;
  return Math.max(0, Math.min(10, Math.ceil(-Math.log10(tick) - 1e-9)));
}

function priceTick(pair = curPair) {
  const tn = Number(pair?.tickNum), td = Number(pair?.tickDen);
  if (!(tn > 0 && td > 0)) return 0;
  return tn / td / 10 ** (Number(pair?.quoteDecimals ?? 18) - Number(pair?.baseDecimals ?? 18));
}

const fmtQty = (v) => { const n = Number(v) || 0; const d = n >= 1000 ? 1 : n >= 1 ? 2 : 4; if (n > 0 && n < 10 ** -d) return '<' + (10 ** -d).toFixed(d); return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };

const fmtCompact = (v) => { const n = Number(v) || 0; return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(2); };
const fmtPx = (p) => (!(p > 0) ? '-' : p >= 1 ? fmt(p, 4) : String(Number(p.toPrecision(5))));

function chgView(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return { txt: '-', cls: '' };
  return { txt: `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`, cls: pct > 0 ? 'up' : pct < 0 ? 'down' : '' };
}

const isMobile = () => !!(window.matchMedia && window.matchMedia('(max-width:640px)').matches);

function navPair(pairId) { navTo((isMobile() ? '/token/' : '/trade/') + pairId); }

function getFavs() { try { return new Set(JSON.parse(localStorage.getItem('sordex.favs') || '[]').map(String)); } catch { return new Set(); } }
function toggleFav(pairId) {
  const f = getFavs(); const id = String(pairId);
  const on = !f.has(id); if (on) f.add(id); else f.delete(id);
  try { localStorage.setItem('sordex.favs', JSON.stringify([...f])); } catch {}
  toast(t(on ? 'mkt.favAdd' : 'mkt.favDel'), 'ok', 1400);
  return on;
}
const STAR = '<svg class="star-ic" viewBox="0 0 24 24"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>';

function openModal(title, html) {
  $('modalTitle').textContent = title; $('modalBody').innerHTML = html;
  $('modal').hidden = false; $('modalScrim').hidden = false;
}
function closeModal() { if ($('modal')) $('modal').hidden = true; if ($('modalScrim')) $('modalScrim').hidden = true; }
const pairById = (pid) => (pairs || []).find((p) => String(p.pairId) === String(pid));
const pairSym = (pid) => { const p = pairById(pid); return p ? `${p.baseSymbol || '?'}/${p.quoteSymbol || 'USDT'}` : `#${pid}`; };
const fmtTime = (ms) => { if (!ms) return '-'; const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

function readPct(x) {
  return Number(x) / 100;
}

function syncDrawerWallet() {
  const conn = null, btn = $('dwConnect'), out = $('dwDisconnect');
  if (account) {
    if (conn) conn.hidden = false;
    if (btn) btn.hidden = true;
    if (out) out.hidden = false;
    if ($('dwAddr')) $('dwAddr').textContent = short(account);
    if ($('dwNet')) $('dwNet').textContent = CONFIG.chainId === 56 ? 'BNB Chain' : `Chain ${CONFIG.chainId}`;
  } else {
    if (conn) conn.hidden = true;
    if (btn) btn.hidden = false;
    if (out) out.hidden = true;
  }
}

async function refreshWalletMenu() {
  syncDrawerWallet();
  syncStatusBar();
  const menu = $('walletMenu');
  if (!menu) return;
  if (!account) { menu.hidden = true; return; }
  if ($('wmAddr')) $('wmAddr').textContent = short(account);
  const netLabel = CONFIG.chainId === 56 ? 'BNB Chain' : `Chain ${CONFIG.chainId}`;
  if ($('wmNet')) $('wmNet').textContent = netLabel;
  if ($('dwNet')) $('dwNet').textContent = netLabel;
  if (curPair) {
    try {
      const [bq, bb] = await Promise.all([
        pub.readContract({ address: curPair.quote, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
        pub.readContract({ address: curPair.base, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      ]);
      const q = fmt(Number(bq) / 10 ** decimalsQuote, 2);
      const b = `${fmt(Number(bb) / 10 ** decimalsBase, 4)} ${curPair.baseSymbol || ''}`;
      if ($('wmQuote')) $('wmQuote').textContent = q;
      if ($('wmBase')) $('wmBase').textContent = b;
      if ($('dwQuote')) $('dwQuote').textContent = q;
      if ($('dwBase')) $('dwBase').textContent = fmt(Number(bb) / 10 ** decimalsBase, 4);
      for (const id of ['dwBaseK', 'wmBaseK']) if ($(id)) $(id).textContent = `${t('wallet.availPrefix')} ${curPair.baseSymbol || ''}`;
      if ($('sbQuote')) $('sbQuote').textContent = q;
      if ($('sbBase')) $('sbBase').textContent = fmt(Number(bb) / 10 ** decimalsBase, 4);
    } catch {}
  }
}

function syncStatusBar() {
  const on = !!account;
  if ($('sbAddrWrap')) $('sbAddrWrap').hidden = !on;
  if ($('sbDisconnect')) $('sbDisconnect').hidden = !on;
  if (!on) { if ($('sbQuote')) $('sbQuote').textContent = '-'; if ($('sbBase')) $('sbBase').textContent = '-'; }
  if ($('sbBaseK')) $('sbBaseK').textContent = curPair?.baseSymbol ? `${t('wallet.availPrefix')} ${curPair.baseSymbol}` : t('wallet.base');
  if ($('sbNet')) $('sbNet').textContent = CONFIG.chainId === 56 ? 'BNB Chain' : `Chain ${CONFIG.chainId}`;
  renderStatus();
}

function bscscanAddr(a) {
  return (CONFIG.chainId === 56 ? 'https://bscscan.com/address/' : 'https://testnet.bscscan.com/address/') + a;
}
async function initAccount() {
  const on = !!account;
  if ($('acctGuest')) $('acctGuest').hidden = on;
  if ($('acctMain')) $('acctMain').hidden = !on;
  if ($('acctDisconnect')) $('acctDisconnect').hidden = !on;
  syncColorSeg();
  if (!on) return;
  if ($('acctAddr')) $('acctAddr').textContent = short(account);
  if ($('acctNet')) $('acctNet').textContent = CONFIG.chainId === 56 ? 'BNB Chain' : `Chain ${CONFIG.chainId}`;
  if ($('acctScan')) $('acctScan').href = bscscanAddr(account);

  if (!_marketCache) await fetchMarketData().catch(() => {});
  await refreshOrders().catch(() => {});
  setAcctTab(acctTab);
  loadAcctAssets();
  loadPnl();
}

let acctTab = 'assets';
let acctVault = [];
function setAcctTab(tab) {
  acctTab = tab;
  for (const b of document.querySelectorAll('#acctTabs button')) b.classList.toggle('on', b.dataset.atab === tab);
  for (const pnl of document.querySelectorAll('.acct-pane')) pnl.hidden = pnl.dataset.apane !== tab;
  if (tab === 'orders') renderAcctOrders();
  else if (tab === 'trades') loadAcctTrades();
  else if (tab === 'liq') renderAcctLiq();
}
const midOf = (pid) => { const m = (_marketCache || []).find((r) => String(r.pairId) === String(pid)); return m ? m.price : 0; };

function visiblePairs(list, keepId) {
  const shown = (list || []).filter((p) => p.hidden !== true || String(p.pairId) === String(keepId ?? ''));
  return shown.length ? shown : (list || []);
}

async function loadAcctAssets() {
  const el = $('acctAssets'); if (!el || !account) return;
  el.innerHTML = `<p class="empty">${esc(t('acct.loading'))}</p>`;
  const list = (pairs || []).filter((p) => p.listingComplete !== false);
  const qDec = await usdtDecimals();
  const rd = (address, abi, functionName, args) => pub.readContract({ address, abi, functionName, args }).catch(() => 0n);
  const [usdtW, ...per] = await Promise.all([
    rd(CONFIG.quoteToken, erc20Abi, 'balanceOf', [account]),
    ...list.map(async (p) => {
      const pid = BigInt(p.pairId);
      const [w, vb, vq, pb, pq] = await Promise.all([
        rd(p.base, erc20Abi, 'balanceOf', [account]),
        rd(CONFIG.vault, vaultAbi, 'availableOf', [account, pid, p.base]),
        rd(CONFIG.vault, vaultAbi, 'availableOf', [account, pid, CONFIG.quoteToken]),
        rd(CONFIG.vault, vaultAbi, 'pendingWithdraw', [account, pid, p.base]),
        rd(CONFIG.vault, vaultAbi, 'pendingWithdraw', [account, pid, CONFIG.quoteToken]),
      ]);
      const bd = Number(p.baseDecimals ?? 18);
      return { p, bd, wallet: Number(w) / 10 ** bd, vb: Number(vb) / 10 ** bd, vq: Number(vq) / 10 ** qDec, pb: Number(pb) / 10 ** bd, pq: Number(pq) / 10 ** qDec };
    }),
  ]);
  const open = myOrders.filter((o) => o.status === 'open');
  const lockOf = (pid, side) => open.filter((o) => String(o.pairId) === String(pid) && o.side === side);

  const rows = [];
  let usdtLock = 0, usdtVault = 0;
  acctVault = [];
  for (const x of per) {
    const pid = x.p.pairId, price = midOf(pid);
    const lockB = lockOf(pid, 'sell').reduce((a, o) => a + Number(o.remainingBaseQty) / 10 ** x.bd, 0);
    usdtLock += lockOf(pid, 'buy').reduce((a, o) => a + (Number(o.remainingBaseQty) / 10 ** x.bd) * o.price * (1 + (x.p.takerFeeBps ?? 30) / 10000), 0);
    usdtVault += x.vq + x.pq;
    const tot = x.wallet + lockB + x.vb + x.pb;
    if (x.vb + x.vq + x.pb + x.pq > 0) acctVault.push({ pairId: pid, sym: pairSym(pid), base: x.vb, quote: x.vq, pb: x.pb, pq: x.pq, bs: x.p.baseSymbol || '' });
    if (tot > 0) rows.push({ sym: x.p.baseSymbol || '?', pid, wallet: x.wallet, lock: lockB, vault: x.vb + x.pb, tot, value: tot * price, dp: 4, logo: { baseSym: x.p.baseSymbol, logo: (_marketCache || []).find((r) => String(r.pairId) === String(pid))?.logo } });
  }
  const uw = Number(usdtW) / 10 ** qDec;
  const ut = uw + usdtLock + usdtVault;
  rows.unshift({ sym: 'USDT', pid: null, wallet: uw, lock: usdtLock, vault: usdtVault, tot: ut, value: ut, dp: 2, logo: { baseSym: 'U' } });
  const total = rows.reduce((a, r) => a + r.value, 0);
  if ($('acctValue')) $('acctValue').textContent = fmt(total, 2);
  el.innerHTML = rows.map((r) => `<div class="as-row">
    <div class="as-id">${logoHtml(r.logo)}<div><b>${esc(r.sym)}</b><span>≈ ${fmt(r.value, 2)} USDT</span></div><b class="as-tot">${fmt(r.tot, r.dp)}</b></div>
    <div class="as-break"><span><i>${esc(t('pa.wallet'))}</i>${fmt(r.wallet, r.dp)}</span><span><i>${esc(t('pa.locked'))}</i>${fmt(r.lock, r.dp)}</span><span><i>${esc(t('pa.vault'))}</i>${fmt(r.vault, r.dp)}</span></div>
    ${r.pid ? `<div class="as-act"><a href="/trade/${esc(pairSlug(r.pid))}" data-route>${esc(t('acct.trade'))}</a><a href="/swap" data-route>${esc(t('nav.swap'))}</a><a href="/pool" data-route>${esc(t('home.qkPool'))}</a></div>` : ''}
  </div>`).join('');
  bindRoutes(el);
  if (acctTab === 'liq') renderAcctLiq();
}

function renderAcctOrders() {
  const el = $('acctOrders'); if (!el) return;
  const open = myOrders.filter((o) => o.status === 'open').sort((a, b) => (b.ts || 0) - (a.ts || 0));
  el.innerHTML = open.length
    ? (isMobile() ? `<div class="t-ocards">${open.map(orderCardHtml).join('')}</div>` : `<table class="t-otable"><tbody>${open.map(orderRowHtml).join('')}</tbody></table>`)
    : `<p class="empty">${esc(t('acct.noOrders'))}</p>`;
  bindOrderActions(el);
}

async function loadAcctTrades() {
  const el = $('acctTrades'); if (!el || !account) return;
  el.innerHTML = `<p class="empty">${esc(t('acct.loading'))}</p>`;
  try {
    const j = await fetch(api(`/my-trades?addr=${account}&limit=100`)).then((r) => r.json());
    const a = j.trades || [];
    el.innerHTML = a.length ? a.map((x) => {
      const p = pairById(x.pairId);
      const role = x.role === 'mm' ? t('acct.roleMm') : x.role === 'maker' ? t('acct.roleMaker') : t('acct.roleTaker');
      return `<div class="mt-row">
        <div class="mt-l"><b>${esc(pairSym(x.pairId))}</b> <span class="side-tag ${x.side}">${x.side === 'buy' ? t('order.buy') : t('order.sell')}</span> <span class="role-tag">${esc(role)}</span>
          <span class="mt-t">${esc(fmtTime(x.ts))}</span></div>
        <div class="mt-r"><span>${fmt(x.price, p ? priceDp(p) : 6)}</span><span>${fmtTiny(x.qty, 4)} ${esc(p?.baseSymbol || '')}</span><span>${fmtTiny(x.cost, 2)} USDT${x.fee ? ` · ${esc(t('order.fee'))} ${fmtTiny(x.fee, 4)}` : ''}</span>
          <a href="${esc(bscscanTx(x.txHash))}" target="_blank" rel="noopener">${esc(short(x.txHash))}</a></div>
      </div>`;
    }).join('') : `<p class="empty">${esc(t('acct.noTrades'))}</p>`;
  } catch { el.innerHTML = `<p class="empty">${esc(t('acct.noTrades'))}</p>`; }
}

function renderAcctLiq() {
  const el = $('acctLiq'); if (!el) return;
  el.innerHTML = acctVault.length ? acctVault.map((v) => `<div class="as-row">
    <div class="as-id"><div><b>${esc(v.sym)}</b><span>≈ ${fmt(v.base * midOf(v.pairId) + v.quote + v.pb * midOf(v.pairId) + v.pq, 2)} USDT</span></div></div>
    <div class="as-break"><span><i>${esc(t('acct.vaultAvail'))}</i>${fmt(v.base, 4)} ${esc(v.bs)} · ${fmt(v.quote, 2)} USDT</span>
      ${v.pb + v.pq > 0 ? `<span><i>${esc(t('acct.vaultPending'))}</i>${fmt(v.pb, 4)} ${esc(v.bs)} · ${fmt(v.pq, 2)} USDT</span>` : ''}</div>
    <div class="as-act"><a href="/pool/mine" data-route>${esc(t('acct.manage'))}</a><a href="/trade/${esc(pairSlug(v.pairId))}" data-route>${esc(t('acct.trade'))}</a></div>
  </div>`).join('') : `<p class="empty">${esc(t('acct.noLiq'))} <a href="/pool" data-route>${esc(t('home.qkPool'))}</a></p>`;
  bindRoutes(el);
}

function bindRoutes(root) {
  for (const a of root.querySelectorAll('a[data-route]')) a.onclick = (e) => { e.preventDefault(); navTo(a.getAttribute('href')); };
}

let pnlData = null, pnlSeriesKey = 'total', pnlRange = 30;
async function loadPnl() {
  if (!account) return;
  try {
    pnlData = await fetch(api(`/my-pnl?addr=${account}`)).then((r) => r.json());
  } catch { pnlData = { points: [] }; }
  renderPnl();
}
function renderPnl() {
  const pts = pnlData?.points || [];
  const last = pts[pts.length - 1];
  const setV = (id, v) => { const el = $(id); if (!el) return; if (v == null) { el.textContent = '-'; el.className = 'v'; return; }
    el.textContent = `${v > 0 ? '+' : ''}${fmt(v, 2)}`; el.className = 'v ' + (v > 0 ? 'up' : v < 0 ? 'down' : ''); };

  const day0 = Math.floor(Date.now() / 86_400_000) * 86_400_000;
  const prev = pts.filter((p) => p.t <= day0).pop();
  setV('acctTotal', last ? last.total : null);
  setV('acctToday', last ? last.total - (prev ? prev.total : 0) : null);
  drawPnl();
  const note = document.querySelector('.pnl-note');
  if (note) note.textContent = pnlData && pnlData.synced === false ? t('acct.pnlSyncing') : t('acct.pnlNote');
}
function drawPnl(hoverX) {
  const c = $('pnlChart'); if (!c) return;
  const dpr = window.devicePixelRatio || 1, w = c.clientWidth || 600, h = 180;
  c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px';
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  let pts = (pnlData?.points || []).slice();
  if (pnlRange > 0) { const from = Date.now() - pnlRange * 86_400_000; const before = pts.filter((p) => p.t < from).pop(); pts = pts.filter((p) => p.t >= from); if (before) pts.unshift({ ...before, t: from }); }
  const tip = $('pnlTip');
  if (pts.length < 2) {
    ctx.fillStyle = cv('--c-t3', '#6e7889'); ctx.font = '12.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(t('acct.pnlEmpty'), w / 2, h / 2); ctx.textAlign = 'left'; if (tip) tip.hidden = true; return;
  }
  const k = pnlSeriesKey;
  const vals = pts.map((p) => p[k]);
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const padT = 14, padB = 22, padL = 6, padR = 56;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const X = (tt) => padL + ((tt - t0) / (t1 - t0 || 1)) * (w - padL - padR);
  const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const css = getComputedStyle(document.body);
  const up = vals[vals.length - 1] >= 0;
  const col = (up ? css.getPropertyValue('--buy') : css.getPropertyValue('--sell')).trim() || '#0cc595';

  ctx.strokeStyle = cv('--c-b1', '#1c232f'); ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) { const yy = padT + (i / 3) * (h - padT - padB); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke(); }
  ctx.setLineDash([3, 3]); ctx.strokeStyle = cv('--c-b2', '#2a3342'); ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke(); ctx.setLineDash([]);

  const g = ctx.createLinearGradient(0, padT, 0, h - padB); g.addColorStop(0, col + '40'); g.addColorStop(1, col + '00');
  ctx.beginPath(); ctx.moveTo(X(pts[0].t), Y(0));
  for (const p of pts) ctx.lineTo(X(p.t), Y(p[k]));
  ctx.lineTo(X(t1), Y(0)); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p[k])) : ctx.moveTo(X(p.t), Y(p[k])))); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = cv('--c-t3', '#6e7889'); ctx.font = '10.5px "Roboto Mono",monospace';
  ctx.fillText(fmt(hi, 2), w - padR + 6, padT + 4); ctx.fillText(fmt(lo, 2), w - padR + 6, h - padB);
  const dd = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };
  ctx.fillText(dd(t0), padL, h - 6); ctx.textAlign = 'right'; ctx.fillText(dd(t1), w - padR, h - 6); ctx.textAlign = 'left';

  if (hoverX != null && tip) {
    let best = pts[0]; for (const p of pts) if (Math.abs(X(p.t) - hoverX) < Math.abs(X(best.t) - hoverX)) best = p;
    const xx = X(best.t);
    ctx.strokeStyle = cv('--c-t2', '#a3acbb'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, h - padB); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(xx, Y(best[k]), 3.5, 0, Math.PI * 2); ctx.fill();
    const d = new Date(best.t);
    tip.innerHTML = `<span>${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}</span>
      <b>${best.total > 0 ? '+' : ''}${fmt(best.total, 2)}</b><i>${esc(t('acct.sTrading'))} ${fmt(best.trading, 2)} · ${esc(t('acct.sMm'))} ${fmt(best.mm, 2)}</i>`;
    tip.hidden = false; tip.style.left = Math.min(Math.max(xx - 70, 0), w - 150) + 'px';
  } else if (tip) tip.hidden = true;
}

function getColors() { try { return localStorage.getItem('sordex.colors') === 'red-up' ? 'red-up' : 'green-up'; } catch { return 'green-up'; } }
function applyColors() { document.body.classList.toggle('red-up', getColors() === 'red-up'); syncColorSeg(); }

function getTheme() { try { return localStorage.getItem('sordex.theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } }
function applyTheme() {
  const light = getTheme() === 'light';
  document.documentElement.classList.toggle('light', light);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = light ? '#ffffff' : '#07090d';

  for (const im of document.querySelectorAll('.brand img')) im.src = light ? '/logo-dark.png?v=1' : '/logo.png?v=1';
  for (const b of document.querySelectorAll('#themeSeg button')) b.classList.toggle('on', b.dataset.theme === getTheme());
}
function setTheme(v) {
  try { localStorage.setItem('sordex.theme', v); } catch {}
  applyTheme();
  try { if (view === 'token') drawChart('tkChart', 'tkLegend'); else drawChart(); } catch {}
  try { if (view === 'account') drawPnl(); } catch {}
  try { renderBook(); } catch {}
}

function cv(name, fb) { return getComputedStyle(document.body).getPropertyValue(name).trim() || fb; }
function syncColorSeg() { for (const b of document.querySelectorAll('#colorSeg button')) b.classList.toggle('on', b.dataset.colors === getColors()); }

let _connecting = false;
let _lastChainId = null;
async function connectWallet() {
  if (!window.ethereum) {
    setErr(t('err.noWallet'));
    return;
  }
  if (_connecting) return;
  _connecting = true;
  try {
    wallet = createWalletClient({ chain: CHAIN, transport: custom(window.ethereum) });
    bindWalletEvents();
    const accts = await wallet.requestAddresses();
    account = accts[0];

    let curChain = null;
    try { curChain = await wallet.getChainId(); } catch {}
    if (Number(curChain) !== Number(CONFIG.chainId)) {
      try {
        await wallet.switchChain({ id: CONFIG.chainId });
        curChain = CONFIG.chainId;
      } catch {
        setErr(t('err.wrongNet'));
      }
    }
    _lastChainId = curChain == null ? null : Number(curChain);
    if ($('connectTxt')) $('connectTxt').textContent = short(account);
    $('connect').classList.add('on');
    $('acctText').textContent = short(account);
    syncStatusBar();
    refreshWalletMenu();
    try { if (view === 'account') await initAccount(); } catch {}
    await refreshBalances();
    await refreshOrders();

    await refreshReferral();
    try { if (view === 'pool') await initPool(document.querySelector('.pool-tab.on')?.dataset.pooltab || 'add'); } catch {}
    try { if (view === 'mm') await initMM(); } catch {}
    try { if (view === 'swap') await refreshSwapBal(); } catch {}
  } catch (e) {
    setErr(txErrMsg(e, t('err.connectFail')));
  } finally {
    _connecting = false;
  }
}

let _walletEventsBound = false;
function bindWalletEvents() {
  if (_walletEventsBound || !window.ethereum || typeof window.ethereum.on !== 'function') return;
  _walletEventsBound = true;
  window.ethereum.on('accountsChanged', (accts) => {
    if (!account) return;
    if (!accts || !accts.length) { disconnectWallet(); return; }
    if (String(accts[0]).toLowerCase() === String(account).toLowerCase()) return;
    connectWallet();
  });
  window.ethereum.on('chainChanged', (cid) => {
    if (!account) return;
    const n = Number(cid);
    if (n === _lastChainId) return;
    _lastChainId = n;
    if (n !== Number(CONFIG.chainId)) { setErr(t('err.wrongNet')); return; }
    connectWallet();
  });
}

function disconnectWallet() {
  account = null; wallet = null;
  if ($('connectTxt')) $('connectTxt').textContent = t('wallet.connect');
  if ($('connect')) $('connect').classList.remove('on');
  if ($('acctText')) $('acctText').textContent = '';
  closeWalletMenu();
  syncDrawerWallet();
  syncStatusBar();
  if (view === 'account') initAccount();
  myOrders = []; renderOrders();
  refreshMyTrades();

  lastBal = { base: 0, quote: 0, pairId: null };
  for (const id of ['avail', 'availM', 'locked', 'sbQuote', 'sbBase']) if ($(id)) $(id).textContent = '-';
  updateSummary();
  toast(t('wallet.disconnected'), 'info', 2000);
}

function openDrawer() {
  syncDrawerWallet();
  const d = $('drawer'), s = $('scrim');
  if (s) s.hidden = false;
  if (d) d.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  const d = $('drawer'), s = $('scrim');
  if (d) d.hidden = true;
  if (s) s.hidden = true;
  document.body.style.overflow = '';
}
function closeWalletMenu() {
  const m = $('walletMenu'); if (m) m.hidden = true;
  const s = $('walletScrim'); if (s) s.hidden = true;
}

async function loadPairs() {
  const res = await fetch(api('/pairs'));

  pairs = (await res.json()).filter((p) => p.listingComplete === true);
  const sel = $('pairSel');
  sel.innerHTML = '';
  for (const p of pairs) {
    const o = document.createElement('option');
    o.value = p.pairId;

    const b = p.baseSymbol || p.base.slice(0, 6);
    const q = p.quoteSymbol || p.quote.slice(0, 6);
    o.textContent = `${b}/${q}`;
    sel.appendChild(o);
  }

  const best = pairs.find((p) => (p.openOrders ?? 0) > 0) ?? pairs[0];
  if (best) {
    sel.value = best.pairId;
    await selectPair(best.pairId);
  }
}

async function selectPair(pairId) {
  curPair = pairs.find((p) => p.pairId === pairId) ?? pairs[0];
  if (!curPair) return;
  depthStep = null;

  for (const id of ['price', 'qty', 'total']) { const el = $(id); if (el) el.value = ''; }
  await loadDecimals();
  await refreshBook();
  await refreshTrades();
  await refreshCandles();
  await refreshBalances();
  await refreshOrders();

  await refreshReferral();
  renderTradeMkts();
}

async function loadDecimals() {
  try {
    decimalsBase = Number(await pub.readContract({ address: curPair.base, abi: erc20Abi, functionName: 'decimals' }));
    decimalsQuote = Number(await pub.readContract({ address: curPair.quote, abi: erc20Abi, functionName: 'decimals' }));
  } catch {
    decimalsBase = 18;
    decimalsQuote = 18;
  }

  curPair.sdxBuyBps = 0;
  curPair.sdxSellBps = 0;
  curPair.sdxDeclared = false;
  try {
    const r = await pub.readContract({
      address: curPair.base,
      abi: parseAbi(['function sordexTax() view returns (uint16,uint16,address)']),
      functionName: 'sordexTax',
    });
    curPair.sdxBuyBps = Number(r[0]) || 0;
    curPair.sdxSellBps = Number(r[1]) || 0;
    curPair.sdxDeclared = true;
  } catch {}
}

async function refreshBook() {
  try {

    const r = await fetch(`${CONFIG.apiBase}/mixed-book?pairId=${curPair.pairId}`);
    book = await r.json();
    renderBook();
    if (view === 'trade' || view === 'token') setTitle();
  } catch {

    try {
      const r = await fetch(`${CONFIG.apiBase}/book?pairId=${curPair.pairId}`);
      book = await r.json();
      renderBook();
    } catch {}
  }
}

let candles = [];
let chartBucket = 120;
let chartMode = 'chart';
let candleStyle = 'candle';
let chartCollapsed = false;
function applyChartCollapsed() {
  const c = $('chartPanel');
  if (c) c.classList.toggle('collapsed', chartCollapsed);
  const t = document.getElementById('chartToggleTop');
  if (t) t.classList.toggle('on', !chartCollapsed);
  if ($('viewTrade')) $('viewTrade').classList.toggle('chart-off', chartCollapsed);
}

async function refreshCandles() {
  try {
    const r = await fetch(`${CONFIG.apiBase}/candles?pairId=${curPair.pairId}&limit=200&bucketBlocks=${chartBucket}`);
    const j = await r.json();
    candles = j.candles ?? [];
    drawChart();
  } catch {}
}

function mergeSrc(a, b) {
  const s = new Set([...(a || '').split('+'), ...(b || '').split('+')].filter(Boolean));
  return [...s].sort().join('+') || 'onchain';
}

function aggregateDepth(levels, step, roundUp) {
  const m = new Map();
  for (const l of levels) {

    const k = roundUp ? Math.ceil(l.price / step - 1e-9) : Math.floor(l.price / step + 1e-9);
    const price = k * step;
    const key = String(k);
    const cur = m.get(key);
    if (cur) { cur.qty += l.qty; cur.src = mergeSrc(cur.src, l.src); }
    else m.set(key, { price, qty: l.qty, src: l.src || 'onchain' });
  }
  const out = [...m.values()];
  out.sort((a, b) => (roundUp ? a.price - b.price : b.price - a.price));
  return out;
}

let depthStep = null;

function depthSteps(ref, tick = 0) {
  let arr = !(ref > 0) ? [0.0001, 0.0002, 0.0005, 0.001, 0.002]
    : [1, 2, 5, 10, 20].map((m) => Math.pow(10, Math.floor(Math.log10(ref)) - 2) * m);

  if (tick > 0) { arr = arr.filter((s) => s > tick * (1 + 1e-9)); arr.unshift(tick); }
  return arr;
}

function stepDp(step) {
  if (!(step > 0)) return 4;
  return Math.max(0, Math.min(10, Math.ceil(-Math.log10(step) - 1e-9)));
}

function stepLabel(step) { return fmt(step, stepDp(step)); }

function renderBook() {
  const bestBidRaw = book.bids?.[0]?.price, bestAskRaw = book.asks?.[0]?.price;
  const ref = (bestBidRaw && bestAskRaw) ? (bestBidRaw + bestAskRaw) / 2 : (bestBidRaw || bestAskRaw || trades[0]?.price || 0);
  const steps = depthSteps(ref, priceTick());

  if (depthStep == null || !steps.some((s) => Math.abs(s - depthStep) < s * 1e-9)) depthStep = steps[0];
  const dp = stepDp(depthStep);
  const midDp = dp + 1;

  const groupEl = $('depthGroup');
  if (groupEl) {
    groupEl.innerHTML = steps.map((s) =>
      `<option value="${s}"${Math.abs(s - depthStep) < s * 1e-9 ? ' selected' : ''}>${esc(stepLabel(s))}</option>`
    ).join('');
    groupEl.value = String(depthStep);
  }

  const asks = aggregateDepth(book.asks ?? [], depthStep, true).slice(0, 13);
  const bids = aggregateDepth(book.bids ?? [], depthStep, false).slice(0, 13);
  const maxQty = Math.max(1e-12, ...[...asks, ...bids].map((l) => l.qty));

  const draw = (arr, el) => {
    el.innerHTML = arr
      .map((l) => {
        const pct = Math.min(100, (l.qty / maxQty) * 100);

        const src = l.src || 'onchain';
        const dot = src.includes('signed')
          ? `<i class="srcdot ${src.includes('onchain') ? 'both' : 'mm'}" title="${src.includes('onchain') ? '用户单+做市商报价' : '做市商报价'}"></i>`
          : '';
        return `<div class="row" data-price="${l.price}" title="${t('book.clickFill')}"><span class="bar" style="width:${pct}%"></span>
          <span>${fmt(l.price, dp)}${dot}</span><span>${fmtQty(l.qty)}</span><span>${fmtQty(l.price * l.qty)}</span></div>`;
      })
      .join('');
  };
  draw(asks.slice().reverse(), $('asks'));
  draw(bids, $('bids'));

  {
    const bq = bids.reduce((a, l) => a + l.qty, 0), sq = asks.reduce((a, l) => a + l.qty, 0), tot = bq + sq;
    const bp = tot > 0 ? Math.round((bq / tot) * 100) : 50;
    if ($('brB')) $('brB').textContent = tot > 0 ? `B ${bp}%` : 'B -';
    if ($('brS')) $('brS').textContent = tot > 0 ? `${100 - bp}% S` : '- S';
    if ($('brBar')) $('brBar').style.width = bp + '%';
  }

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  let mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk ?? null;

  if (mid === null && trades.length) mid = trades[0].price;

  const midEl = $('mid');
  if (midEl) {
    const spreadBps = (bestBid && bestAsk)
      ? (((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 10000).toFixed(1)
      : null;
    const dirUp = lastPrice === null || !mid || mid >= lastPrice;
    const arrow = `<svg class="t-arrow ${dirUp ? 'up' : 'down'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${dirUp ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'}"/></svg>`;
    const spreadAbs = (bestBid && bestAsk) ? `${t('ticker.spread')} ${fmt(bestAsk - bestBid, dp)}` : '';
    midEl.className = 't-mid ' + (dirUp ? 'up' : 'down');
    midEl.innerHTML = `<b>${mid ? fmt(mid, midDp) : '-'}</b>${arrow}<span class="t-sp"></span><span class="t-mid-sp">${spreadAbs}</span>`;
    if ($('bookSpread')) $('bookSpread').textContent = spreadAbs;
  }

  if ($('barBid')) $('barBid').textContent = bestBid ? fmt(bestBid, dp) : '-';
  if ($('barAsk')) $('barAsk').textContent = bestAsk ? fmt(bestAsk, dp) : '-';
  if ($('barSpread')) $('barSpread').textContent = (bestBid && bestAsk) ? fmt(bestAsk - bestBid, dp) : '-';
  if ($('qBid')) $('qBid').textContent = $('barBid')?.textContent || '-';
  if ($('qAsk')) $('qAsk').textContent = $('barAsk')?.textContent || '-';
  if ($('qSpread')) $('qSpread').textContent = $('barSpread')?.textContent || '-';
  if ($('colPxU')) $('colPxU').textContent = ` (${curPair?.quoteSymbol || 'USDT'})`;
  if ($('colQtyU')) $('colQtyU').textContent = ` (${curPair?.baseSymbol || ''})`;
  for (const el of document.querySelectorAll('#viewTrade .bsym')) el.textContent = curPair?.baseSymbol || '-';
  for (const el of document.querySelectorAll('#viewTrade .qsym')) el.textContent = curPair?.quoteSymbol || 'USDT';
  {
    const m = (_marketCache || []).find((r) => String(r.pairId) === String(curPair?.pairId));
    const cv = chgView(m ? m.changePct : null);
    if ($('barChg')) { $('barChg').textContent = cv.txt; $('barChg').className = cv.cls; }
    if ($('chgPct')) { $('chgPct').textContent = cv.txt; $('chgPct').className = 't-chgpill ' + cv.cls; }
    if ($('barHigh')) $('barHigh').textContent = m && m.high ? fmt(m.high, dp) : '-';
    if ($('barLow')) $('barLow').textContent = m && m.low ? fmt(m.low, dp) : '-';
    if ($('barVolM')) $('barVolM').textContent = m && Number.isFinite(m.vol) ? `${fmtCompact(m.vol)} ${curPair?.quoteSymbol || 'USDT'}` : '-';
  }
  if ($('barPair')) {
    $('barPair').textContent = `${curPair?.baseSymbol || '?'}/${curPair?.quoteSymbol || 'USDT'}`;
  }
  if ($('barSub')) {
    $('barSub').textContent = curPair?.quoteSymbol
      ? `${curPair.baseSymbol || '?'} / ${curPair.quoteSymbol}`
      : '';
  }
  if ($('barLogo')) {
    const ml = (_marketCache || []).find((r) => String(r.pairId) === String(curPair?.pairId));
    $('barLogo').innerHTML = logoHtml({ baseSym: curPair?.baseSymbol, logo: ml?.logo });
  }
  if ($('tokenDetailsBtn') && curPair) $('tokenDetailsBtn').setAttribute('href', '/token/' + pairSlug(curPair.pairId));

  if ($('barFee')) {
    $('barFee').textContent = ((curPair?.takerFeeBps ?? 0) / 100).toFixed(2) + '%';
  }
  if ($('qFee')) $('qFee').textContent = $('barFee')?.textContent || '-';
  setQtyUnit();

  if ($('barVol')) {
    const m = (_marketCache || []).find((r) => String(r.pairId) === String(curPair?.pairId));
    $('barVol').textContent = m && Number.isFinite(m.vol) ? `${fmt(m.vol, 2)} ${curPair?.quoteSymbol || 'USDT'}` : '-';
  }

  if (mid) {
    const lp = $('lastPrice');
    if (lp) {

      if (lastPrice !== null && mid !== lastPrice) {
        lp.classList.remove('flash-up', 'flash-down');
        void lp.offsetWidth;
        lp.classList.add(mid > lastPrice ? 'flash-up' : 'flash-down');
      }
      lp.textContent = fmt(mid, midDp);
      lp.classList.toggle('down', mid < (lastPrice ?? mid));
      if ($('barUsd')) $('barUsd').textContent = `≈ $${fmt(mid, midDp)}`;
    }
    lastPrice = mid;
  }
  drawChart();
  prefillPrice();
  refreshSubmitLabel();
  if (view === 'trade') setTitle();
}

function drawChart(cid, legendId) {
  cid = cid || 'chart'; legendId = legendId || 'chartLegend';
  const c = $(cid);
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth || 600;

  let h = 260;
  if ((cid === 'chart' || cid === 'tkChart') && c.parentElement) {
    const cs = getComputedStyle(c.parentElement);
    const ph = c.parentElement.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (ph > 120) h = Math.round(ph);
  }
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (chartMode === 'depth' || (!candles.length && cid !== 'chart')) {
    drawDepth(ctx, w, h, legendId);
    return;
  }
  if (!candles.length) {

    ctx.fillStyle = cv('--c-t3', '#8b95a5');
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('chart.noTrades'), w / 2, h / 2);
    ctx.textAlign = 'left';
    $(legendId).textContent = '';
    return;
  }

  const padL = 8, padR = 58, padT = 12, padB = 22;
  const iw = w - padL - padR;
  const ih = h - padT - padB;

  let lo = Infinity, hi = -Infinity;
  const lineMode = candleStyle === 'line' || cid === 'tkChart';
  if (lineMode) {
    for (const k of candles) { lo = Math.min(lo, k.c); hi = Math.max(hi, k.c); }
  } else {
    for (const k of candles) { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h); }
  }
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad; hi += pad;

  const ph = cid === 'tkChart' ? ih : ih * 0.8;
  const y = (p) => padT + ph - ((p - lo) / (hi - lo)) * ph;
  const cw = Math.max(1, Math.min(12, iw / candles.length));
  const bw = Math.max(1, cw * 0.62);
  const x0 = padL + iw - cw * candles.length;

  const axisDec = hi >= 1000 ? 0 : hi >= 1 ? 2 : hi >= 0.01 ? 4 : hi >= 0.0001 ? 6 : 8;

  const cssv = getComputedStyle(document.body);
  const cUp = cssv.getPropertyValue('--c-up').trim() || '#0cc595', cDown = cssv.getPropertyValue('--c-down').trim() || '#f6465d';
  ctx.strokeStyle = cv('--c-b1', '#1c232f');
  ctx.fillStyle = cv('--c-t3', '#6e7889');
  ctx.font = '11px "Roboto Mono",monospace';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const py = padT + (ph / 4) * i;
    const price = hi - ((hi - lo) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(padL + iw, py);
    ctx.stroke();
    ctx.fillText(price.toFixed(axisDec), padL + iw + 6, py + 3);
  }

  if (lineMode) {

    const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
    grad.addColorStop(0, 'rgba(12,197,149,0.28)');
    grad.addColorStop(1, 'rgba(12,197,149,0)');
    const px = (i) => x0 + cw * i + cw / 2;
    ctx.beginPath();
    candles.forEach((k, i) => { const cx = px(i), cy = y(k.c); i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy); });
    ctx.lineTo(px(candles.length - 1), padT + ih);
    ctx.lineTo(px(0), padT + ih);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    candles.forEach((k, i) => { const cx = px(i), cy = y(k.c); i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy); });
    ctx.strokeStyle = cUp;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  } else {

    for (const [i, k] of candles.entries()) {
      const cx = x0 + cw * i + cw / 2;
      const up = k.c >= k.o;
      const color = up ? cUp : cDown;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.moveTo(cx, y(k.h));
      ctx.lineTo(cx, y(k.l));
      ctx.lineWidth = 1;
      ctx.stroke();

      const yo = y(k.o), yc = y(k.c);
      const top = Math.min(yo, yc);
      const bh = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(cx - bw / 2, top, bw, bh);
    }
  }

  if (cid === 'tkChart') { $(legendId).textContent = ''; return; }

  const vmax = Math.max(1e-12, ...candles.map((k) => Number(k.v) || 0));
  const vh = ih * 0.18;
  ctx.globalAlpha = 0.28;
  for (const [i, k] of candles.entries()) {
    const cx = x0 + cw * i + cw / 2, hv = ((Number(k.v) || 0) / vmax) * vh;
    ctx.fillStyle = k.c >= k.o ? cUp : cDown;
    ctx.fillRect(cx - bw / 2, padT + ih - hv, bw, hv);
  }
  ctx.globalAlpha = 1;

  const last = candles[candles.length - 1].c;
  const ly = y(last);
  ctx.strokeStyle = cUp; ctx.globalAlpha = 0.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(padL + iw, ly); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  const lt = fmt(last, axisDec);
  ctx.font = '500 12px "Roboto Mono",monospace';
  const tw = ctx.measureText(lt).width + 12;
  ctx.fillStyle = cUp;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(padL + iw + 2, ly - 11, tw, 22, 4) : ctx.rect(padL + iw + 2, ly - 11, tw, 22); ctx.fill();
  ctx.fillStyle = '#04110e'; ctx.fillText(lt, padL + iw + 8, ly + 4);

  $(legendId).textContent =
    t('chart.source') + ` · ${candles.length} ` + t('chart.candles');
}

function drawDepth(ctx, w, h, legendId) {
  legendId = legendId || 'chartLegend';
  const bids = (book.bids ?? []).slice(0, 9);
  const asks = (book.asks ?? []).slice(0, 9);
  const all = [...bids.map((b) => b.price), ...asks.map((a) => a.price)];
  if (!all.length) {
    ctx.fillStyle = cv('--c-t3', '#8b95a5');
    ctx.font = '12px sans-serif';
    ctx.fillText(t('chart.noOrders'), 14, 28);
    $(legendId).textContent = '';
    return;
  }

  const minP = Math.min(...all);
  const maxP = Math.max(...all);
  const pad = (maxP - minP) * 0.08 || 1;
  const lo = minP - pad;
  const hi = maxP + pad;
  const x = (p) => ((p - lo) / (hi - lo)) * (w - 20) + 10;

  let cum = 0;
  const cumBids = bids.map((b) => (cum += b.qty, { price: b.price, cum }));
  cum = 0;
  const cumAsks = asks.map((a) => (cum += a.qty, { price: a.price, cum }));
  const maxCum = Math.max(1e-12, cumBids.at(-1)?.cum ?? 0, cumAsks.at(-1)?.cum ?? 0);
  const y = (v) => h - 24 - (v / maxCum) * (h - 44);

  const drawArea = (pts, color) => {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(x(pts[0].price), y(0));
    for (const p of pts) ctx.lineTo(x(p.price), y(p.cum));
    ctx.lineTo(x(pts.at(-1).price), y(0));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [i, p] of pts.entries()) {
      if (i === 0) ctx.moveTo(x(p.price), y(p.cum));
      else ctx.lineTo(x(p.price), y(p.cum));
    }
    ctx.stroke();
  };

  drawArea(cumBids.slice().reverse(), '#2fa870');
  drawArea(cumAsks, '#c4553f');

  ctx.fillStyle = cv('--c-t3', '#8b95a5');
  ctx.font = '11px monospace';

  const adp = priceDp();
  ctx.fillText(fmt(minP, adp), 10, h - 6);
  ctx.textAlign = 'right';
  ctx.fillText(fmt(maxP, adp), w - 10, h - 6);
  ctx.textAlign = 'left';
  $(legendId).textContent = candles.length ? t('chart.depthLegend') : t('chart.depthFallback');
}

async function refreshTrades() {
  try {
    const r = await fetch(`${CONFIG.apiBase}/trades?pairId=${curPair.pairId}&limit=30`);
    const j = await r.json();
    trades = j.trades ?? [];
    renderTrades();
  } catch {}
}

function renderTrades(bodyId, emptyId) {
  bodyId = bodyId || 'tradesBody'; emptyId = emptyId || 'tradesEmpty';
  if (bodyId === 'tkTradesBody') { renderTkTrades(); return; }
  if (view === 'token') renderTkTrades();
  const tb = $(bodyId);
  if (!tb) return;

  const pairLbl = curPair ? `${curPair.baseSymbol || '?'}/${curPair.quoteSymbol || 'USDT'}` : '';
  for (const id of ['tradesPair', 'tkTradesPair']) { const el = $(id); if (el) el.textContent = pairLbl; }

  refreshMyTrades();
}

let myPairTrades = [];
let _myTradesKey = '', _myTradesAt = 0, _myTradesBusy = false;

async function refreshMyTrades(force) {
  if (!account || !curPair) { myPairTrades = []; _myTradesKey = ''; renderMyTrades(); return; }
  const key = `${account.toLowerCase()}:${curPair.pairId}`;
  const tabOpen = !$('tabTrades') || !$('tabTrades').classList.contains('hide');
  if (key !== _myTradesKey) { myPairTrades = []; _myTradesAt = 0; renderMyTrades(); }
  if (!tabOpen && !force) return;
  if (!force && key === _myTradesKey && Date.now() - _myTradesAt < 4000) return;
  if (_myTradesBusy) return;
  _myTradesBusy = true;
  try {
    const r = await fetch(api(`/my-trades?addr=${account}&limit=200`));
    if (!r.ok) return;
    const j = await r.json();
    if (`${account.toLowerCase()}:${curPair.pairId}` !== key) return;
    myPairTrades = (j.trades ?? []).filter((x) => String(x.pairId) === String(curPair.pairId));
    _myTradesKey = key; _myTradesAt = Date.now();
    renderMyTrades();
  } catch {} finally { _myTradesBusy = false; }
}

function renderMyTrades() {
  const tb = $('tradesBody'); if (!tb) return;
  tb.innerHTML = myPairTrades
    .map((x) => {
      const buy = x.side === 'buy';
      return `<tr title="${esc(x.txHash || '')}">`
        + `<td class="${buy ? 'trade-up' : 'trade-down'}">${buy ? t('order.buy') : t('order.sell')}</td>`
        + `<td>${fmt(x.price, 4)}</td>`
        + `<td class="t-qty">${fmtTiny(Number(x.qty), 4)}</td>`
        + `<td class="t-total">${fmtTiny(Number(x.cost), 2)}</td>`
        + `<td class="t-time">${x.ts ? fmtLocalTime(x.ts) : '-'}</td></tr>`;
    })
    .join('');
  const e = $('tradesEmpty');
  if (e) {
    e.textContent = account ? t('t.emptyMyTrades') : t('t.connectMyTrades');
    e.classList.toggle('hide', myPairTrades.length > 0);
  }
}

function renderTkTrades() {
  const tb = $('tkTradesBody'), ml = $('tkTradesM'); if (!tb) return;
  const dp = priceDp(), qs = curPair?.quoteSymbol || 'USDT';
  const rows = trades.slice(0, 30).map((x, i) => {
    const older = trades[i + 1];
    const cls = older && Number(x.price) < Number(older.price) ? 'down' : 'up';
    const qty = Number(x.qty) / 10 ** decimalsBase, cost = Number(x.cost) / 10 ** decimalsQuote, fee = Number(x.fee || 0) / 10 ** decimalsQuote;
    const tm = x.ts ? new Date(x.ts).toTimeString().slice(0, 8) : '#' + x.block;
    const tx = x.txHash ? `<a href="${esc(bscscanTx(x.txHash))}" target="_blank" rel="noopener">${esc(short(x.txHash))}</a>` : '-';
    return { cls, qty, cost, fee, tm, tx, px: fmt(x.price, dp) };
  });
  tb.innerHTML = rows.map((r) => `<tr><td>${r.tm}</td><td class="${r.cls}">${r.px}</td><td>${fmtQty(r.qty)}</td><td>${fmtQty(r.cost)} ${esc(qs)}</td><td>${fmtQty(r.fee)}</td><td class="r">${r.tx}</td></tr>`).join('');
  if (ml) ml.innerHTML = rows.map((r) => `<div class="pd-mt"><div class="pd-l1"><span>${r.tm}</span><span class="${r.cls}">${r.px}</span><span>${fmtQty(r.qty)}</span></div>
    <div class="pd-l2"><span>${fmtQty(r.cost)} ${esc(qs)} · ${esc(t('tk.fee'))} ${fmtQty(r.fee)}</span><span class="t-sp"></span>${r.tx}</div></div>`).join('');
  const e = $('tkTradesEmpty'); if (e) e.classList.toggle('hide', rows.length > 0);
  document.querySelector('.pd-trades')?.classList.toggle('is-empty', rows.length === 0);
}

async function refreshOrders() {
  if (!account) {
    myOrders = [];
    renderOrders();
    return;
  }
  try {
    const r = await fetch(`${CONFIG.apiBase}/orders?owner=${account}`);
    const j = await r.json();
    myOrders = j.orders ?? [];
    renderOrders();
  } catch {}
}

function orderView(o) {
  const p = pairById(o.pairId);
  const bd = Number(p?.baseDecimals ?? decimalsBase);
  const orig = Number(o.originalBaseQty) / 10 ** bd, rem = Number(o.remainingBaseQty) / 10 ** bd;
  const filledPct = orig > 0 ? ((orig - rem) / orig) * 100 : 0;
  const open = o.status === 'open';
  const st = open && filledPct > 0 ? 'partial' : o.status;
  return { p, orig, filledPct, open, st, stTxt: st === 'partial' ? t('ord.partial') : t('st.' + o.status),
    px: fmt(o.price, p ? priceDp(p) : 6), sideTxt: o.side === 'buy' ? t('order.buy') : t('order.sell') };
}
function orderRowHtml(o) {
  const v = orderView(o);
  return `<tr>
      <td class="mono">${esc(fmtTime(o.ts))}</td>
      <td class="pair">${esc(pairSym(o.pairId))}</td>
      <td class="side ${o.side}">${v.sideTxt}</td>
      <td class="mono">${v.px}</td>
      <td class="mono">${fmtQty(v.orig)}</td>
      <td class="mono">${v.filledPct.toFixed(1)}%</td>
      <td><span class="t-st ${v.st}">${esc(v.stTxt)}</span></td>
      <td class="r">${v.open ? `<button class="t-btn" data-amend="${o.id}">${t('ord.reprice')}</button><button class="t-btn ghost" data-cancel="${o.id}">${t('ord.cancel')}</button>` : ''}</td>
    </tr>`;
}

function orderCardHtml(o) {
  const v = orderView(o);
  const tm = o.ts ? new Date(o.ts).toTimeString().slice(0, 8) : '-';
  return `<div class="t-ocard">
      <div class="t-oc-top"><b>${esc(pairSym(o.pairId))}</b><span class="t-sidetag ${o.side}">${v.sideTxt}</span><span class="t-sp"></span><span class="t-oc-st ${v.st}">${esc(v.stTxt)}</span></div>
      <div class="t-oc-grid">
        <div><span>${esc(t('t.price'))}</span><b>${v.px}</b></div>
        <div><span>${esc(t('t.qty'))}</span><b>${fmtQty(v.orig)}</b></div>
        <div><span>${esc(t('t.filled'))}</span><b>${v.filledPct.toFixed(0)}%</b></div>
        <div><span>${esc(t('t.time'))}</span><b>${tm}</b></div>
      </div>
      ${v.open ? `<div class="t-oc-act"><button class="t-btn" data-amend="${o.id}">${t('ord.reprice')}</button><button class="t-btn ghost" data-cancel="${o.id}">${t('ord.cancel')}</button></div>` : ''}
    </div>`;
}
function bindOrderActions(root) {
  for (const b of root.querySelectorAll('[data-cancel]')) b.onclick = () => cancelOrder(b.dataset.cancel);
  for (const b of root.querySelectorAll('[data-amend]')) b.onclick = () => openAmend(b.dataset.amend);
}
function renderOrders() {
  const tb = $('ordersBody');
  if (!tb) return;

  const list = myOrders.filter((o) => o.status === 'open').sort((a, b) => (b.ts || 0) - (a.ts || 0));
  tb.innerHTML = list.map(orderRowHtml).join('');
  if ($('ordersCards')) { $('ordersCards').innerHTML = list.map(orderCardHtml).join(''); bindOrderActions($('ordersCards')); }
  $('ordersEmpty').classList.toggle('hide', list.length > 0);
  if ($('tabOrders')) $('tabOrders').classList.toggle('is-empty', list.length === 0);
  bindOrderActions(tb);
  const nOpen = myOrders.filter((o) => o.status === 'open').length;
  const ob = document.querySelector('#bottomTabs button[data-tab="orders"]');
  if (ob) ob.textContent = `${t('tab.orders')} (${nOpen})`;
}

function openAmend(id) {
  const o = myOrders.find((x) => String(x.id) === String(id)); if (!o) return;
  const p = pairById(o.pairId); if (!p) return;
  const bd = Number(p.baseDecimals ?? 18);
  const rem = Number(o.remainingBaseQty) / 10 ** bd;
  openModal(t('ord.repriceTitle'), `
    <div class="md-sub">${esc(pairSym(o.pairId))} · <span class="side-tag ${o.side}">${o.side === 'buy' ? t('order.buy') : t('order.sell')}</span></div>
    <label class="md-l">${esc(t('ord.newPrice'))}</label>
    <div class="md-in"><input id="amPx" inputmode="decimal" value="${fmt(o.price, priceDp(p))}"><span>${esc(p.quoteSymbol || 'USDT')}</span></div>
    <label class="md-l">${esc(t('ord.newQty'))}</label>
    <div class="md-in"><input id="amQty" inputmode="decimal" value="${floorFix(rem, Math.min(8, bd))}"><span>${esc(p.baseSymbol || '')}</span></div>
    <p class="md-err" id="amErr"></p>
    <button class="submit" id="amGo">${esc(t('ord.confirm'))}</button>`);
  $('amGo').onclick = async () => {
    const err = $('amErr'); err.textContent = '';
    const px = Number($('amPx').value), qty = Number($('amQty').value);
    if (!(px > 0)) { err.textContent = t('order.badInput'); return; }
    if (!(qty > 0) || qty > rem * (1 + 1e-9)) { err.textContent = t('ord.badQty').replace('{n}', fmt(rem, 4)); return; }
    const lim = alignPrice(px, p);
    let qtyWei = parseUnits(floorFix(qty, Math.min(8, bd)), bd);
    if (qtyWei > BigInt(o.remainingBaseQty)) qtyWei = BigInt(o.remainingBaseQty);
    if (Math.abs(px - o.price) < 1e-15 && qtyWei === BigInt(o.remainingBaseQty)) { err.textContent = t('ord.samePx'); return; }
    const btn = $('amGo'); btn.disabled = true; btn.textContent = t('order.submitBusy');
    try {
      if (o.side === 'buy') {

        const od = await pub.readContract({ address: CONFIG.book, abi: bookAbi, functionName: 'getOrder', args: [BigInt(o.id)] });
        const need = await pub.readContract({ address: CONFIG.book, abi: parseAbi(['function requiredQuoteLock(uint256,uint256,uint256,uint16,uint16) view returns (uint256)']),
          functionName: 'requiredQuoteLock', args: [qtyWei, lim.num, lim.den, od.feeBps, od.buyTaxBps] });
        if (need > od.lockedQuote) await ensureAllowance(p.quote, need - od.lockedQuote);
      }
      await pub.simulateContract({ address: CONFIG.book, abi: bookAbi, functionName: 'amendOrder', args: [BigInt(o.id), lim.num, lim.den, qtyWei], account });
      const hash = await sendContractTx({ address: CONFIG.book, abi: bookAbi, functionName: 'amendOrder', args: [BigInt(o.id), lim.num, lim.den, qtyWei], account });
      closeModal();
      await trackTx(hash, { success: t('ord.amended') });
      await refreshOrders(); await refreshBalances().catch(() => {}); await refreshBook();
      if (view === 'account') renderAcctOrders();
    } catch (e) {
      err.textContent = txErrMsg(e, t('tx.failed'));
    } finally { btn.disabled = false; btn.textContent = t('ord.confirm'); }
  };
}

async function renderPairAssets() {
  const el = $('pairAssets'); if (!el) return;
  if (!account || !curPair) { el.innerHTML = `<p class="empty">${esc(t('pa.needWallet'))}</p>`; return; }
  const bs = curPair.baseSymbol || '', qs = curPair.quoteSymbol || 'USDT';
  const open = myOrders.filter((o) => o.status === 'open' && String(o.pairId) === String(curPair.pairId));
  const lockB = open.filter((o) => o.side === 'sell').reduce((a, o) => a + Number(o.remainingBaseQty) / 10 ** decimalsBase, 0);
  const lockQ = open.filter((o) => o.side === 'buy').reduce((a, o) => a + (Number(o.remainingBaseQty) / 10 ** decimalsBase) * o.price * (1 + (curPair.takerFeeBps ?? 30) / 10000), 0);
  let vB = 0, vQ = 0;
  try {
    const [a, b] = await Promise.all([
      pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'availableOf', args: [account, BigInt(curPair.pairId), curPair.base] }),
      pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'availableOf', args: [account, BigInt(curPair.pairId), curPair.quote] }),
    ]);
    vB = Number(a) / 10 ** decimalsBase; vQ = Number(b) / 10 ** decimalsQuote;
  } catch {}
  const row = (sym, w, l, v, d) => `<div class="pa-row"><b>${esc(sym)}</b>
    <span><i>${esc(t('pa.wallet'))}</i>${fmt(w, d)}</span><span><i>${esc(t('pa.locked'))}</i>${fmt(l, d)}</span><span><i>${esc(t('pa.vault'))}</i>${fmt(v, d)}</span></div>`;
  el.innerHTML = row(bs, lastBal.pairId === curPair.pairId ? lastBal.base : 0, lockB, vB, 4) + row(qs, lastBal.pairId === curPair.pairId ? lastBal.quote : 0, lockQ, vQ, 2);
}

let lastBal = { base: 0, quote: 0, pairId: null };
async function refreshBalances() {
  if (!account || !curPair) return;
  const [b, q] = await Promise.all([
    readFresh({ address: curPair.base, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    readFresh({ address: curPair.quote, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
  ]);
  const balBase = Number(b) / 10 ** decimalsBase;
  const balQuote = Number(q) / 10 ** decimalsQuote;
  lastBal = { base: balBase, quote: balQuote, pairId: curPair.pairId };
  if ($('tabAssets') && !$('tabAssets').classList.contains('hide')) renderPairAssets();

  if ($('sbQuote')) $('sbQuote').textContent = fmt(balQuote, 2);
  if ($('sbBase')) $('sbBase').textContent = fmt(balBase, 4);
  if ($('sbBaseK')) $('sbBaseK').textContent = `${t('wallet.availPrefix')} ${curPair.baseSymbol || ''}`;
  const baseSym = curPair.baseSymbol || '', quoteSym = curPair.quoteSymbol || 'USDT';
  const locked = myOrders.filter((o) => o.status === 'open').reduce((s, o) => s + Number(o.remainingBaseQty) / 10 ** decimalsBase, 0);
  $('avail').textContent = side === 'buy' ? `${fmt(balQuote, 2)} ${quoteSym}` : `${fmt(balBase, 4)} ${baseSym}`;
  if ($('availM')) $('availM').textContent = $('avail').textContent;
  $('locked').textContent = `${fmt(locked, 4)} ${baseSym}`;
  updateSummary();
}

function isTakerOrder(price) {
  if (orderType === 'market') return true;
  if (!(price > 0)) return false;
  const bestAsk = book?.asks?.[0]?.price, bestBid = book?.bids?.[0]?.price;
  return side === 'buy' ? (bestAsk > 0 && price >= bestAsk) : (bestBid > 0 && price <= bestBid);
}

function balanceShortfall(price, qty) {
  if (!account || !curPair || lastBal.pairId !== curPair.pairId) return null;
  if (!(qty > 0)) return null;
  const EPS = 1e-6;
  if (side === 'buy') {
    if (!(price > 0)) return null;
    const feeBps = isTakerOrder(price) ? (curPair.takerFeeBps ?? 0) : (curPair.makerFeeBps ?? 0);
    const need = price * qty * (1 + (feeBps + (curPair.buyTaxBps ?? 0)) / 10000);
    return need > lastBal.quote + EPS ? 'quote' : null;
  }
  return qty > lastBal.base + EPS * Math.max(1, lastBal.base) ? 'base' : null;
}

function updateSummary() {

  const price = orderType === 'market' ? (effPrice() || 0) : Number($('price').value || 0);
  const qty = Number($('qty').value || 0);
  const notional = price * qty;
  $('notional').textContent = notional ? fmt(notional, 2) : '-';

  const feeBps = isTakerOrder(price) ? (curPair?.takerFeeBps ?? 0) : (curPair?.makerFeeBps ?? 0);

  const xferTax = curPair?.taxProbed ? (curPair?.baseTransferTaxBps ?? 0) : 0;
  const buyTax = Math.max(curPair?.buyTaxBps ?? 0, curPair?.sdxBuyBps ?? 0) + xferTax;
  const sellTax = Math.max(curPair?.sellTaxBps ?? 0, curPair?.sdxSellBps ?? 0) + xferTax;
  const baseSym = curPair?.baseSymbol || '';
  const quoteSym = curPair?.quoteSymbol || 'USDT';

  const fee = (notional * feeBps) / 10000;
  $('feeView').textContent = notional ? `${fmt(fee, 4)} ${quoteSym} (${(feeBps / 100).toFixed(2)}%)` : '-';

  let pay = '-', get = '-';
  if (notional > 0) {
    if (side === 'buy') {

      pay = `${fmt(notional + fee, 6)} ${quoteSym}`;
      get = `${fmt(qty * (1 - buyTax / 10000), 6)} ${baseSym}`;
    } else {

      pay = `${fmt(qty, 6)} ${baseSym}`;
      get = `${fmt(notional * (1 - sellTax / 10000) - fee, 6)} ${quoteSym}`;
    }
  }
  $('youPay').textContent = pay;
  $('youGet').textContent = get;
  const note = $('estNote');
  if (note) note.textContent = notional > 0 ? t(orderType === 'market' ? 'order.estMarket' : 'order.estLimit') : '';

  {
    const sf = balanceShortfall(price, qty);
    const msgs = [t('order.insufficientQuote'), t('order.insufficientBase')];
    const cur = $('err').textContent;
    if (sf) setErr(t(sf === 'quote' ? 'order.insufficientQuote' : 'order.insufficientBase'));
    else if (msgs.includes(cur)) setErr('');
  }

  $('taxView').textContent =
    buyTax || sellTax
      ? `${t('tax.buy')} ${(buyTax / 100).toFixed(2)}% / ${t('tax.sell')} ${(sellTax / 100).toFixed(2)}%`
      : t('t.none');

  { const w = $('sdxWarn'); if (w) { w.hidden = !curPair?.sdxDeclared; w.textContent = curPair?.sdxDeclared ? t('order.sdxWarn') : ''; } }

  const ch = $('crossHint');
  if (ch) {
    let cross = false;
    if (orderType === 'limit' && price > 0) {
      const ba = bestAsk(), bb = bestBid();
      cross = side === 'buy' ? (ba > 0 && price >= ba) : (bb > 0 && price <= bb);
    }
    ch.textContent = cross ? t('order.crossNote') : '';
  }
}

function bestAsk() { return (book?.asks ?? [])[0]?.price || 0; }
function bestBid() { return (book?.bids ?? [])[0]?.price || 0; }

function effPrice() {
  const p = Number($('price').value || 0);
  if (p > 0) return p;
  return side === 'buy' ? bestAsk() : bestBid();
}

function recalcTotalFromQty() {
  const p = Number($('price').value || 0), q = Number($('qty').value || 0);
  const tot = $('total');

  if (tot) { const v = p * q; tot.value = (p > 0 && q > 0) ? v.toFixed(v >= 1 ? 2 : 6).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1') : ''; }
  updateSummary();
}

function recalcQtyFromTotal() {
  const p = Number($('price').value || 0), tt = Number($('total').value || 0);
  if (p > 0 && tt > 0) $('qty').value = (tt / p).toFixed(Math.min(8, decimalsBase));
  else if (!(tt > 0)) $('qty').value = '';
  updateSummary();
}

function prefillPrice() {
  const el = $('price');
  if (!el || document.activeElement === el) return;
  if (orderType === 'market') return;
  if (Number(el.value) > 0) return;
  const ref = side === 'buy' ? (bestAsk() || bestBid()) : (bestBid() || bestAsk());
  if (ref > 0) { el.value = fmt(ref, priceDp()); recalcTotalFromQty(); }
}

function fillPriceFromBook(price) {
  if (!(price > 0)) return;
  $('price').value = fmt(price, priceDp());
  if (Number($('total').value) > 0 && !(Number($('qty').value) > 0)) recalcQtyFromTotal();
  else recalcTotalFromQty();
}

function setErr(msg) {
  $('err').textContent = msg || '';
}

function refreshSubmitLabel() {
  const b = $('submit');
  if (!b) return;
  const sym = curPair?.baseSymbol || '';
  b.textContent = (side === 'buy' ? t('order.submitBuy') : t('order.submitSell')) + (sym ? ' ' + sym : '');
  b.classList.toggle('sell', side === 'sell');
}

async function ensureAllowance(token, amount) {
  return ensureAllowanceTo(token, CONFIG.book, amount);
}

async function submitOrder() {
  setErr('');
  if (!account) return setErr(t('order.needWallet'));

  const price = Number($('price').value);
  const qty = Number($('qty').value);
  if (!(price > 0) || !(qty > 0)) return setErr(t('order.badInput'));
  await refreshBalances().catch(() => {});
  const sf = balanceShortfall(price, qty);
  if (sf) return setErr(t(sf === 'quote' ? 'order.insufficientQuote' : 'order.insufficientBase'));

  const lim = alignPrice(price, curPair);
  const { num, den } = lim;
  const qtyWei = parseUnits(String(qty), decimalsBase);

  const asks = book?.asks ?? [], bids = book?.bids ?? [];
  const crossDepth = side === 'buy'
    ? asks.filter((l) => l.price <= price).reduce((s, l) => s + l.qty, 0)
    : bids.filter((l) => l.price >= price).reduce((s, l) => s + l.qty, 0);

  const _minBaseQty = BigInt(curPair.minBaseQty ?? '0');
  const _minNotional = BigInt(curPair.minNotional ?? '0');
  const _notionalWei = (qtyWei * num) / den;
  const restTooSmall = (w) => w < _minBaseQty || (w * num) / den < _minNotional;
  if (crossDepth > 0) {

  } else if (qtyWei < _minBaseQty) {
    return setErr(t('order.minQty') + ' ' + fmt(Number(_minBaseQty) / 10 ** decimalsBase, 6) + ' ' + (curPair.baseSymbol || ''));
  } else if (_notionalWei < _minNotional) {
    return setErr(t('order.minNotional') + ' ' + fmt(Number(_minNotional) / 10 ** decimalsQuote, 2) + ' ' + (curPair.quoteSymbol || 'USDT'));
  }

  const btn = $('submit');
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('order.submitBusy');

  try {

    let placeWei = qtyWei;
    let skippedRest = false;
    if (crossDepth > 0) {
      const r = await executeTake(side === 'buy', qtyWei, lim, price);
      if (r.executed) {
        const remainder = Math.max(0, qty - Math.min(qty, crossDepth));
        placeWei = remainder > 0 ? parseUnits(remainder.toFixed(Math.min(8, decimalsBase)), decimalsBase) : 0n;
      } else if (r.reason === 'self') {

        return setErr(t('order.selfTrade'));
      } else {

        if (qtyWei < _minBaseQty) return setErr(t('order.minQty') + ' ' + fmt(Number(_minBaseQty) / 10 ** decimalsBase, 6) + ' ' + (curPair.baseSymbol || ''));
        if (_notionalWei < _minNotional) return setErr(t('order.minNotional') + ' ' + fmt(Number(_minNotional) / 10 ** decimalsQuote, 2) + ' ' + (curPair.quoteSymbol || 'USDT'));
      }
    }

    if (placeWei > 0n && restTooSmall(placeWei)) { skippedRest = true; placeWei = 0n; }
    if (placeWei > 0n) {
      if (side === 'buy') {
        const notional = (placeWei * num) / den;
        const taxBps = BigInt(curPair.buyTaxBps ?? 0);
        const feeBps = BigInt(curPair.takerFeeBps ?? 0);
        const reserve = (notional * (taxBps + feeBps)) / 10000n + 1000n;
        await ensureAllowance(curPair.quote, notional + reserve);
        const hash = await sendContractTx({
          address: CONFIG.book, abi: bookAbi, functionName: 'placeBuy',
          args: [BigInt(curPair.pairId), placeWei, num, den, 0n], account,
        });
        await trackTx(hash, { success: t('tx.placed') });
      } else {
        await ensureAllowance(curPair.base, placeWei);
        const hash = await sendContractTx({
          address: CONFIG.book, abi: bookAbi, functionName: 'placeSell',
          args: [BigInt(curPair.pairId), placeWei, num, den, 0n], account,
        });
        await trackTx(hash, { success: t('tx.placed') });
      }
    }
    $('qty').value = '';
    await refreshBook();
    await refreshOrders();
    await refreshBalances();
    if (skippedRest) setErr(t('order.restTooSmall') + ' ' + fmt(Number(_minNotional) / 10 ** decimalsQuote, 2) + ' ' + (curPair.quoteSymbol || 'USDT'));
  } catch (e) {
    setErr(txErrMsg(e, t('order.failGeneric')));
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
    refreshSubmitLabel();
  }
}

async function cancelOrder(id) {
  if (!account) return;
  try {
    const hash = await sendContractTx({
      address: CONFIG.book, abi: bookAbi, functionName: 'cancelOrder', args: [BigInt(id)], account,
    });
    await trackTx(hash);
    await refreshOrders();
    await refreshBalances();
    await refreshBook();
  } catch (e) {
    setErr(txErrMsg(e, t('order.failGeneric')));
  }
}

async function executeTake(takerBuys, qtyWei, lim, limitPriceForReserve, pair = curPair) {
  let plan = await planTake(takerBuys, qtyWei, lim, pair);
  if (!plan.ok) return { executed: false, reason: plan.reason };
  const { payToken, reserve } = plan;
  if (CONFIG.router) {

    let approved = false;
    if (plan.aIds.length > 0) approved = (await ensureAllowanceTo(payToken, CONFIG.book, reserve)) || approved;
    if (plan.quotes.length > 0) approved = (await ensureAllowanceTo(payToken, CONFIG.settler, reserve)) || approved;

    if (approved) {
      plan = await planTake(takerBuys, qtyWei, lim, pair);
      if (!plan.ok) return { executed: false, reason: plan.reason };
      if (plan.aIds.length > 0) await ensureAllowanceTo(payToken, CONFIG.book, reserve);
      if (plan.quotes.length > 0) await ensureAllowanceTo(payToken, CONFIG.settler, reserve);
    }

    for (let attempt = 0; ; attempt++) {
      try {
        await pub.simulateContract({ address: CONFIG.router, abi: routerAbi, functionName: 'takeMixed', args: [plan.pr], account });
        break;
      } catch (e) {
        const msg = ((e?.shortMessage || '') + ' ' + (e?.message || '')).toLowerCase();
        const stale = msg.includes('0x3482428a') || msg.includes('nothingfilled');
        const expired = msg.includes('0x203d82d8') || msg.includes('expired');
        if (!stale && !expired) break;
        if (expired) chainClockAt = 0;
        if (attempt >= 1) throw Object.assign(new Error('quotes moved'), { userMsg: t('order.quotesMoved') });
        plan = await planTake(takerBuys, qtyWei, lim, pair);
        if (!plan.ok) return { executed: false, reason: plan.reason };
      }
    }
    const hash = await sendContractTx({ address: CONFIG.router, abi: routerAbi, functionName: 'takeMixed', args: [plan.pr], account });

    const rc = await trackTx(hash);
    if (rc?.status !== 'success') throw Object.assign(new Error('take-reverted'), { userMsg: t('order.noFill') });
    return { executed: true, hash };
  } else {
    await ensureAllowanceTo(payToken, CONFIG.book, reserve);
    const hash = await sendContractTx({

      address: CONFIG.book, abi: parseAbi(['function takeOrdersMin(uint256 pairId, bool takerBuys, uint256 maxBaseQty, uint256 limitPriceNum, uint256 limitPriceDen, uint256[] makerIds, uint256 deadline, uint256 minTakerOut) returns (uint256)']),
      functionName: 'takeOrdersMin',
      args: [BigInt(pair.pairId), takerBuys, qtyWei, lim.num, lim.den, plan.aIds, plan.deadline, plan.pr.minTakerOut], account,
    });
    const rc = await trackTx(hash);
    if (rc?.status !== 'success') throw Object.assign(new Error('take-reverted'), { userMsg: t('order.noFill') });
  }
  return { executed: true };
}

async function planTake(takerBuys, qtyWei, lim, pair) {
  const [aRes, bRes] = await Promise.all([
    fetch(`${CONFIG.apiBase}/open-orders?pairId=${pair.pairId}`).then((r) => r.json()).catch(() => ({ orders: [] })),
    fetch(`${CONFIG.apiBase}/signed-quotes?pairId=${pair.pairId}`).then((r) => r.json()).catch(() => ({ quotes: [] })),
  ]);
  const wantMakerSide = takerBuys ? 'sell' : 'buy';

  const limH = lim.human ?? (Number(lim.num) / Number(lim.den)) / 10 ** (lim.shift ?? 0);
  const priceOk = (p) => takerBuys ? p <= limH * (1 + 1e-9) : p >= limH * (1 - 1e-9);
  const rawOk = (pn, pd) => takerBuys ? pn * lim.den <= lim.num * pd : pn * lim.den >= lim.num * pd;

  const acctLc0 = (account || '').toLowerCase();
  const aCross = (aRes.orders ?? []).filter((o) => o.side === wantMakerSide && priceOk(o.price));

  const aSelf = aCross.filter((o) => (o.owner || '').toLowerCase() === acctLc0).length;
  const aOrders = aCross
    .filter((o) => (o.owner || '').toLowerCase() !== acctLc0)
    .sort((x, y) => takerBuys ? x.price - y.price : y.price - x.price);
  const aIds = aOrders.map((o) => BigInt(o.id));
  const maxA = aOrders.reduce((s, o) => s + BigInt(o.remainingBaseQty), 0n);

  const bMatched = (bRes.quotes ?? [])
    .filter((q) => (q.side === 1 ? 'sell' : 'buy') === wantMakerSide && rawOk(BigInt(q.quote.priceNum), BigInt(q.quote.priceDen)))
    .sort((x, y) => {

      const a = BigInt(x.quote.priceNum) * BigInt(y.quote.priceDen), b = BigInt(y.quote.priceNum) * BigInt(x.quote.priceDen);
      return a === b ? 0 : ((a < b) === takerBuys ? -1 : 1);
    });

  const acctLc = (account || '').toLowerCase();
  const bQuotes = bMatched.filter((q) => (q.quote.maker || '').toLowerCase() !== acctLc);
  const selfSkipped = bMatched.length - bQuotes.length + aSelf;
  const quotes = bQuotes.map((q) => ({
    maker: q.quote.maker, pairId: BigInt(q.quote.pairId), side: q.quote.side,
    priceNum: BigInt(q.quote.priceNum), priceDen: BigInt(q.quote.priceDen), baseQty: BigInt(q.quote.baseQty),
    expiry: BigInt(q.quote.expiry), nonce: BigInt(q.quote.nonce), salt: BigInt(q.quote.salt),
  }));
  const sigs = bQuotes.map((q) => q.signature);
  const maxB = bQuotes.reduce((s, q) => s + BigInt(q.availableBase), 0n);

  if (aIds.length === 0 && quotes.length === 0) return { ok: false, reason: selfSkipped > 0 ? 'self' : 'empty' };

  const payToken = takerBuys ? pair.quote : pair.base;

  let reserve;
  if (takerBuys) {
    const num = BigInt(lim.num), den = BigInt(lim.den);
    const notional = (qtyWei * num + den - 1n) / den;
    const feeBps = BigInt(Math.floor(Number(pair?.takerFeeBps ?? 30)));
    const buyTax = BigInt(Math.floor(Number(pair?.buyTaxBps ?? 0)));
    reserve = notional + (notional * (feeBps + buyTax) + 9999n) / 10000n + 1000n;
  } else {
    reserve = qtyWei;
  }
  await ensureChainClock();
  const deadline = BigInt(Math.floor(chainNow()) + 600);

  const onchainFill = maxA < qtyWei ? maxA : qtyWei;
  const remForSigned = qtyWei > onchainFill ? qtyWei - onchainFill : 0n;

  const plannedFill = onchainFill + (maxB < remForSigned ? maxB : remForSigned);
  const xferTax = pair?.taxProbed ? Number(pair?.baseTransferTaxBps ?? 0) : 0;
  const buyTaxBps = Math.max(Number(pair?.buyTaxBps ?? 0), Number(pair?.sdxBuyBps ?? 0)) + xferTax;
  const sellTaxBps = Math.max(Number(pair?.sellTaxBps ?? 0), Number(pair?.sdxSellBps ?? 0)) + xferTax;
  const takerFee = Number(pair?.takerFeeBps ?? 0);
  const keepBps = BigInt(Math.max(0, Math.floor((10000 - (takerBuys ? buyTaxBps : sellTaxBps + takerFee)) * 0.99)));
  const minOut = (takerBuys
    ? (plannedFill * keepBps) / 10000n
    : (((plannedFill * BigInt(lim.num)) / BigInt(lim.den)) * keepBps) / 10000n) || 1n;
  const pr = {
    pairId: BigInt(pair.pairId), takerBuys, limitNum: lim.num, limitDen: lim.den, deadline,
    maxOnchainBase: onchainFill,
    onchainMakerIds: aIds,
    maxSignedBase: maxB < remForSigned ? maxB : remForSigned,
    quotes, signatures: sigs,
    maxTotalBase: qtyWei,
    minTakerOut: minOut,
  };
  return { ok: true, aIds, quotes, payToken, reserve, deadline, pr };
}

async function marketTake() {
  setErr('');
  if (!account) return setErr(t('order.needWallet'));
  const qty = Number($('qty').value);
  if (!(qty > 0)) return setErr(t('order.badInput'));

  const takerBuys = side === 'buy';
  const qtyWei = parseUnits(String(qty), decimalsBase);

  const bestOpp = takerBuys ? book.asks?.[0]?.price : book.bids?.[0]?.price;
  if (!(bestOpp > 0)) return setErr(t('order.noBookForMarket'));
  await refreshBalances().catch(() => {});
  { const sf = balanceShortfall(bestOpp, qty); if (sf) return setErr(t(sf === 'quote' ? 'order.insufficientQuote' : 'order.insufficientBase')); }
  const effPrice = takerBuys ? bestOpp * 1.01 : bestOpp * 0.99;
  const lim = alignPrice(effPrice, curPair);

  const btn = $('submit');
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('order.submitBusy');
  try {
    const r = await executeTake(takerBuys, qtyWei, lim, effPrice);
    if (!r.executed) return setErr(r.reason === 'self' ? t('order.selfTrade') : t('order.noCrossable'));
    $('qty').value = '';
    await refreshBook(); await refreshOrders(); await refreshBalances(); await refreshTrades();
  } catch (e) {
    setErr(txErrMsg(e, t('tx.failed')));
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
    refreshSubmitLabel();
  }
}

async function ensureAllowanceTo(token, spender, amount) {
  const cur = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account, spender] });
  if (cur >= amount) return false;
  setErr(t('order.approving'));

  const hash = await sendContractTx({
    address: token, abi: erc20Abi, functionName: 'approve', args: [spender, amount], account,
  });
  const rcpt = await waitOk(hash);
  setErr(t('order.approveSync'));
  const until = Date.now() + 20_000;
  while (Date.now() < until) {
    try {
      const head = await pub.getBlockNumber();
      if (head >= rcpt.blockNumber + 2n) {
        const now = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account, spender], blockNumber: head });
        if (now >= amount) break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  setErr('');
  return true;
}

let swapSide = 'buy';
let swapSlipBps = 100;
let swapPair = null;
let swapBook = { bids: [], asks: [] };
let _swapBookPair = null;

function initSwap() {
  const sel = $('swapToken');
  if (sel && pairs.length) {
    const cur = sel.value || (swapPair && swapPair.pairId);
    sel.innerHTML = pairs.map((p) => `<option value="${esc(p.pairId)}">${esc(p.baseSymbol)} / USDT</option>`).join('');
    if (cur && pairs.some((p) => p.pairId === cur)) sel.value = cur;
    swapPair = pairs.find((p) => p.pairId === sel.value) ?? pairs[0];
  } else if (pairs.length && !swapPair) {
    swapPair = pairs[0];
  }
  renderSwapSide();
  setSwapErr('');
  swapPreview();
}

function renderSwapSide() {
  for (const b of document.querySelectorAll('#swapSideTabs button')) b.classList.toggle('on', b.dataset.sside === swapSide);
  const sym = swapPair?.baseSymbol || '—';
  if ($('swapPayLabel')) $('swapPayLabel').textContent = swapSide === 'buy' ? 'USDT' : sym;
  if ($('swapGetLabel')) $('swapGetLabel').textContent = swapSide === 'buy' ? sym : 'USDT';
  if ($('swapSubmit')) $('swapSubmit').textContent = swapSide === 'buy' ? t('swap.btnBuy') : t('swap.btnSell');
  if ($('swapFlip')) $('swapFlip').title = t('swap.flip');
  for (const b of document.querySelectorAll('#swapSlip button')) b.classList.toggle('on', Number(b.dataset.slip) === swapSlipBps);
  refreshSwapBal();
  renderSwapRecent();
}

let swapPayBal = 0, swapBalLoaded = false;

async function refreshSwapBal() {
  const el = $('swapPayBal'); if (!el) return;
  swapPayBal = 0; swapBalLoaded = false; el.innerHTML = '';
  if (!account || !swapPair) return;
  try {
    const buy = swapSide === 'buy';
    const tok = buy ? (CONFIG.quoteToken || swapPair.quote) : swapPair.base;
    const dec = buy ? await usdtDecimals() : Number(swapPair.baseDecimals ?? 18);
    const bal = await readFresh({ address: tok, abi: erc20Abi, functionName: 'balanceOf', args: [account] });
    swapPayBal = Number(bal) / 10 ** dec;
    swapBalLoaded = true;
    swapPreview();
    el.innerHTML = `${esc(t('pool.bal').replace('{n}', fmt(swapPayBal, buy ? 2 : 4)))} <a class="bal-max" id="swapMax">${esc(t('ui.max'))}</a>`;
  } catch { el.innerHTML = ''; }
}

async function loadSwapBook() {
  if (!swapPair) return;
  if (_swapBookPair !== swapPair.pairId) swapBook = { bids: [], asks: [] };
  try {
    const r = await fetch(api(`/mixed-book?pairId=${swapPair.pairId}`)).then((x) => x.json());
    swapBook = { bids: r.bids ?? [], asks: r.asks ?? [] };
    _swapBookPair = swapPair.pairId;
  } catch {}
}

function walkSwap(sideBuy, amount, bids, asks) {
  const levels = sideBuy ? asks : bids;
  if (!levels.length || !(amount > 0)) return null;
  let base = 0, quote = 0, worst = 0, rem = amount, insufficient = false;
  if (sideBuy) {
    for (const lv of levels) {
      const cost = lv.price * lv.qty;
      if (rem >= cost) { base += lv.qty; quote += cost; rem -= cost; worst = lv.price; }
      else { base += rem / lv.price; quote += rem; worst = lv.price; rem = 0; break; }
    }
    if (rem > 1e-9) insufficient = true;
  } else {
    for (const lv of levels) {
      const take = Math.min(lv.qty, rem);
      base += take; quote += take * lv.price; worst = lv.price; rem -= take;
      if (rem <= 1e-9) { rem = 0; break; }
    }
    if (rem > 1e-9) insufficient = true;
  }
  if (!(base > 0)) return null;

  let used = 0, srcM = false, srcB = false;
  for (const lv of levels) { if (!(sideBuy ? lv.price <= worst * (1 + 1e-12) : lv.price >= worst * (1 - 1e-12))) break; used++; const sr = lv.src || 'onchain'; if (sr.includes('signed')) srcM = true; if (sr.includes('onchain')) srcB = true; }
  return { base, quote, avg: quote / base, best: levels[0].price, worst, impact: levels[0].price > 0 ? Math.abs(quote / base - levels[0].price) / levels[0].price : 0, insufficient, levels: used, src: srcM && srcB ? 'both' : srcM ? 'mm' : 'book' };
}

const _swapFmt = (n, d) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });

async function swapPreview() {
  const amt = Number($('swapPay') && $('swapPay').value);
  if ($('swapSubmit')) $('swapSubmit').disabled = !!(amt > 0 && swapBalShort(amt));
  const g = $('swapGet'), st = $('swapStats');
  if (!swapPair || !(amt > 0)) {
    if (g) g.value = '';
    if (st) { st.hidden = false; st.innerHTML = `<div class="swap-note">${t('swap.enterAmount')}</div>`; }
    return;
  }
  await loadSwapBook();
  const r = walkSwap(swapSide === 'buy', amt, swapBook.bids, swapBook.asks);
  if (!r) {
    if (g) g.value = '';
    if (st) { st.hidden = false; st.innerHTML = `<div class="swap-warn">${t('swap.noLiq')}</div>`; }
    return;
  }
  const getSym = swapSide === 'buy' ? (swapPair.baseSymbol || '') : 'USDT';
  const feeBps = Number(swapPair.takerFeeBps ?? 30);
  const short = swapBalShort(amt);

  const xferTax = swapPair.taxProbed ? Number(swapPair.baseTransferTaxBps ?? 0) : 0;
  const getAmt = (swapSide === 'buy' ? r.base : r.quote) * (1 - xferTax / 10000);
  const minGet = getAmt * (1 - swapSlipBps / 10000);
  if (g) g.value = _swapFmt(getAmt, 6);
  if (st) {
    st.hidden = false;
    st.innerHTML =
      `<div><span>${t('swap.avgPrice')}</span><b>${_swapFmt(r.avg, 8)} USDT</b></div>` +
      `<div><span>${t('swap.impact')}</span><b class="${r.impact > 0.05 ? 'swap-hi' : ''}">${(r.impact * 100).toFixed(2)}%</b></div>` +
      `<div><span>${t('swap.minGet')}</span><b>${_swapFmt(minGet, 6)} ${getSym}</b></div>` +
      `<div><span>${t('swap.route')}</span><b>${esc(t('swap.routeVal').replace('{n}', String(r.levels)).replace('{src}', t(r.src === 'both' ? 'swap.srcBoth' : r.src === 'mm' ? 'swap.srcMm' : 'swap.srcBook')))}</b></div>` +
      `<div><span>${t('swap.fee')}</span><b>${(feeBps / 100).toFixed(2)}%</b></div>` +
      (xferTax > 0 ? `<div><span>${t('swap.transferTax')}</span><b class="swap-hi">${(xferTax / 100).toFixed(2)}%</b></div>` : (!swapPair.taxProbed ? `<div class="swap-note">${t('swap.taxUnknown')}</div>` : '')) +
      (r.insufficient ? `<div class="swap-warn">${t('swap.insufficient')}</div>` : '') +
      (short ? `<div class="swap-warn">${esc(short)}</div>` : '') +
      `<div class="swap-note">${t('order.estMarket')}</div>`;
  }
}

function swapBalShort(amt) {
  if (!account || !swapBalLoaded || !swapPair) return '';
  const buy = swapSide === 'buy';
  const feeBps = Number(swapPair.takerFeeBps ?? 30);
  const need = buy ? amt * (1 + feeBps / 10000) : amt;
  if (need <= swapPayBal * (1 + 1e-9)) return '';
  return buy
    ? t('swap.balShort').replace('{sym}', 'USDT').replace('{n}', fmt(swapPayBal, 2)).replace('{fee}', (feeBps / 100).toFixed(2))
    : t('swap.balShortSell').replace('{sym}', swapPair.baseSymbol || '').replace('{n}', fmt(swapPayBal, 4));
}

async function doSwap() {
  setSwapErr('');
  if (!account) return setSwapErr(t('order.needWallet'));
  if (!swapPair) return setSwapErr(t('swap.selectToken'));
  const amt = Number($('swapPay').value);
  if (!(amt > 0)) return setSwapErr(t('swap.badAmount'));
  { const short = swapBalShort(amt); if (short) return setSwapErr(short); }
  await loadSwapBook();
  const r = walkSwap(swapSide === 'buy', amt, swapBook.bids, swapBook.asks);
  if (!r) return setSwapErr(t('swap.noLiq'));

  const takerBuys = swapSide === 'buy';
  const bd = Number(swapPair.baseDecimals ?? 18);
  const slip = swapSlipBps / 10000;

  const effPrice = takerBuys ? r.worst * (1 + slip) : r.worst * (1 - slip);
  const lim = alignPrice(effPrice, swapPair);

  const baseAmt = takerBuys ? r.base : amt;
  const qtyWei = parseUnits(baseAmt.toFixed(Math.min(bd, 8)), bd);

  const btn = $('swapSubmit'); const prev = btn.textContent;
  btn.disabled = true; btn.textContent = t('swap.submitting');
  try {
    const res = await executeTake(takerBuys, qtyWei, lim, effPrice, swapPair);
    if (!res.executed) return setSwapErr(res.reason === 'self' ? t('order.selfTrade') : t('swap.noLiq'));
    addSwapRecent({ ts: Date.now(), side: swapSide, pay: amt, paySym: takerBuys ? 'USDT' : (swapPair.baseSymbol || ''),
      get: takerBuys ? r.base : r.quote, getSym: takerBuys ? (swapPair.baseSymbol || '') : 'USDT', hash: res.hash || '' });
    $('swapPay').value = ''; if ($('swapGet')) $('swapGet').value = '';
    setSwapErr(t('swap.done'), true);
    swapPreview();
  } catch (e) {
    setSwapErr(txErrMsg(e, t('tx.failed')));
  } finally {
    btn.disabled = false; btn.textContent = swapSide === 'buy' ? t('swap.btnBuy') : t('swap.btnSell');
  }
}

const swapKey = () => `sordex.swaps.${(account || '').toLowerCase()}`;
function getSwapRecent() { try { return JSON.parse(localStorage.getItem(swapKey()) || '[]'); } catch { return []; } }
function addSwapRecent(x) {
  const a = [x, ...getSwapRecent()].slice(0, 5);
  try { localStorage.setItem(swapKey(), JSON.stringify(a)); } catch {}
  renderSwapRecent();
}
function renderSwapRecent() {
  const box = $('swapRecent'), el = $('swapRecentList'); if (!box || !el) return;
  const a = account ? getSwapRecent() : [];
  box.hidden = a.length === 0;
  el.innerHTML = a.map((x) => `<div class="sr-row">
    <span class="side-tag ${x.side}">${x.side === 'buy' ? t('swap.buy') : t('swap.sell')}</span>
    <span class="sr-amt">${_swapFmt(x.pay, 6)} ${esc(x.paySym)} → ${_swapFmt(x.get, 6)} ${esc(x.getSym)}</span>
    <span class="sr-t">${esc(fmtTime(x.ts))}</span>
    ${x.hash ? `<a class="sr-link" href="${esc(bscscanTx(x.hash))}" target="_blank" rel="noopener">${esc(short(x.hash))}</a>` : ''}
  </div>`).join('');
}

function setSwapErr(msg, ok) {
  const el = $('swapErr'); if (!el) return;
  el.textContent = msg || ''; el.hidden = !msg; el.className = 'swap-err' + (ok ? ' ok' : '');
}

function bindSwap() {
  if ($('swapToken')) $('swapToken').addEventListener('change', () => {
    swapPair = pairs.find((p) => p.pairId === $('swapToken').value) ?? swapPair;
    renderSwapSide(); setSwapErr(''); swapPreview();
  });
  if ($('swapPay')) $('swapPay').addEventListener('input', () => swapPreview());
  for (const b of document.querySelectorAll('#swapSideTabs button')) b.onclick = () => { swapSide = b.dataset.sside; renderSwapSide(); setSwapErr(''); swapPreview(); };
  for (const b of document.querySelectorAll('#swapSlip button')) b.onclick = () => { swapSlipBps = Number(b.dataset.slip); renderSwapSide(); swapPreview(); };
  if ($('swapFlip')) $('swapFlip').onclick = () => { swapSide = swapSide === 'buy' ? 'sell' : 'buy'; renderSwapSide(); setSwapErr(''); swapPreview(); };
  if ($('swapSubmit')) $('swapSubmit').onclick = () => doSwap();

  if ($('depthGroup')) $('depthGroup').addEventListener('change', (e) => {
    depthStep = Number(e.target.value);
    renderBook();
  });

  document.addEventListener('click', (e) => {
    const pm = e.target.closest('[data-poolmax]');
    if (pm) {
      const side = pm.dataset.poolmax;
      if (side === 'base' && $('poolBaseAmt')) { $('poolBaseAmt').value = floorFix(poolBal.base, Math.min(pool.decimals ?? 6, 8)); poolRecalc('base'); poolRenderPreview(); }
      else if (side === 'quote' && $('poolQuoteAmt')) { $('poolQuoteAmt').value = floorFix(poolBal.quote, 2); poolRecalc('quote'); poolRenderPreview(); }
      return;
    }
    if (e.target.closest('#swapMax') && $('swapPay')) {

      const fee = Number(swapPair?.takerFeeBps ?? 30) / 10000;
      $('swapPay').value = swapSide === 'buy' ? floorFix(swapPayBal / (1 + fee), 2) : floorFix(swapPayBal, 4);
      swapPreview();
    }
  });
}

const ROUTES = {
  home: 'viewHome', markets: 'viewMarkets', token: 'viewToken',
  trade: 'viewTrade', swap: 'viewSwap', pool: 'viewPool', mm: 'viewMM', referral: 'viewReferral', notfound: 'viewNotFound',
  account: 'viewAccount',
};
let view = 'home';
let marketDim = 'volume';
let pendingSide = null;
let tradeMktDim = 'volume';

function parseRoute() {
  const path = location.pathname || '/';
  const base = (path === '/m' || path.startsWith('/m/')) ? '/m' : '';
  const rest = base ? (path.slice(base.length) || '/') : path;
  const seg = rest.split('/').filter(Boolean);
  return { base, name: seg[0] || 'home', arg: seg[1] || null };
}

function pairSlug(pairId) {
  const p = pairs.find((x) => String(x.pairId) === String(pairId));
  return p?.base || String(pairId);
}

function pairIdFromSlug(slug) {
  if (!slug) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(slug)) {
    const p = pairs.find((x) => (x.base || '').toLowerCase() === slug.toLowerCase());
    return p ? String(p.pairId) : null;
  }
  return String(slug);
}

function navTo(path) {
  const { base } = parseRoute();

  path = String(path).replace(/^\/(trade|token)\/([^/?#]+)/, (m, v, slug) => (/^0x/i.test(slug) ? m : `/${v}/${pairSlug(slug)}`));
  history.pushState({}, '', (base && path[0] === '/') ? base + path : path);
  router();
}

async function router() {
  const { base, name, arg } = parseRoute();

  if (name === 'list') {
    history.replaceState({}, '', (base ? base : '') + '/pool');
    return router();
  }

  if (name === 'referral') {
    history.replaceState({}, '', (base ? base : '') + '/');
    return router();
  }

  let pid = null;
  if ((name === 'trade' || name === 'token') && arg) {
    pid = pairIdFromSlug(arg);
    if (pairs.length && pid && !/^0x/i.test(arg)) {
      const slug = pairSlug(pid);
      if (/^0x/i.test(slug)) history.replaceState({}, '', `${base || ''}/${name}/${slug}`);
    }
  }

  view = (ROUTES[name] && name !== 'notfound') ? name : 'notfound';
  document.body.className = document.body.className.replace(/\bv-[a-z]+\b/g, '').trim() + ' v-' + view;
  for (const [k, id] of Object.entries(ROUTES)) {
    const el = $(id); if (el) el.hidden = k !== view;
  }
  const navKey = view === 'token' ? 'markets' : view;
  for (const a of document.querySelectorAll('.nav a, .mnav a, .dw-menu a')) {
    a.classList.toggle('active', a.dataset.view === navKey);
  }

  const navEl = $('nav');
  if (navEl) navEl.classList.remove('open');
  closeDrawer();
  window.scrollTo({ top: 0 });
  if (view === 'home') renderHome();
  else if (view === 'markets') refreshMarkets();
  else if (view === 'token') { if (pairs.length || !arg) Promise.resolve(renderToken(pid)).finally(setTitle); }
  else if (view === 'trade') {
    if (arg) {
      if (pairs.length) {
        if ($('pairSel')) $('pairSel').value = pid;
        await selectPair(pid);
        if (curPair && $('pairSel')) $('pairSel').value = curPair.pairId;

        if (curPair && pairSlug(curPair.pairId).toLowerCase() !== String(arg).toLowerCase()) history.replaceState({}, '', `${base || ''}/trade/${pairSlug(curPair.pairId)}`);
      }
    }
    else if (!curPair && pairs.length) await selectPair(pairs[0].pairId);
    if (pendingSide) { const b = document.querySelector(`#sideTabs button[data-side="${pendingSide}"]`); pendingSide = null; if (b) b.click(); }
    syncTradeFav();

    applyChartCollapsed();
    requestAnimationFrame(() => drawChart());

    if (!_marketCache) { fetchMarketData().then(() => renderBook()); }
    else renderBook();

    if (account && curPair && !arg) { refreshBalances().catch(() => {}); refreshOrders(); refreshTrades(); }
  }
  else if (view === 'swap') initSwap();
  else if (view === 'pool') initPool(arg === 'mine' ? 'mine' : 'add');
  else if (view === 'account') initAccount();
  else if (view === 'mm') initMM();
  else if (view === 'referral') refreshReferral();
  setTitle();
}

const scrollToView = (v) => navTo('/' + (v === 'home' ? '' : v));

let _marketCache = null;
async function fetchMarketData() {
  const [tk, pr] = await Promise.all([
    fetch(api('/public/tickers')).then((r) => r.json()).catch(() => []),
    fetch(api('/pairs')).then((r) => r.json()).catch(() => []),
  ]);
  const byId = {};
  for (const p of pr) byId[String(p.pairId)] = p;

  const completeIds = new Set(visiblePairs(pr.filter((p) => p.listingComplete === true)).map((p) => String(p.pairId)));
  const rows = [];
  for (const tkr of tk) {
    if (!completeIds.has(String(tkr.pool_id))) continue;
    const p = byId[String(tkr.pool_id)] || {};
    rows.push({
      pairId: String(tkr.pool_id),
      sym: `${tkr.base_currency || '?'}/${tkr.target_currency || 'USDT'}`,
      baseSym: tkr.base_currency || '?',
      logo: p.logo || null, displayName: p.displayName || null,
      price: Number(tkr.last_price) || 0,
      changePct: tkr.price_change_ready === false ? null : (Number(tkr.price_change_percent) || 0),
      high: Number(tkr.high) || 0, low: Number(tkr.low) || 0,
      vol: Number(tkr.target_volume) || 0,
      feeBps: p.takerFeeBps ?? 10, openOrders: Number(p.openOrders ?? 0),
      isOpen: p.isOpen !== false, openTime: Number(p.openTime ?? 0),
    });
  }
  if (!rows.length && pr.length) {
    for (const p of pr) { if (!completeIds.has(String(p.pairId))) continue; rows.push({
      pairId: String(p.pairId), sym: `${p.baseSymbol || '?'}/${p.quoteSymbol || 'USDT'}`, baseSym: p.baseSymbol || '?',
      logo: p.logo || null, displayName: p.displayName || null, price: 0, changePct: null, vol: 0,
      feeBps: p.takerFeeBps ?? 10, openOrders: Number(p.openOrders ?? 0), isOpen: p.isOpen !== false, openTime: Number(p.openTime ?? 0),
    }); }
  }
  _marketCache = rows;
  return rows;
}

let mktSort = null;
function sortMarket(rows, dim) {
  let a = rows.slice();
  if (dim === 'fav') { const f = getFavs(); a = a.filter((r) => f.has(String(r.pairId))); dim = 'volume'; }
  if (dim === 'gainers') a.sort((x, y) => (y.changePct ?? -Infinity) - (x.changePct ?? -Infinity));
  else if (dim === 'new') a.sort((x, y) => Number(y.pairId) - Number(x.pairId));
  else if (dim === 'all') a.sort((x, y) => Number(x.pairId) - Number(y.pairId));
  else a.sort((x, y) => y.vol - x.vol);
  return a;
}
function applyMktSort(rows) {
  if (!mktSort) return rows;
  const k = mktSort.key, d = mktSort.dir;
  return rows.slice().sort((x, y) => ((x[k] ?? -Infinity) - (y[k] ?? -Infinity)) * d);
}

function logoHtml(row) {
  const letter = esc((row.baseSym || '?').slice(0, 1).toUpperCase());
  const img = row.logo
    ? `<img class="mk-logo" src="${esc(row.logo)}" referrerpolicy="no-referrer" loading="lazy" data-logo-fb="1">`
    : '';
  return `${img}<span class="mk-logo mk-logo-fb"${row.logo ? ' style="display:none"' : ''}>${letter}</span>`;
}

document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.logoFb) return;
  img.style.display = 'none';
  const fb = img.nextElementSibling;
  if (fb) fb.style.display = 'inline-flex';
}, true);

function renderMarketRows(rows, tbodyId) {
  const tb = $(tbodyId);
  if (!tb) return;

  tb.innerHTML = rows.map((r) => {
    const { txt: chg, cls: chgCls } = chgView(r.changePct);
    const [base, quote] = r.sym.split('/');
    const soon = r.isOpen ? '' : ` <span class="mk-soon">${esc(t('mkt.notOpen'))}</span>`;
    return `<tr data-token="${esc(r.pairId)}">
      <td class="m-pc">${logoHtml(r)}<span class="m-pn"><span><b>${esc(base)}</b><i>/${esc(quote || 'USDT')}</i>${soon}</span><em>Vol ${fmtCompact(r.vol)}</em></span></td>
      <td class="m-px">${fmtPx(r.price)}</td>
      <td class="m-chgc"><span class="m-chg ${chgCls}">${chg}</span></td>
      <td class="m-vol">${fmt(r.vol, 2)} USDT</td>
      <td class="m-trend">${sparkSlot(r.pairId)}</td>
      <td class="m-fee">${(r.feeBps / 100).toFixed(2)}%</td>
      <td class="m-act"><button class="m-trade" data-trade="${esc(r.pairId)}">${esc(t('nav.trade'))}</button></td>
    </tr>`;
  }).join('');
  for (const row of tb.querySelectorAll('tr[data-token]')) {
    row.onclick = (e) => {
      const tbtn = e.target.closest('[data-trade]');
      if (tbtn) { navTo('/trade/' + tbtn.dataset.trade); return; }
      navPair(row.dataset.token);
    };
  }
  fillSparks(tb, rows);
}

const _sparkCache = new Map();

function sparkSlot(pairId) {
  const s = _sparkCache.get(String(pairId));
  if (!s || s.length < 2) return '<span class="mk-spark-ph">-</span>';
  return sparkSvg(s);
}

function sparkSvg(series) {
  const w = 70, h = 24, pad = 2;
  const lo = Math.min(...series), hi = Math.max(...series);
  const span = hi - lo || 1;
  const x = (i) => pad + (i / (series.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - lo) / span) * (h - pad * 2);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = series[series.length - 1] >= series[0];
  const color = up ? 'var(--buy)' : 'var(--sell)';
  return `<svg class="mk-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

async function fillSparks(tbody, rows) {
  const todo = rows.slice(0, 10).filter((r) => !_sparkCache.has(String(r.pairId)));
  for (const r of rows.slice(0, 10)) {
    const td = tbody.querySelector(`tr[data-token="${r.pairId}"] td .mk-spark-ph, tr[data-token="${r.pairId}"] td .mk-spark`);
    if (td && _sparkCache.has(String(r.pairId))) td.outerHTML = sparkSlot(r.pairId);
  }
  for (const r of todo) {
    try {
      const res = await fetch(`${CONFIG.apiBase}/candles?pairId=${r.pairId}&limit=30&bucketBlocks=120`);
      const j = await res.json();
      const series = (j.candles ?? []).map((k) => Number(k.c)).filter((v) => Number.isFinite(v));
      _sparkCache.set(String(r.pairId), series);
      const cell = tbody.querySelector(`tr[data-token="${r.pairId}"] .mk-spark-ph`);
      if (cell) cell.outerHTML = sparkSlot(r.pairId);
    } catch {
      _sparkCache.set(String(r.pairId), []);
    }
  }
}

let homeDim = 'volume';
async function renderHome() {
  const all = await fetchMarketData();
  renderHomeList(all);
  const hr = $('homeRecommend'); if (hr) hr.hidden = all.length === 0;
  refreshHomeStats();
  renderHeroCard(sortMarket(all, 'volume')[0]);
}

function renderHomeList(all) {
  const el = $('homeMarketsBody'); if (!el) return;
  const rows = sortMarket(all, 'volume').slice(0, 5);
  el.innerHTML = rows.map((r) => {
    const { txt, cls } = chgView(r.changePct);
    const [base, quote] = r.sym.split('/');
    return `<div class="h-tr" data-token="${esc(r.pairId)}">
      <span class="h-pc">${logoHtml(r)}<span class="h-pn"><b>${esc(base)}</b><i>/${esc(quote || 'USDT')}</i></span></span>
      <span class="h-px">${fmtPx(r.price)}</span>
      <span><span class="h-chg ${cls}">${txt}</span></span>
      <span class="h-act"><button class="h-trade" data-trade="${esc(r.pairId)}">${esc(t('nav.trade'))}</button></span>
    </div>`;
  }).join('');
  const e = $('homeMarketsEmpty'); if (e) e.classList.toggle('hide', rows.length > 0);
  for (const row of el.querySelectorAll('[data-token]')) row.onclick = (ev) => {
    const b = ev.target.closest('[data-trade]');
    if (b) { navTo('/trade/' + b.dataset.trade); return; }
    navPair(row.dataset.token);
  };
}

async function renderHeroCard(r) {
  const card = $('heroCard'); if (!card) return;
  if (!r) { card.hidden = true; return; }
  try {
    const [bk, cd] = await Promise.all([
      fetch(api(`/mixed-book?pairId=${r.pairId}`)).then((x) => x.json()),
      fetch(`${CONFIG.apiBase}/candles?pairId=${r.pairId}&limit=40&bucketBlocks=120`).then((x) => x.json()).catch(() => ({ candles: [] })),
    ]);
    const p = pairById(r.pairId);
    const dp = p ? priceDp(p) : 6;
    const asks = (bk.asks || []).slice(0, 4), bids = (bk.bids || []).slice(0, 4);
    const maxQ = Math.max(1e-12, ...[...asks, ...bids].map((l) => l.qty));
    const row = (l, side) => `<div class="ht-row ${side}"><i style="width:${Math.min(100, l.qty / maxQ * 100)}%"></i><span>${fmt(l.price, dp)}</span><span>${fmtQty(l.qty)}</span><span>${fmtQty(l.price * l.qty)}</span></div>`;
    $('hcAsks').innerHTML = asks.slice().reverse().map((l) => row(l, 'ask')).join('');
    $('hcBids').innerHTML = bids.map((l) => row(l, 'bid')).join('');
    card.querySelector('.ht-book')?.toggleAttribute('hidden', !asks.length && !bids.length);
    const mid = asks[0] && bids[0] ? (asks[0].price + bids[0].price) / 2 : (asks[0]?.price || bids[0]?.price || r.price);
    $('hcMid').innerHTML = `<b>${fmt(mid, dp + 1)}</b>` + (asks[0] && bids[0] ? `<span>${t('ticker.spread')} ${fmt(asks[0].price - bids[0].price, dp)}</span>` : '');
    const [b] = r.sym.split('/');
    $('hcSym').textContent = r.sym; $('hcSub').textContent = r.sym.replace('/', ' / ');
    $('hcLogo').innerHTML = logoHtml(r);
    $('hcPrice').textContent = fmt(mid, dp + 1);
    const cv = chgView(r.changePct); $('hcChg').textContent = cv.txt; $('hcChg').className = 'ht-chg ' + cv.cls;
    for (const el of card.querySelectorAll('.bsymh')) el.textContent = b;
    const series = (cd.candles || []).map((k) => Number(k.c)).filter(Number.isFinite);
    $('hcSpark').innerHTML = series.length >= 2 ? areaSvg(series) : '';
    $('hcSpark').hidden = series.length < 2;
    $('hcBuy').textContent = `${t('order.buy')} ${b}`; $('hcSell').textContent = `${t('order.sell')} ${b}`;
    $('hcBuy').onclick = () => { pendingSide = 'buy'; navTo('/trade/' + r.pairId); };
    $('hcSell').onclick = () => { pendingSide = 'sell'; navTo('/trade/' + r.pairId); };
    card.hidden = false;
  } catch { card.hidden = true; }
}

function areaSvg(series) {
  const w = 300, h = 70, pad = 3;
  const lo = Math.min(...series), hi = Math.max(...series), span = hi - lo || 1;
  const x = (i) => (i / (series.length - 1)) * w;
  const y = (v) => h - pad - ((v - lo) / span) * (h - pad * 2);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="hc-area"><defs><linearGradient id="hcf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0cc595" stop-opacity=".28"/><stop offset="1" stop-color="#0cc595" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,${h} ${pts} ${w},${h}" fill="url(#hcf)"/><polyline points="${pts}" fill="none" stroke="#0cc595" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

function fmtUsd(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(a < 1 ? 2 : 0)}`;
}

async function refreshHomeStats() {

  try {
    const j = await fetch(api('/public/stats')).then((r) => r.json());
    if ($('statTvl')) $('statTvl').textContent = fmtUsd(j.tvl);
    if ($('statVol')) $('statVol').textContent = fmtUsd(j.volume24h);
    if ($('statPairs')) $('statPairs').textContent = String(j.pairs ?? '-');
  } catch {
    for (const id of ['statTvl', 'statVol', 'statPairs']) if ($(id)) $(id).textContent = '-';
  }
}

async function renderToken(pairId) {
  if (!pairId) { navTo('/markets'); return; }
  await selectPair(pairId);
  if (!curPair) return;
  const data = (_marketCache || await fetchMarketData()).find((r) => r.pairId === String(pairId)) || {};
  $('tkLogo').innerHTML = logoHtml({ baseSym: curPair.baseSymbol, logo: data.logo });
  $('tkSym').textContent = `${curPair.baseSymbol || '?'}/${curPair.quoteSymbol || 'USDT'}`;
  $('tkName').textContent = `${curPair.baseSymbol || '?'} / ${curPair.quoteSymbol || 'USDT'}` + (data.displayName && data.displayName !== curPair.baseSymbol ? ` · ${data.displayName}` : '');
  if ($('tkFav')) { $('tkFav').classList.toggle('on', getFavs().has(String(pairId))); $('tkFav').onclick = () => $('tkFav').classList.toggle('on', toggleFav(pairId)); }
  const price = data.price || trades[0]?.price || 0;
  $('tkPrice').textContent = price ? fmt(price, priceDp() + 1) : '-';
  const chgEl = $('tkChg');
  { const cv = chgView(data.changePct); chgEl.textContent = cv.txt; chgEl.className = 'pd-chg ' + cv.cls; }
  drawChart('tkChart', 'tkLegend');
  renderTkTrades();

  let hi = -Infinity, lo = Infinity;
  for (const k of candles) { hi = Math.max(hi, k.h); lo = Math.min(lo, k.l); }
  if ($('tkHigh')) $('tkHigh').textContent = data.high ? fmt(data.high, priceDp()) : (candles.length ? fmt(hi, priceDp()) : '-');
  if ($('tkLow')) $('tkLow').textContent = data.low ? fmt(data.low, priceDp()) : (candles.length ? fmt(lo, priceDp()) : '-');
  if ($('tkVol')) $('tkVol').textContent = `${Number(data.vol || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
  if ($('tkTrades')) { const since = Date.now() - 86_400_000; $('tkTrades').textContent = String(trades.filter((x) => x.ts && x.ts >= since).length); }
  if ($('tkTrades')) $('tkTrades').textContent = String(trades.length || 0);

  const taker = ((curPair.takerFeeBps ?? 10) / 100).toFixed(2) + '%';
  const maker = ((curPair.makerFeeBps ?? 10) / 100).toFixed(2) + '%';

  const xfer = curPair.taxProbed ? (curPair.baseTransferTaxBps || 0) : 0;
  const effB = (curPair.sdxBuyBps || 0) + xfer, effS = (curPair.sdxSellBps || 0) + xfer;
  const tax = (effB || effS)
    ? `${t('order.buy')} ${(effB / 100).toFixed(2)}% / ${t('order.sell')} ${(effS / 100).toFixed(2)}%`
    : (curPair.taxProbed ? t('tax.none') : t('swap.taxUnknown'));
  const openTxt = data.openTime && data.openTime * 1000 > Date.now()
    ? new Date(data.openTime * 1000).toLocaleString()
    : (data.openTime ? new Date(data.openTime * 1000).toLocaleString() : t('tk.openNow'));
  const dec = curPair.baseDecimals ?? (typeof decimalsBase !== 'undefined' ? decimalsBase : null);
  const rows = [
    [t('tk.base'), esc(curPair.baseSymbol || '?')],
    [t('tk.quote'), 'USDT'],
    [t('tk.contract'), `<span class="mono">${esc(short(curPair.base))}</span><button class="pd-copy" data-copy="${esc(curPair.base)}" title="${esc(t('wallet.copy'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg></button>`],
    [t('tk.decimals'), dec != null ? `<span class="mono">${dec}</span>` : '-'],
    [t('tk.takerFee'), taker],
    [t('tk.makerFee'), maker],
    [t('tk.projTax'), esc(tax)],
    [t('tk.opened'), esc(openTxt)],
  ];
  $('tkInfo').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('');
  const copyBtn = $('tkInfo').querySelector('.pd-copy');
  if (copyBtn) copyBtn.onclick = async () => { if (await copyText(copyBtn.dataset.copy)) toast(t('wallet.copied'), 'ok', 1400); };

  const links = [];
  if (data.website) links.push([t('tk.website'), data.website]);
  const tg = data.contactTg || data.telegram;
  if (tg) links.push([t('tk.telegram'), tg.startsWith('http') ? tg : `https://t.me/${tg.replace(/^@/, '')}`]);
  links.push([t('tk.explorer'), `https://bscscan.com/token/${curPair.base}`]);
  if ($('tkLinks')) $('tkLinks').innerHTML = links.map(([k, u]) => `<a class="pd-link" href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 5h5v5M19 5l-8 8M19 13v6H5V5h6"/></svg></a>`).join('');

  $('tkTradeBtn').onclick = () => navTo('/trade/' + pairId);
  if ($('tkBuy')) $('tkBuy').onclick = () => { pendingSide = 'buy'; navTo('/trade/' + pairId); };
  if ($('tkSell')) $('tkSell').onclick = () => { pendingSide = 'sell'; navTo('/trade/' + pairId); };
}

async function refreshMarkets() {
  const all = await fetchMarketData();
  renderMktCards(all);
  const q = ($('mktSearch')?.value || '').trim().toLowerCase();
  let rows = applyMktSort(sortMarket(all, marketDim));
  if (q) rows = rows.filter((r) => r.sym.toLowerCase().includes(q) || (r.baseSym || '').toLowerCase().includes(q));
  renderMarketRows(rows, 'marketsBody', false);
  const empty = $('marketsEmpty');
  if (empty) { empty.classList.toggle('hide', rows.length > 0); empty.textContent = marketDim === 'fav' ? t('mkt.favEmpty') : t('mkt.empty'); }
  for (const th of document.querySelectorAll('#marketsTable th.sortable')) {
    th.classList.toggle('asc', mktSort?.key === th.dataset.sort && mktSort.dir === 1);
    th.classList.toggle('desc', mktSort?.key === th.dataset.sort && mktSort.dir === -1);
  }
  const meta = $('mktMeta'); if (meta) meta.textContent = t('mkt.metaVal').replace('{n}', String(all.length));
  for (const b of document.querySelectorAll('#mktDims button')) b.classList.toggle('on', b.dataset.dim === marketDim);
}

function renderMktCards(all) {
  const card = (id, rows) => {
    const el = $(id); if (!el) return;
    el.innerHTML = rows.map((r) => {
      const { txt: chg, cls } = chgView(r.changePct);
      const [base, quote] = r.sym.split('/');
      return `<div class="m-hr" data-token="${esc(r.pairId)}">
        <span class="m-hn"><b>${esc(base)}</b><i>/${esc(quote || 'USDT')}</i></span>
        <span class="m-hp">${fmtPx(r.price)}</span>
        <span class="m-hchg ${cls}">${chg}</span>
      </div>`;
    }).join('') || `<div class="m-hr-empty">-</div>`;
    for (const row of el.querySelectorAll('[data-token]')) row.onclick = () => navPair(row.dataset.token);
  };
  card('mktCardVol', sortMarket(all, 'volume').slice(0, 3));
  card('mktCardGain', sortMarket(all, 'gainers').slice(0, 3));
  card('mktCardNew', sortMarket(all, 'new').slice(0, 3));
}

async function renderTradeMkts() {
  const el = $('tradeMktBody'); if (!el) return;
  const all = _marketCache || await fetchMarketData();
  const rows = sortMarket(all, tradeMktDim).slice(0, 12);
  el.innerHTML = rows.map((r) => {
    const cv = chgView(r.changePct);
    const [b, q] = r.sym.split('/');
    return `<div class="t-mk-row${curPair && String(curPair.pairId) === String(r.pairId) ? ' on' : ''}" data-token="${esc(r.pairId)}">
      <span><b>${esc(b)}</b><i>/${esc(q || 'USDT')}</i></span><span class="mono">${fmtPx(r.price)}</span><span class="mono ${cv.cls}">${cv.txt}</span></div>`;
  }).join('') || `<p class="t-empty">${esc(t('mkt.empty'))}</p>`;
  for (const row of el.querySelectorAll('[data-token]')) row.onclick = () => navTo('/trade/' + row.dataset.token);
}

async function refreshReferral() {

  return;
  $('refAddr').textContent = account ? short(account) : '-';
  if (!account) {
    $('refClaimable').textContent = '-';
    return;
  }
  try {

    const amount = await pub.readContract({
      address: CONFIG.feeVault,
      abi: parseAbi(['function claimable(address,address) view returns (uint256)']),
      functionName: 'claimable',
      args: [account, curPair?.quote ?? '0x0000000000000000000000000000000000000000'],
    });
    $('refClaimable').textContent = `${fmt(Number(amount) / 10 ** (curPair?.quoteDecimals ?? 18), 6)}`;
  } catch {
    $('refClaimable').textContent = '-';
  }
}

const mmAccessTypes = {
  EIP712Domain: [
    { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
  ],
  MMAccess: [
    { name: 'maker', type: 'address' }, { name: 'action', type: 'string' },
    { name: 'label', type: 'string' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
  ],
};
const AGENT_TTL_DAYS = 30;

const POOL_BAND_FACTOR = 3;

function priceToFraction(price, baseDec, quoteDec) {
  const p = Number(price);
  if (!(p > 0) || !Number.isFinite(p)) return null;
  const [mant, exp] = p.toExponential(5).split('e');
  let num = BigInt(mant.replace('.', ''));
  let e = Number(exp) - 5 + (quoteDec - baseDec);
  let den = 1n;
  if (e >= 0) num *= 10n ** BigInt(e); else den *= 10n ** BigInt(-e);
  if (num <= 0n) return null;
  return { num, den };
}
let mmBotAgent = null;
async function fetchBotAgent() {
  if (mmBotAgent !== null) return mmBotAgent;
  try {
    const j = await fetch(`${CONFIG.apiBase}/mm/agent`).then((r) => r.json());
    mmBotAgent = j && j.enabled ? j.agent : '';
  } catch { mmBotAgent = ''; }
  return mmBotAgent;
}

function syncTradeFav() {
  const b = $('tradeFav'); if (b && curPair) b.classList.toggle('on', getFavs().has(String(curPair.pairId)));
}

let ppDim = 'all';
function renderTradePicker(filter = '') {
  const list = $('tradePairList'); if (!list) return;
  const q = (filter || '').trim().toLowerCase();
  const favs = getFavs();
  const items = visiblePairs((pairs || []).filter((p) => p.listingComplete !== false), curPair && curPair.pairId).filter((p) => ppDim !== 'fav' || favs.has(String(p.pairId))).filter((p) => !q
    || (p.baseSymbol || '').toLowerCase().includes(q)
    || (p.quoteSymbol || '').toLowerCase().includes(q)
    || String(p.pairId) === q);
  for (const b of document.querySelectorAll('#ppDims button')) b.classList.toggle('on', b.dataset.ppdim === ppDim);
  if (!items.length) { list.innerHTML = `<div class="pp-empty">${esc(ppDim === 'fav' ? t('mkt.favEmpty') : t('wallet.noResult'))}</div>`; return; }
  list.innerHTML = items.map((p) => {
    const m = (_marketCache || []).find((r) => String(r.pairId) === String(p.pairId));
    const px = m ? fmtPx(m.price) : '';
    const cv = chgView(m?.changePct);
    return `<div class="pp-item${curPair && String(curPair.pairId) === String(p.pairId) ? ' on' : ''}" data-pid="${esc(p.pairId)}">
      <span class="pp-sym">${favs.has(String(p.pairId)) ? '<i class="pp-fav"></i>' : ''}<b>${esc(p.baseSymbol || '?')}</b><i>/${esc(p.quoteSymbol || 'USDT')}</i></span>
      <span class="pp-px">${esc(px)}</span><span class="pp-chg ${cv.cls}">${cv.txt}</span></div>`;
  }).join('');
  for (const it of list.querySelectorAll('.pp-item')) {
    it.onclick = () => { closeTradePicker(); navTo('/trade/' + it.dataset.pid); };
  }
}
function openTradePicker() {
  const pk = $('tradePairPicker'); if (!pk) return;
  renderTradePicker('');
  const s = $('tradePairSearch'); if (s) s.value = '';
  pk.hidden = false;
  if (s) setTimeout(() => s.focus(), 30);
}
function closeTradePicker() { const pk = $('tradePairPicker'); if (pk) pk.hidden = true; }

let mmMode = 'hosted';
async function signMMAction(primaryType, pairId, params, deadline, nonce) {
  const domain = { name: 'SorDexHostedMM', version: '1', chainId: CONFIG.chainId, verifyingContract: CONFIG.settler };
  let typeFields, message;
  if (primaryType === 'MMSubscribe') {
    typeFields = [
      { name: 'maker', type: 'address' }, { name: 'pairId', type: 'uint256' },
      { name: 'priceSource', type: 'string' }, { name: 'fixedPriceE8', type: 'uint256' },
      { name: 'binanceSymbol', type: 'string' }, { name: 'levels', type: 'uint256' },
      { name: 'halfSpreadBps', type: 'uint256' }, { name: 'rangeWidthBps', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
    ];
    message = {
      maker: account, pairId: String(pairId),
      priceSource: String(params.priceSource || ''),
      fixedPriceE8: String(Math.round(Math.max(0, Number(params.fixedPrice || 0)) * 1e8)),
      binanceSymbol: String(params.binanceSymbol || ''),
      levels: String(Math.floor(Number(params.levels || 0))),
      halfSpreadBps: String(Math.floor(Number(params.halfSpreadBps || 0))),
      rangeWidthBps: String(Math.floor(Number(params.rangeWidthBps || 0))),
      deadline: String(deadline), nonce: String(nonce),
    };
  } else {
    typeFields = [
      { name: 'maker', type: 'address' }, { name: 'pairId', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
    ];
    message = { maker: account, pairId: String(pairId || '0'), deadline: String(deadline), nonce: String(nonce) };
  }
  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
      ],
      [primaryType]: typeFields,
    },
    domain, primaryType, message,
  };
  return await window.ethereum.request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify(typedData)] });
}

const wiz = { step: 1, token: '', name: '', symbol: '', decimals: 18, logo: '', openDelaySec: 600, pairId: null };
let _usdtDec = null;

async function usdtDecimals() {
  if (_usdtDec != null) return _usdtDec;
  _usdtDec = 18;
  try {
    _usdtDec = Number(await pub.readContract({ address: CONFIG.quoteToken, abi: erc20Abi, functionName: 'decimals' }));
  } catch {}
  return _usdtDec;
}

function priceTickDecimals(priceStr) {
  const p = Number(priceStr);
  if (!(p > 0)) return 2;
  return Math.min(8, Math.max(0, 4 - Math.floor(Math.log10(p))));
}

function rawTick(tickDecimals, baseDec, quoteDec) {
  const shift = Number(quoteDec) - Number(baseDec);
  let tickNum = 10n ** BigInt(Math.max(0, shift));
  let tickDen = 10n ** BigInt(tickDecimals + Math.max(0, -shift));
  const g = (a, b) => (b === 0n ? a : g(b, a % b));
  const d = g(tickNum, tickDen);
  return { tickNum: tickNum / d, tickDen: tickDen / d };
}

const clamp3 = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

function strat3(V, minNotional) {
  const safeV = V > 0 ? V : 0;
  const safeMin = minNotional > 0 ? minNotional : 1;
  const Vs = safeV / 2;
  const lg = safeV > 0 ? Math.log10(safeV / 1000) : -Infinity;
  const nBase = clamp3(Math.round(5 + 5 * lg), 3, 20);
  const nDepth = Math.floor(Vs / safeMin);
  const levels = clamp3(Math.min(nBase, nDepth), 0, 20);
  const tooThin = levels < 3;
  const rangeWidthBps = clamp3(300 * (1 + 0.5 * lg), 300, 800);
  return { levels, rangeWidthBps, baseHalfSpreadBps: 30, tooThin };
}

const pool = { token: '', name: '', symbol: '', decimals: 18, logo: '', mode: 'create', mid: 0, minNotional: 0.001 };

function setPoolTab(name) {
  for (const b of document.querySelectorAll('.pool-tab')) b.classList.toggle('on', b.dataset.pooltab === name);
  for (const p of document.querySelectorAll('.pool-pane')) p.classList.toggle('hide', p.dataset.poolPane !== name);
  if (name === 'mine') renderMyPools();
}

async function signMmKeyAction(maker, action, ips, deadline, nonce) {
  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
      ],
      MMAccess: [
        { name: 'maker', type: 'address' }, { name: 'action', type: 'string' },
        { name: 'ips', type: 'string' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
      ],
    },
    domain: { name: 'SorDexMMAccess', version: '1', chainId: CONFIG.chainId, verifyingContract: CONFIG.settler },
    primaryType: 'MMAccess',
    message: { maker, action, ips, deadline: String(deadline), nonce: String(nonce) },
  };
  return await window.ethereum.request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify(typedData)] });
}

function mmxReadIps() {
  return ($('mmxIps').value || '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

async function initMM() {
  const connectHint = $('mmxConnectHint'), form = $('mmxForm');
  if (!connectHint || !form) return;
  if (!account) { connectHint.classList.remove('hide'); form.classList.add('hide'); return; }
  connectHint.classList.add('hide'); form.classList.remove('hide');
  if (!$('mmxMaker').value) $('mmxMaker').value = account;
  await mmxDetectVault();
  await mmxLoadStatus();
}

async function mmxDetectVault() {
  const tip = $('mmxMakerTip'); if (!tip) return;
  const maker = ($('mmxMaker').value || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(maker)) { tip.textContent = ''; return; }
  try {
    const code = await pub.getBytecode({ address: maker });
    if (code && code !== '0x') tip.textContent = t('mmx.tipContract');
    else tip.textContent = maker.toLowerCase() === (account || '').toLowerCase() ? t('mmx.tipEoaSelf') : t('mmx.tipEoaOther');
  } catch { tip.textContent = ''; }
}

async function mmxLoadStatus() {
  const maker = ($('mmxMaker').value || '').trim();
  const manage = $('mmxManage');
  if (!/^0x[0-9a-fA-F]{40}$/.test(maker) || !manage) { if (manage) manage.classList.add('hide'); return; }
  try {
    const j = await fetch(api(`/mm/key-status?maker=${maker}`)).then((r) => r.json());
    if (j && j.hasKey && j.status === 'active') {
      manage.classList.remove('hide');
      $('mmxCurStatus').textContent = t('mmx.stActive');

      if (Array.isArray(j.allowedIps)) {
        $('mmxCurIps').textContent = j.allowedIps.join(', ') || '-';
        if (!$('mmxIps').value) $('mmxIps').value = j.allowedIps.join('\n');
      } else {
        $('mmxCurIps').textContent = t('mmx.ipsHidden');
      }
    } else {
      manage.classList.add('hide');
    }
  } catch { manage.classList.add('hide'); }
}

async function mmxFillMyIp() {
  try {

    const ip = (await (await fetch(api('/myip'))).json()).ip;
    if (ip && !mmxReadIps().includes(ip)) {
      const cur = $('mmxIps').value.trim();
      $('mmxIps').value = cur ? cur + '\n' + ip : ip;
    }
  } catch { const s = $('mmxStatus'); if (s) { s.style.color = 'var(--sell)'; s.textContent = t('mmx.myipFail'); } }
}

async function mmxIssue() {
  const err = $('mmxErr'), status = $('mmxStatus'), result = $('mmxKeyResult');
  err.textContent = ''; status.textContent = ''; result.classList.add('hide');
  if (!account || !window.ethereum) { err.textContent = t('mmx.needWallet'); return; }
  const maker = ($('mmxMaker').value || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(maker)) { err.textContent = t('mmx.badMaker'); return; }
  const ips = mmxReadIps();
  if (ips.length === 0) { err.textContent = t('mmx.needIp'); return; }
  try {
    status.style.color = 'var(--muted)'; status.textContent = t('mmx.signing');
    await ensureChainClock();
    const deadline = Math.floor(chainNow()) + 600;
    const nonce = String(Date.now());
    const sig = await signMmKeyAction(maker, 'issue', ips.join(';'), deadline, nonce);
    status.textContent = t('mmx.submitting');
    const r = await fetch(api('/mm/issue'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maker, ips, label: ($('mmxName').value || '').trim(), contactEmail: ($('mmxEmail').value || '').trim(), signature: sig, deadline, nonce }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { status.textContent = ''; err.textContent = mmxErrMsg(r.status, j); return; }
    status.style.color = 'var(--buy)'; status.textContent = t('mmx.issued');
    $('mmxKeyValue').textContent = j.apiKey || '';
    result.classList.remove('hide');
    await mmxLoadStatus();
  } catch (e) { status.textContent = ''; err.textContent = txErrMsg(e, t('mmx.issueFail')); }
}

async function mmxUpdateIps() {
  const err = $('mmxErr'), status = $('mmxStatus');
  err.textContent = ''; status.textContent = '';
  if (!account || !window.ethereum) { err.textContent = t('mmx.needWallet'); return; }
  const maker = ($('mmxMaker').value || '').trim();
  const ips = mmxReadIps();
  if (ips.length === 0) { err.textContent = t('mmx.needIp'); return; }
  try {
    status.style.color = 'var(--muted)'; status.textContent = t('mmx.signing');
    await ensureChainClock();
    const deadline = Math.floor(chainNow()) + 600;
    const nonce = String(Date.now());
    const sig = await signMmKeyAction(maker, 'update-ip', ips.join(';'), deadline, nonce);
    status.textContent = t('mmx.submitting');
    const r = await fetch(api('/mm/update-ips'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maker, ips, signature: sig, deadline, nonce }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { status.textContent = ''; err.textContent = mmxErrMsg(r.status, j); return; }
    status.style.color = 'var(--buy)'; status.textContent = t('mmx.ipUpdated');
    await mmxLoadStatus();
  } catch (e) { status.textContent = ''; err.textContent = txErrMsg(e, t('mmx.issueFail')); }
}

async function initPool(tab = 'add') {
  setPoolTab(tab);
  if (pool.token) { try { await poolRefreshVault(); } catch {} poolRecalc('base'); poolRenderPreview(); }
}

async function poolDetect() {
  const err = $('poolErr1');
  err.style.color = 'var(--sell)'; err.textContent = '';
  const raw = ($('poolToken').value || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) { err.textContent = t('pool.badAddr'); return; }
  err.style.color = 'var(--muted)'; err.textContent = t('pool.detecting');
  try {
    const r = await (await fetch(api(`/token-meta?token=${raw}`))).json();
    if (r.error) { err.style.color = 'var(--sell)'; err.textContent = t('pool.detectFail'); return; }
    pool.token = raw;
    pool.symbol = r.symbol || raw.slice(0, 6);
    pool.decimals = r.decimals ?? 18;
    pool.name = r.name || pool.symbol;
    $('poolName').value = pool.name;
    $('poolSymbol').textContent = pool.symbol;
    $('poolDecimals').value = String(pool.decimals);
    { const bc = $('poolBaseCur'); if (bc) bc.textContent = pool.symbol; }
    poolSetLogo(r.logoCandidates || [], raw);
    $('poolMetaBox').classList.remove('hide');
    err.textContent = '';

    pool.mode = 'create'; pool.mid = 0; pool.minNotional = 0.001; pool.priceFixed = false; pool.ref = null;
    const hint = $('poolModeHint');
    try {
      const list = await (await fetch(api('/pairs'))).json();
      const ex = Array.isArray(list) ? list.find((p) => (p.base || '').toLowerCase() === raw.toLowerCase()) : null;
      if (ex) {
        pool.mode = 'add';
        const qd = Number(ex.quoteDecimals ?? 18);
        if (ex.minNotional) pool.minNotional = Number(ex.minNotional) / 10 ** qd;

        pool.ref = await pairRefPrices(ex.pairId);
        pool.mid = pool.ref.book || pool.ref.trade || 0;
        pool.priceFixed = pool.mid > 0;
        if (hint) hint.textContent = (ex.listingComplete === false) ? t('pool.tagResume') : (pool.priceFixed ? t('pool.tagAdd') : t('pool.tagNew'));
      } else if (hint) { hint.textContent = t('pool.tagNew'); }
    } catch {}
    $('poolAmountBox').classList.remove('hide');
    await poolRefreshVault();
    poolRecalc('base'); poolRenderPreview();
  } catch (e) {
    err.style.color = 'var(--sell)'; err.textContent = t('pool.detectFail');
  }
}

function poolSetLogo(candidates, token) {
  const img = $('poolLogoImg');
  const list = candidates.slice();
  const tryNext = () => {
    const url = list.shift();
    if (!url) { img.onerror = null; img.onload = null; img.removeAttribute('src'); img.classList.add('hide'); pool.logo = ''; $('poolLogo').value = ''; return; }
    img.onerror = tryNext;
    img.onload = () => { img.onerror = null; pool.logo = url; $('poolLogo').value = url; img.classList.remove('hide'); };
    img.src = url;
  };
  tryNext();
}

let poolBal = { base: 0, quote: 0 };

async function poolRefreshVault() {
  const vb = $('poolVaultBase'), vq = $('poolVaultQuote');
  if (!vb || !vq) return;
  poolBal = { base: 0, quote: 0, loaded: false };
  if (!account || !pool.token || !CONFIG.quoteToken) { vb.innerHTML = ''; vq.innerHTML = ''; return; }
  try {
    const qDec = await usdtDecimals();
    const [b, q] = await Promise.all([
      pub.readContract({ address: pool.token, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      pub.readContract({ address: CONFIG.quoteToken, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    ]);
    poolBal.base = Number(b) / 10 ** pool.decimals;
    poolBal.quote = Number(q) / 10 ** qDec;
    poolBal.loaded = true;
    vb.innerHTML = `${esc(t('pool.bal').replace('{n}', fmt(poolBal.base, 4)))} <a class="bal-max" data-poolmax="base">${esc(t('ui.max'))}</a>`;
    vq.innerHTML = `${esc(t('pool.bal').replace('{n}', fmt(poolBal.quote, 2)))} <a class="bal-max" data-poolmax="quote">${esc(t('ui.max'))}</a>`;
  } catch { vb.innerHTML = ''; vq.innerHTML = ''; }
}

function poolRecalc(from) {
  const bEl = $('poolBaseAmt'), qEl = $('poolQuoteAmt');
  if (!bEl || !qEl) return;
  const bDec = Math.min(pool.decimals ?? 6, 8);
  if (pool.priceFixed && pool.mid > 0) {

    if (from === 'base') { const b = Number(bEl.value || 0); qEl.value = b > 0 ? (b * pool.mid).toFixed(2) : ''; }
    else if (from === 'quote') { const q = Number(qEl.value || 0); bEl.value = q > 0 ? (q / pool.mid).toFixed(bDec) : ''; }
  } else {

    const b = Number(bEl.value || 0), q = Number(qEl.value || 0);
    pool.mid = (b > 0 && q > 0) ? q / b : 0;
  }
  $('poolPriceShow').textContent = pool.mid > 0 ? fmt(pool.mid, 8) : '-';
}

function poolRenderPreview() {
  const lv = $('poolPvLevels'), wd = $('poolPvWidth'), dp = $('poolPvDepth'), thin = $('poolThinHint'), btn = $('poolAddBtn');
  const b = Number($('poolBaseAmt').value || 0), q = Number($('poolQuoteAmt').value || 0);
  const mid = pool.mid;
  if (!(mid > 0) || (!(b > 0) && !(q > 0))) {
    if (lv) lv.textContent = '-'; if (wd) wd.textContent = '-'; if (dp) dp.textContent = '-';
    if (thin) thin.hidden = true; if (btn) btn.disabled = false;
    { const bh = $('poolBalHint'); if (bh) bh.hidden = true; }
    return;
  }

  const qVal = q > 0 ? q : b * mid;
  const bVal = b > 0 ? b * mid : q;
  const Vtot = qVal + bVal;
  const s = strat3(Vtot, pool.minNotional);
  if (lv) lv.textContent = t('pool.levelsVal').replace('{n}', String(s.levels));
  if (wd) wd.textContent = t('pool.widthVal').replace('{p}', (s.rangeWidthBps / 100).toFixed(1));
  if (dp) dp.textContent = '$' + fmt(Vtot, 2);
  if (thin) thin.hidden = !s.tooThin;
  const short = poolShortSide(b > 0 ? b : q / mid, q > 0 ? q : b * mid);
  const bh = $('poolBalHint');
  if (bh) { bh.hidden = !short; bh.textContent = short ? poolShortMsg(short) : ''; }
  if (btn) btn.disabled = s.tooThin || !!short;
  poolShowCreateFee();
}

let _createFee = null;
async function poolShowCreateFee() {
  const row = $('poolFeeRow'); if (!row) return;
  if (_createFee === null) {
    try { _createFee = await pub.readContract({ address: CONFIG.listing, abi: listingCreateAbi, functionName: 'createFee' }); } catch { _createFee = 0n; }
  }
  const show = pool.mode === 'create' && _createFee > 0n;
  row.hidden = !show;
  if (show) $('poolFeeShow').textContent = `${formatUnits(_createFee, 18)} BNB`;
}

function poolShortSide(baseNeed, quoteNeed) {
  if (!poolBal.loaded) return null;
  if (baseNeed > poolBal.base * (1 + 1e-9)) return 'base';
  if (quoteNeed > poolBal.quote * (1 + 1e-9)) return 'quote';
  return null;
}
function poolShortMsg(sideKey) {
  return sideKey === 'base'
    ? t('pool.balShortBase').replace('{sym}', pool.symbol || t('pool.curToken')).replace('{n}', fmt(poolBal.base, 4))
    : t('pool.balShortQuote').replace('{n}', fmt(poolBal.quote, 2));
}

const floorFix = (v, d) => (Math.floor(v * 10 ** d) / 10 ** d).toFixed(d);

async function waitForPairIndexed(pairId, tries = 15, gapMs = 2500) {
  for (let i = 0; i < tries; i++) {
    try {
      const list = await (await fetch(api('/pairs'))).json();
      if (Array.isArray(list) && list.some((p) => String(p.pairId) === String(pairId))) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return false;
}

async function postListingMeta(pairId, createTx) {

  try {
    const list = await fetch(api('/pairs')).then((r) => (r.ok ? r.json() : []));
    const m = Array.isArray(list) ? list.find((p) => String(p.pairId) === String(pairId)) : null;
    if (m && (m.displayName || m.logo)) return 'exists';
  } catch {}
  if (!createTx) return 'skip';
  const displayName = $('poolName')?.value || pool.name || '';
  const logo = $('poolLogo')?.value || pool.logo || '';
  await ensureChainClock();
  const deadline = Math.floor(chainNow()) + 600;
  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
      ],
      ListingMeta: [
        { name: 'pairId', type: 'uint256' }, { name: 'displayName', type: 'string' }, { name: 'logo', type: 'string' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    domain: { name: 'SorDexListingMeta', version: '1', chainId: CONFIG.chainId, verifyingContract: CONFIG.listing },
    primaryType: 'ListingMeta',
    message: { pairId: String(pairId), displayName, logo, deadline: String(deadline) },
  };
  const signature = await window.ethereum.request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify(typedData)] });
  const r = await fetch(api('/listing-meta'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairId: String(pairId), logo, displayName, txHash: createTx, signature, deadline }),
  });
  if (r.ok) return 'ok';
  if (r.status === 409) return 'exists';
  throw Object.assign(new Error(`listing-meta ${r.status}`), { userMsg: t(r.status === 403 ? 'pool.metaNotCreator' : 'pool.metaFail') });
}

async function postSubscribe(pairId, mmParams) {
  await ensureChainClock();
  const deadline = Math.floor(chainNow()) + 600, nonce = String(Date.now());
  const sig = await signMMAction('MMSubscribe', String(pairId), mmParams, deadline, nonce);
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${CONFIG.apiBase}/mm/subscribe`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ maker: account, pairId: String(pairId), params: mmParams, signature: sig, deadline, nonce }),
      });
      if (r.ok) return;
      lastErr = new Error(`subscribe ${r.status}`);
    } catch (e) { lastErr = e; }
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw lastErr || new Error('subscribe failed');
}

const OB_STEPS = {
  create:       { i18n: 'ob.stepCreate',       sign: true },
  index:        { i18n: 'ob.stepIndex',        sign: false },
  approveBase:  { i18n: 'ob.stepApproveBase',  sign: true },
  approveQuote: { i18n: 'ob.stepApproveQuote', sign: true },
  deposit:      { i18n: 'ob.stepDeposit',      sign: true },
  agent:        { i18n: 'ob.stepAgent',        sign: true },
  band:         { i18n: 'ob.stepBand',         sign: true },
  subscribe:    { i18n: 'ob.stepSubscribe',    sign: true },
};
let obPlan = [];

function obRender() {
  const box = $('poolSteps'); if (!box) return;
  if (!obPlan.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  const remainSign = obPlan.filter((s) => s.status !== 'done' && s.status !== 'skip' && OB_STEPS[s.key].sign).length;
  const rows = obPlan.map((s) => {
    const cls = s.status;
    const stTxt = t('ob.' + (s.status === 'doing' ? 'doing' : s.status === 'done' ? 'done' : s.status === 'skip' ? 'skip' : 'pending'));
    return `<div class="ob-step ob-${cls}"><span class="ob-dot"></span><span class="ob-label">${esc(t(OB_STEPS[s.key].i18n))}</span><span class="ob-stat">${esc(stTxt)}</span></div>`;
  }).join('');
  box.innerHTML = `<div class="ob-head">${esc(t('ob.title'))}<span class="ob-need">${esc(t('ob.needSign').replace('{n}', remainSign))}</span></div>${rows}<div class="ob-hint">${esc(t('ob.signHint'))}</div>`;
}
function obSet(key, status) { const s = obPlan.find((x) => x.key === key); if (s) { s.status = status; obRender(); } }

async function obBuildPlan(mode, resume, pairId, bWei, qWei, agent, exComplete) {
  const keys = [];
  if (mode === 'create') keys.push('create');
  keys.push('index');
  if (!resume) {

    try { const a = await pub.readContract({ address: pool.token, abi: erc20Abi, functionName: 'allowance', args: [account, CONFIG.vault] }); if (a < bWei) keys.push('approveBase'); } catch { keys.push('approveBase'); }
    try { const a = await pub.readContract({ address: CONFIG.quoteToken, abi: erc20Abi, functionName: 'allowance', args: [account, CONFIG.vault] }); if (a < qWei) keys.push('approveQuote'); } catch { keys.push('approveQuote'); }
    keys.push('deposit');
  }
  if (agent) {
    let authorized = false;
    if (pairId) { try { const exp = await pub.readContract({ address: CONFIG.settler, abi: settlerAgentAbi, functionName: 'agentExpiry', args: [account, agent] }); authorized = Number(exp) > Math.floor(Date.now() / 1000); } catch {} }
    if (!authorized) keys.push('agent');
    let bandSet = false;
    if (pairId) { try { const b = await pub.readContract({ address: CONFIG.settler, abi: settlerBandAbi, functionName: 'makerBand', args: [account, BigInt(pairId)] }); bandSet = Boolean(b[4]); } catch {} }
    if (!bandSet) keys.push('band');
    if (!exComplete) keys.push('subscribe');
  }
  obPlan = keys.map((k) => ({ key: k, status: 'pending' }));
  obRender();
}

function runSignQueue(tasks) {
  const btn = $('poolSignBtn');

  { const ab = $('poolAddBtn'); if (ab) ab.hidden = true; }
  if (!btn) {
    return (async () => { for (const task of tasks) { obSet(task.key, 'doing'); task.hash = await task.send(); } })();
  }
  return new Promise((resolve) => {
    let i = 0;
    const show = () => {
      if (i >= tasks.length) { btn.hidden = true; btn.onclick = null; return; }
      btn.hidden = false; btn.disabled = false;
      btn.textContent = `${t('ob.signBtn')}（${i + 1}/${tasks.length}）· ${t(OB_STEPS[tasks[i].key].i18n)}`;
    };
    btn.onclick = async () => {
      if (i >= tasks.length) return;
      const task = tasks[i];
      btn.disabled = true; btn.textContent = t('order.submitBusy');
      obSet(task.key, 'doing');
      try {
        task.hash = await task.send();
        i++;
        if (i >= tasks.length) { btn.hidden = true; btn.onclick = null; resolve(); }
        else show();
      } catch (e) {
        obSet(task.key, 'pending');
        show();
      }
    };
    show();
  });
}

async function poolAddLiquidity() {
  const err = $('poolErr2'), prog = $('poolProgress');
  err.style.color = 'var(--sell)'; err.textContent = ''; prog.textContent = '';
  { const sb = $('poolSignBtn'); if (sb) { sb.hidden = true; sb.onclick = null; } }
  if (!account || !wallet) { err.textContent = t('pool.needWallet'); return; }
  if (!pool.token) { err.textContent = t('pool.needToken'); return; }
  if (!CONFIG.vault || !CONFIG.settler || !CONFIG.quoteToken) { err.textContent = t('pool.notConfigured'); return; }
  if (pool.mode === 'create' && !CONFIG.listing) { err.textContent = t('pool.noContract'); return; }
  let baseNum = Number($('poolBaseAmt').value || 0);
  let quoteNum = Number($('poolQuoteAmt').value || 0);
  const qDec = await usdtDecimals();

  let pairId = null;
  let createTx = '';
  let obExComplete = false;
  if (pool.mode === 'add') {
    try {
      const listPairs = await (await fetch(api('/pairs'))).json();
      const ex = Array.isArray(listPairs) ? listPairs.find((p) => (p.base || '').toLowerCase() === pool.token.toLowerCase()) : null;
      if (ex) { pairId = String(ex.pairId); obExComplete = ex.listingComplete === true; }
    } catch {}
    if (!pairId) { err.textContent = t('pool.needToken'); return; }
  }

  let vaultBaseHuman = 0, vaultQuoteHuman = 0;
  if (pool.mode === 'add') {
    try {
      const [vb, vq] = await Promise.all([
        pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'availableOf', args: [account, BigInt(pairId), pool.token] }),
        pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'availableOf', args: [account, BigInt(pairId), CONFIG.quoteToken] }),
      ]);
      vaultBaseHuman = Number(vb) / 10 ** pool.decimals;
      vaultQuoteHuman = Number(vq) / 10 ** qDec;
    } catch {}
  }
  const noNewAmt = !(baseNum > 0) && !(quoteNum > 0);
  const resume = pool.mode === 'add' && noNewAmt && vaultBaseHuman > 0 && vaultQuoteHuman > 0;

  if (resume) {

    if (!(pool.mid > 0)) pool.mid = vaultQuoteHuman / vaultBaseHuman;
  } else {
    if (noNewAmt) { err.textContent = t('pool.needAmt'); return; }

    if (pool.mid > 0) {
      if (!(baseNum > 0)) baseNum = quoteNum / pool.mid;
      if (!(quoteNum > 0)) quoteNum = baseNum * pool.mid;
    }
    if (!(baseNum > 0) || !(quoteNum > 0) || !(pool.mid > 0)) { err.textContent = t('pool.needAmt'); return; }
    { const short = poolShortSide(baseNum, quoteNum); if (short) { err.textContent = poolShortMsg(short); return; } }
    const Vtot = quoteNum + baseNum * pool.mid;
    if (strat3(Vtot, pool.minNotional).tooThin) { err.textContent = t('pool.tooThin'); return; }
  }

  const obAgent = await fetchBotAgent().catch(() => null);
  let obBWei = 0n, obQWei = 0n;
  if (!resume) {
    try { obBWei = parseUnits(baseNum.toFixed(Math.min(pool.decimals, 8)), pool.decimals); } catch {}
    try { obQWei = parseUnits(quoteNum.toFixed(2), qDec); } catch {}
  }
  await obBuildPlan(pool.mode, resume, pairId, obBWei, obQWei, obAgent, obExComplete);

  try {
    if (pool.mode === 'create') {
      const tickDecimals = priceTickDecimals(String(pool.mid));

      const { tickNum, tickDen } = rawTick(tickDecimals, pool.decimals, qDec);
      const minBaseQty = 10n ** BigInt(Math.max(pool.decimals - 3, 0));
      const minNotional = 10n ** BigInt(Math.max(qDec - 3, 0));
      let fee = 0n;
      try { fee = await pub.readContract({ address: CONFIG.listing, abi: listingCreateAbi, functionName: 'createFee' }); } catch {}
      if (fee > 0n) {
        let bnb = null;
        try { bnb = await pub.getBalance({ address: account }); } catch {}
        if (bnb !== null && bnb < fee) { err.textContent = t('pool.createFeeShort').replace('{fee}', formatUnits(fee, 18)); return; }
      }
      obSet('create', 'doing');
      prog.style.color = 'var(--muted)'; prog.textContent = t('pool.stCreating');
      let existsAlready = false;
      try {
        await pub.simulateContract({ address: CONFIG.listing, abi: listingCreateAbi, functionName: 'createPair', args: [pool.token, tickNum, tickDen, minBaseQty, minNotional, 0n], value: fee, account });
      } catch (e) {

        const hay = (JSON.stringify(e?.cause ?? '') + ' ' + (e?.message || '')).toLowerCase();
        if (e?.cause?.data?.errorName === 'PairExists' || hay.includes('0x3d77e891')) existsAlready = true;
        else { prog.textContent = ''; err.textContent = listingErrMsg(e); return; }
      }
      if (existsAlready) {
        pool.mode = 'add';
        try { const list = await (await fetch(api('/pairs'))).json(); const ex = Array.isArray(list) ? list.find((p) => (p.base || '').toLowerCase() === pool.token.toLowerCase()) : null; if (ex) pairId = String(ex.pairId); } catch {}
        obSet('create', 'done');
      } else {
        const hash = await sendContractTx({ address: CONFIG.listing, abi: listingCreateAbi, functionName: 'createPair', args: [pool.token, tickNum, tickDen, minBaseQty, minNotional, 0n], value: fee, account });
        const rcpt = await waitOk(hash);
        createTx = hash;
        for (const log of rcpt.logs) {
          if (log.address.toLowerCase() !== CONFIG.listing.toLowerCase()) continue;
          if (log.topics && log.topics.length >= 2) { pairId = String(BigInt(log.topics[1])); break; }
        }
        if (!pairId) { try { pairId = String(await pub.readContract({ address: CONFIG.listing, abi: listingCreateAbi, functionName: 'pairCount' })); } catch {} }
        prog.style.color = 'var(--buy)'; prog.textContent = `${t('pool.stCreated')} #${pairId}`;
        obSet('create', 'done');
      }
    }

    obSet('index', 'doing');
    prog.style.color = 'var(--muted)'; prog.textContent = t('pool.stIndexing');
    await waitForPairIndexed(pairId);
    try {
      const res = await postListingMeta(pairId, createTx);
      if (res === 'skip') { prog.style.color = 'var(--muted)'; prog.textContent = t('pool.metaSkip'); }
    } catch (e) {
      prog.textContent = '';

      if (/user rejected|user denied|4001/i.test(String(e?.message || '') + String(e?.code || ''))) { prog.style.color = 'var(--muted)'; prog.textContent = t('pool.metaSkip'); }
      else { err.textContent = txErrMsg(e, t('pool.metaFail')); return; }
    }
    obSet('index', 'done');

    const tasks = [];
    if (!resume) {
      const bWei = parseUnits(baseNum.toFixed(Math.min(pool.decimals, 8)), pool.decimals);
      const qWei = parseUnits(quoteNum.toFixed(2), qDec);
      let alB = 0n, alQ = 0n;
      try { alB = await pub.readContract({ address: pool.token, abi: erc20Abi, functionName: 'allowance', args: [account, CONFIG.vault] }); } catch {}
      try { alQ = await pub.readContract({ address: CONFIG.quoteToken, abi: erc20Abi, functionName: 'allowance', args: [account, CONFIG.vault] }); } catch {}
      if (alB < bWei) tasks.push({ key: 'approveBase', send: () => sendContractTx({ address: pool.token, abi: erc20Abi, functionName: 'approve', args: [CONFIG.vault, bWei], account, gas: 80000n }) });
      if (alQ < qWei) tasks.push({ key: 'approveQuote', send: () => sendContractTx({ address: CONFIG.quoteToken, abi: erc20Abi, functionName: 'approve', args: [CONFIG.vault, qWei], account, gas: 80000n }) });
      tasks.push({ key: 'deposit', send: () => sendContractTx({ address: CONFIG.vault, abi: vaultAbi, functionName: 'deposit2', args: [BigInt(pairId), pool.token, bWei, CONFIG.quoteToken, qWei], account, gas: 800000n }) });
    }
    const agent = await fetchBotAgent();
    if (agent) {
      let authorized = false;
      try { const exp = await pub.readContract({ address: CONFIG.settler, abi: settlerAgentAbi, functionName: 'agentExpiry', args: [account, agent] }); authorized = Number(exp) > Math.floor(Date.now() / 1000); } catch {}
      if (!authorized) tasks.push({ key: 'agent', send: () => sendContractTx({ address: CONFIG.settler, abi: settlerAgentAbi, functionName: 'setAgent', args: [agent, BigInt(Math.floor(Date.now() / 1000) + AGENT_TTL_DAYS * 86400)], account, gas: 100000n }) });

      let bandSet = false;
      try { const b = await pub.readContract({ address: CONFIG.settler, abi: settlerBandAbi, functionName: 'makerBand', args: [account, BigInt(pairId)] }); bandSet = Boolean(b[4]); } catch {}
      if (!bandSet && pool.mid > 0) {
        const floor = priceToFraction(pool.mid / POOL_BAND_FACTOR, pool.decimals, qDec);
        const ceil = priceToFraction(pool.mid * POOL_BAND_FACTOR, pool.decimals, qDec);
        if (!floor || !ceil) throw Object.assign(new Error('band-price-invalid'), { userMsg: t('pool.hostBadPrice') });
        tasks.push({ key: 'band', send: () => sendContractTx({ address: CONFIG.settler, abi: settlerBandAbi, functionName: 'setPriceBand', args: [BigInt(pairId), floor.num, floor.den, ceil.num, ceil.den], account, gas: 250000n }) });
      }
    }

    if (tasks.length) { prog.style.color = 'var(--muted)'; prog.textContent = t('pool.stSigning'); await runSignQueue(tasks); }

    if (tasks.length) { prog.style.color = 'var(--muted)'; prog.textContent = t('pool.stConfirming'); }
    for (const task of tasks) {
      const rc = await pub.waitForTransactionReceipt({ hash: task.hash });

      if (rc.status !== 'success') {
        obSet(task.key, 'pending');
        throw Object.assign(new Error('tx-reverted'), { userMsg: t('pool.txReverted').replace('{step}', t(OB_STEPS[task.key].i18n)) });
      }
      obSet(task.key, 'done');
    }

    if (agent && !obExComplete) {
      obSet('subscribe', 'doing');
      prog.style.color = 'var(--muted)'; prog.textContent = t('pool.stSubscribing');
      const mmParams = { priceSource: 'fixed', fixedPrice: pool.mid, levels: 10, halfSpreadBps: 30, rangeWidthBps: 300 };
      try {
        await postSubscribe(pairId, mmParams);
      } catch (e) {
        prog.textContent = '';
        err.textContent = t('pool.subFail');
        try { await loadPairs(); } catch {}
        renderMyPools();
        return;
      }
      obSet('subscribe', 'done');
    }
    prog.style.color = 'var(--buy)'; prog.textContent = t('pool.done');
    try { await loadPairs(); } catch {}
    $('poolBaseAmt').value = ''; $('poolQuoteAmt').value = '';
    poolRenderPreview();
    renderMyPools();
  } catch (e) {
    prog.textContent = '';
    { const sb = $('poolSignBtn'); if (sb) { sb.hidden = true; sb.onclick = null; } }
    err.style.color = 'var(--sell)'; err.textContent = txErrMsg(e, t('pool.addFail'));
  }
}

async function renderMyPools() {
  const list = $('poolMineList'), empty = $('poolMineEmpty');
  if (!list) return;
  if (!account) { list.innerHTML = ''; if (empty) { empty.hidden = false; empty.textContent = t('pool.needWallet'); } return; }
  if (empty) { empty.hidden = false; empty.textContent = t('pool.mineLoading'); }
  list.innerHTML = '';
  let all = [];
  try { all = await (await fetch(api('/pairs'))).json(); } catch {}
  if (!Array.isArray(all)) all = [];
  const qDec = await usdtDecimals();

  const assets = [];
  for (const p of all) {
    const pid = String(p.pairId);
    const pairSym = p.baseSymbol || (p.base || '').slice(0, 6);
    if (p.base) assets.push({ pairId: pid, pairSym, addr: p.base, sym: pairSym, dec: Number(p.baseDecimals ?? 18), isQuote: false });
    if (p.quote) assets.push({ pairId: pid, pairSym, addr: p.quote, sym: p.quoteSymbol || 'USDT', dec: Number(p.quoteDecimals ?? qDec), isQuote: true });
  }

  const rd = (pid, token, fn) => pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: fn, args: [account, BigInt(pid), token] }).then((x) => Number(x)).catch(() => NaN);

  const [wdDelay] = await Promise.all([
    pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'withdrawDelay' }).then((x) => Number(x)).catch(() => 0),
    syncChainClock(),
  ]);
  const rows = await Promise.all(assets.map(async (as) => {
    const [a, pw, ul] = await Promise.all([rd(as.pairId, as.addr, 'availableOf'), rd(as.pairId, as.addr, 'pendingWithdraw'), rd(as.pairId, as.addr, 'unlockAt')]);
    if ([a, pw].some(Number.isNaN)) return null;
    return { as, avail: a / 10 ** as.dec, pend: [pw / 10 ** as.dec, ul] };
  }));

  rows.sort((x, y) => (!x || !y) ? 0 : (Number(x.as.pairId) - Number(y.as.pairId)) || (Number(x.as.isQuote) - Number(y.as.isQuote)));

  const byPair = new Map();
  for (const row of rows) {
    if (!row) continue;
    const pid = row.as.pairId;
    if (!byPair.has(pid)) byPair.set(pid, { pairId: pid, pairSym: row.as.pairSym, base: null, quote: null });
    const g = byPair.get(pid);
    if (row.as.isQuote) g.quote = row; else g.base = row;
  }
  let shown = 0;
  for (const g of [...byPair.values()].sort((a, b) => Number(a.pairId) - Number(b.pairId))) {
    const base = g.base, quote = g.quote;
    const bAvail = base?.avail || 0, qAvail = quote?.avail || 0;
    const bPend = base?.pend?.[0] || 0, qPend = quote?.pend?.[0] || 0;
    const hasPend = bPend > 0 || qPend > 0;
    if (!(bAvail > 0) && !(qAvail > 0) && !hasPend) continue;
    shown++;
    const bSym = esc(base?.as.sym || g.pairSym), qSym = esc(quote?.as.sym || 'USDT');
    const card = document.createElement('div');
    card.className = 'pool-card-inner';
    card.dataset.pair = g.pairId;
    if (base) { card.dataset.baseAddr = base.as.addr; card.dataset.baseDec = String(base.as.dec); card.dataset.baseAvail = String(bAvail); card.dataset.baseSym = base.as.sym; }
    if (quote) { card.dataset.quoteAddr = quote.as.addr; card.dataset.quoteDec = String(quote.as.dec); card.dataset.quoteAvail = String(qAvail); card.dataset.quoteSym = quote.as.sym; }
    card.dataset.basePend = String(bPend); card.dataset.quotePend = String(qPend);
    const head = `<div class="panel-head sub"><span>${bSym} / ${qSym}</span><span class="src">#${esc(g.pairId)}</span></div>`;
    const balRows = `<div class="pool-row"><span>${bSym}</span><span>${fmt(bAvail, 4)}</span></div>
      <div class="pool-row"><span>${qSym}</span><span>${fmt(qAvail, 4)}</span></div>`;

    const pendRow = (amt, sym, ul) => {
      const times = ul ? `<br><small class="muted">${wdDelay ? `${t('pool.reqAt')} ${fmtLocalTs(ul - wdDelay)} · ` : ''}${t('pool.unlockAt')} ${fmtLocalTs(ul)} · ${esc(unlockLeftText(ul))}</small>` : '';
      return `<div class="pool-row"><span>${t('pool.cardPending')}</span><span>${fmt(amt, 4)} ${sym}${times}</span></div>`;
    };
    const pendLine = hasPend ? `${bPend > 0 ? pendRow(bPend, bSym, base?.pend?.[1] || 0) : ''}${qPend > 0 ? pendRow(qPend, qSym, quote?.pend?.[1] || 0) : ''}
      <div class="field two"><button class="submit slim" data-act="exec">${t('pool.execBtn')}</button><button class="submit slim ghost" data-act="cancel">${t('pool.cancelBtn')}</button></div>` : '';
    const removeBox = hasPend ? '' : `<div class="pool-remove"><span>${t('pool.removeLabel')}</span>
        <div class="seg">
          <button data-act="remove" data-pct="25">25%</button>
          <button data-act="remove" data-pct="50">50%</button>
          <button data-act="remove" data-pct="75">75%</button>
          <button data-act="remove" data-pct="100">100%</button>
        </div>
      </div>
      <div class="pool-remove-confirm hide">
        <div class="pool-remove-amt"></div>
        <button class="pool-cta slim" data-act="confirm">${t('pool.removeConfirm')}</button>
      </div>`;
    card.innerHTML = `${head}${balRows}${removeBox}${pendLine}<div class="pool-host" hidden></div><p class="err pool-card-err"></p>`;
    list.appendChild(card);
    poolRenderHost(card, g.pairId, base?.as.dec ?? 18, quote?.as.dec ?? qDec);
  }
  if (empty) empty.hidden = shown > 0 ? true : (empty.textContent = t('pool.mineEmpty'), false);
}

function bandToPrice(num, den, baseDec, quoteDec) {
  if (!den || den === 0n) return null;
  return Number(num) / Number(den) * 10 ** (baseDec - quoteDec);
}

const REF_MIN_LEVEL_USDT = 1;
async function pairRefPrices(pairId) {
  let book = 0, trade = 0;
  try {
    const b = await fetch(`${CONFIG.apiBase}/mixed-book?pairId=${encodeURIComponent(pairId)}`).then((r) => r.json());
    const solid = (lv) => (lv || []).filter((x) => Number(x.price) > 0 && Number(x.price) * Number(x.qty) >= REF_MIN_LEVEL_USDT);
    const bid = Number(solid(b?.bids)[0]?.price || 0), ask = Number(solid(b?.asks)[0]?.price || 0);
    book = bid > 0 && ask > 0 ? (bid + ask) / 2 : (bid || ask || 0);
  } catch {}
  try {
    const tr = await fetch(`${CONFIG.apiBase}/trades?pairId=${encodeURIComponent(pairId)}&limit=21`).then((r) => r.json());
    const ps = (tr?.trades || []).map((x) => Number(x.price)).filter((x) => x > 0).sort((a, c) => a - c);
    if (ps.length) trade = ps[Math.floor(ps.length / 2)];
  } catch {}
  return { book, trade };
}

async function pairMidPrice(pairId) { const r = await pairRefPrices(pairId); return r.book || r.trade || 0; }

const PRICE_WARN_RATIO = 1.2;
function priceDeviationMsg(p, ref) {
  const far = (r) => r > 0 && (p / r > PRICE_WARN_RATIO || r / p > PRICE_WARN_RATIO);
  if (!(p > 0)) return '';
  if (far(ref.book) || far(ref.trade)) return t('pool.priceFar');
  return '';
}

async function poolRenderHost(card, pairId, baseDec, quoteDec) {
  const box = card.querySelector('.pool-host');
  if (!box || !account || !CONFIG.settler) return;
  const agent = await fetchBotAgent();
  if (!agent) return;
  let exp = 0, band = null;
  try { exp = Number(await pub.readContract({ address: CONFIG.settler, abi: settlerAgentAbi, functionName: 'agentExpiry', args: [account, agent] })); } catch {}
  try { band = await pub.readContract({ address: CONFIG.settler, abi: settlerBandAbi, functionName: 'makerBand', args: [account, BigInt(pairId)] }); } catch {}
  const nowS = Math.floor(Date.now() / 1000);
  const authed = exp > nowS;
  if (!exp && !(band && band[4])) return;
  const agentTxt = authed ? t('pool.hostOn').replace('{d}', exp >= 2 ** 63 ? '-' : fmtLocalTs(exp)) : (exp ? t('pool.hostExpired') : t('pool.hostOff'));
  let bandTxt = t('pool.hostBandNone'), outWarn = '';
  if (band && band[4]) {
    const lo = band[1] ? bandToPrice(band[0], band[1], baseDec, quoteDec) : null;
    const hi = band[3] ? bandToPrice(band[2], band[3], baseDec, quoteDec) : null;
    bandTxt = t('pool.hostBandRange').replace('{lo}', lo ? fmtPx(lo) : '-').replace('{hi}', hi ? fmtPx(hi) : '-');
    const mid = await pairMidPrice(pairId);
    if (mid > 0 && ((lo && mid < lo) || (hi && mid > hi))) outWarn = `<p class="pool-hint pool-hint-warn">${esc(t('pool.hostBandOut').replace('{p}', fmtPx(mid)))}</p>`;
  }
  card.dataset.baseDec = card.dataset.baseDec || String(baseDec);
  card.dataset.quoteDecHost = String(quoteDec);
  box.innerHTML = `<div class="panel-head sub"><span>${esc(t('pool.hostTitle'))}</span></div>
    <div class="pool-row"><span>${esc(t('pool.hostAgent'))}</span><span>${esc(agentTxt)}</span></div>
    <div class="pool-row"><span>${esc(t('pool.hostBand'))}</span><span>${esc(bandTxt)}</span></div>
    ${outWarn}
    <div class="field two"><button class="submit slim" data-act="reband">${esc(t('pool.hostRebandBtn'))}</button>${authed ? `<button class="submit slim ghost" data-act="revoke">${esc(t('pool.hostRevokeBtn'))}</button>` : ''}</div>`;
  box.hidden = false;
}

function poolConfirmPrice(pairId) {
  return new Promise(async (resolve) => {
    const ref = await pairRefPrices(pairId);
    const pre = ref.book || ref.trade || 0;
    const refTxt = [ref.book > 0 ? t('pool.refBook').replace('{p}', fmtPx(ref.book)) : '', ref.trade > 0 ? t('pool.refTrade').replace('{p}', fmtPx(ref.trade)) : ''].filter(Boolean).join(t('pool.refSep')) || t('pool.refNone');
    openModal(t('pool.rebandTitle'), `<div class="reband-box">
      <p class="pool-hint" style="margin-top:0">${esc(t('pool.rebandIntro').replaceAll('{f}', String(POOL_BAND_FACTOR)))}</p>
      <div class="pool-amt"><div class="pool-amt-head"><span>${esc(t('pool.priceInput'))}</span></div>
        <div class="pool-amt-body"><input id="rebandPrice" class="pool-amt-input" inputmode="decimal" value="${pre > 0 ? esc(String(Number(pre.toPrecision(8)))) : ''}"><span class="pool-amt-cur">USDT</span></div></div>
      <p class="pool-hint">${esc(refTxt)}</p>
      <p class="pool-hint pool-hint-warn" id="rebandWarn" hidden></p>
      <div class="field two" style="margin-top:12px"><button class="submit slim" id="rebandOk">${esc(t('pool.rebandConfirm'))}</button><button class="submit slim ghost" id="rebandCancel">${esc(t('pool.rebandCancel'))}</button></div></div>`);
    const inp = $('rebandPrice'), warn = $('rebandWarn');
    const chk = () => { const m = priceDeviationMsg(Number(inp.value), ref); warn.hidden = !m; warn.textContent = m; };
    inp.oninput = chk; chk();
    let done = false;
    const finish = (v) => { if (done) return; done = true; closeModal(); resolve(v); };
    $('rebandOk').onclick = () => { const v = Number(inp.value); if (!(v > 0)) { warn.hidden = false; warn.textContent = t('pool.priceNeed'); return; } finish(v); };
    $('rebandCancel').onclick = () => finish(null);
    const x = $('modalClose'); if (x) { const prev = x.onclick; x.onclick = (e) => { finish(null); if (prev) prev(e); }; }
  });
}

async function poolReband(card) {
  const err = poolCardErr(card);
  if (err) { err.style.color = 'var(--sell)'; err.textContent = ''; }
  if (!account || !wallet) { if (err) err.textContent = t('pool.needWallet'); return; }
  const pairId = card.dataset.pair;
  const baseDec = Number(card.dataset.baseDec || 18), quoteDec = Number(card.dataset.quoteDecHost || 18);

  const mid = await poolConfirmPrice(pairId);
  if (mid === null) { if (err) err.textContent = ''; return; }
  if (!(mid > 0)) { if (err) err.textContent = t('pool.hostNoMid'); return; }
  const floor = priceToFraction(mid / POOL_BAND_FACTOR, baseDec, quoteDec);
  const ceil = priceToFraction(mid * POOL_BAND_FACTOR, baseDec, quoteDec);
  if (!floor || !ceil) { if (err) err.textContent = t('pool.hostBadPrice'); return; }
  try {
    if (err) { err.style.color = 'var(--muted)'; err.textContent = t('pool.hostBusy'); }
    const hash = await sendContractTx({ address: CONFIG.settler, abi: settlerBandAbi, functionName: 'setPriceBand', args: [BigInt(pairId), floor.num, floor.den, ceil.num, ceil.den], account, gas: 250000n });
    const rc = await pub.waitForTransactionReceipt({ hash });
    if (rc.status !== 'success') throw Object.assign(new Error('tx-reverted'), { userMsg: t('pool.rebandReverted') });
    if (err) { err.style.color = 'var(--buy)'; err.textContent = t('pool.hostRebandOk').replaceAll('{f}', String(POOL_BAND_FACTOR)); }
    poolRenderHost(card, pairId, baseDec, quoteDec);
  } catch (e) {
    if (err) { err.style.color = 'var(--sell)'; err.textContent = txErrMsg(e, t('pool.hostFail')); }
  }
}

async function poolRevokeAgent(card) {
  const err = poolCardErr(card);
  if (err) { err.style.color = 'var(--sell)'; err.textContent = ''; }
  if (!account || !wallet) { if (err) err.textContent = t('pool.needWallet'); return; }
  const agent = await fetchBotAgent();
  if (!agent) { if (err) err.textContent = t('pool.hostFail'); return; }
  if (!window.confirm(t('pool.hostRevokeAsk'))) return;
  try {
    if (err) { err.style.color = 'var(--muted)'; err.textContent = t('pool.hostBusy'); }
    const hash = await sendContractTx({ address: CONFIG.settler, abi: settlerAgentAbi, functionName: 'setAgent', args: [agent, 0n], account, gas: 100000n });
    await waitOk(hash);
    if (err) { err.style.color = 'var(--buy)'; err.textContent = t('pool.hostRevokeOk'); }

    renderMyPools();
  } catch (e) {
    if (err) { err.style.color = 'var(--sell)'; err.textContent = txErrMsg(e, t('pool.hostFail')); }
  }
}

function poolCardErr(card) { return card ? card.querySelector('.pool-card-err') : null; }

function poolCardSides(card) {
  const sides = [];
  if (card.dataset.baseAddr && Number(card.dataset.baseAvail) > 0) sides.push({ addr: card.dataset.baseAddr, sym: card.dataset.baseSym, avail: Number(card.dataset.baseAvail) });
  if (card.dataset.quoteAddr && Number(card.dataset.quoteAvail) > 0) sides.push({ addr: card.dataset.quoteAddr, sym: card.dataset.quoteSym, avail: Number(card.dataset.quoteAvail) });
  return sides;
}

function poolRemovePreview(card, pct) {
  if (!card) return;
  card.dataset.pct = String(pct);
  for (const b of card.querySelectorAll('.pool-remove .seg button')) b.classList.toggle('on', Number(b.dataset.pct) === pct);
  const parts = poolCardSides(card).map((s) => `${fmt(s.avail * pct / 100, 4)} ${esc(s.sym)}`);
  const amt = card.querySelector('.pool-remove-amt');
  if (amt) amt.innerHTML = t('pool.removeAmtPair').replace('{list}', parts.join('  +  '));
  card.querySelector('.pool-remove-confirm')?.classList.remove('hide');
  const err = poolCardErr(card); if (err) err.textContent = '';
}

async function poolRemovePair(card, pct) {
  const pairId = card.dataset.pair;
  const err = poolCardErr(card);
  if (err) { err.style.color = 'var(--sell)'; err.textContent = ''; }
  if (!account || !wallet) { if (err) err.textContent = t('pool.needWallet'); return; }
  if (!(pct > 0) || !pairId) return;
  const sides = poolCardSides(card);
  try {
    if (err) { err.style.color = 'var(--muted)'; err.textContent = t('pool.removing'); }
    for (const s of sides) {
      const bal = await pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'availableOf', args: [account, BigInt(pairId), s.addr] });
      const amt = (BigInt(bal) * BigInt(pct)) / 100n;
      if (amt <= 0n) continue;
      const h = await sendContractTx({ address: CONFIG.vault, abi: vaultAbi, functionName: 'requestWithdraw', args: [BigInt(pairId), s.addr, amt], account });
      await waitOk(h);
    }
    if (err) { err.style.color = 'var(--buy)'; err.textContent = t('pool.removed'); }
    renderMyPools();
  } catch (e) { if (err) { err.style.color = 'var(--sell)'; err.textContent = txErrMsg(e, t('pool.opFail')); } }
}

async function poolExecPair(card) {
  const pairId = card.dataset.pair;
  const err = poolCardErr(card);
  if (err) { err.style.color = 'var(--sell)'; err.textContent = ''; }
  if (!account || !wallet || !pairId) { if (err) err.textContent = t('pool.needWallet'); return; }
  const addrs = [card.dataset.baseAddr, card.dataset.quoteAddr].filter(Boolean);
  try {
    let did = false;
    await syncChainClock();
    for (const addr of addrs) {
      const [pend, unlock] = await Promise.all([
        pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'pendingWithdraw', args: [account, BigInt(pairId), addr] }),
        pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'unlockAt', args: [account, BigInt(pairId), addr] }),
      ]);
      if (!(Number(pend) > 0)) continue;

      if (Number(unlock) > chainNow()) { if (err) { err.style.color = 'var(--sell)'; err.textContent = t('pool.notUnlocked') + ' ' + fmtLocalTs(Number(unlock)) + t('punct.comma') + unlockLeftText(Number(unlock)); } return; }
      const h = await sendContractTx({ address: CONFIG.vault, abi: vaultAbi, functionName: 'executeWithdraw', args: [BigInt(pairId), addr], account });
      await waitOk(h);
      did = true;
    }
    if (!did) { if (err) err.textContent = t('pool.noPending'); return; }
    if (err) { err.style.color = 'var(--buy)'; err.textContent = t('pool.execOk'); }
    renderMyPools();
  } catch (e) { if (err) { err.style.color = 'var(--sell)'; err.textContent = txErrMsg(e, t('pool.opFail')); } }
}

async function poolCancelPair(card) {
  const pairId = card.dataset.pair;
  const err = poolCardErr(card);
  if (err) { err.style.color = 'var(--sell)'; err.textContent = ''; }
  if (!account || !wallet || !pairId) { if (err) err.textContent = t('pool.needWallet'); return; }
  const addrs = [card.dataset.baseAddr, card.dataset.quoteAddr].filter(Boolean);
  try {
    for (const addr of addrs) {
      const pend = await pub.readContract({ address: CONFIG.vault, abi: vaultAbi, functionName: 'pendingWithdraw', args: [account, BigInt(pairId), addr] });
      if (!(Number(pend) > 0)) continue;
      const h = await sendContractTx({ address: CONFIG.vault, abi: vaultAbi, functionName: 'cancelWithdraw', args: [BigInt(pairId), addr], account });
      await waitOk(h);
    }
    if (err) { err.style.color = 'var(--buy)'; err.textContent = t('pool.cancelOk'); }
    renderMyPools();
  } catch (e) { if (err) { err.style.color = 'var(--sell)'; err.textContent = txErrMsg(e, t('pool.opFail')); } }
}

async function bindReferrer() {
  const err = $('refErr');
  err.textContent = '';
  if (!account) {
    err.textContent = t('ref.needWallet');
    return;
  }
  const inviter = ($('refInviter').value || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(inviter)) {
    err.textContent = t('ref.badInviter');
    return;
  }
  try {
    if (!wallet) throw new Error(t('ref.needWallet'));
    const hash = await sendContractTx({
      address: window.__SORDEX__.referral,
      abi: parseAbi(['function bind(address)']),
      functionName: 'bind',
      args: [inviter],
      account,
    });
    await waitOk(hash);
    err.style.color = 'var(--buy)';
    err.textContent = t('ref.bindOk');
  } catch (e) {
    err.style.color = 'var(--sell)';
    err.textContent = txErrMsg(e, t('pool.opFail'));
  }
}

async function claimRebate() {
  const err = $('refErr');
  err.textContent = '';
  if (!account) {
    err.textContent = t('ref.needWallet');
    return;
  }
  try {
    const hash = await sendContractTx({
      address: CONFIG.feeVault,
      abi: parseAbi(['function claim(address token, address receiver) returns (uint256)']),
      functionName: 'claim',
      args: [curPair.quote, account],
      account,
    });
    await waitOk(hash);
    err.style.color = 'var(--buy)';
    err.textContent = t('ref.claimOk');
    await refreshReferral();
  } catch (e) {
    err.style.color = 'var(--sell)';
    err.textContent = txErrMsg(e, t('pool.opFail'));
  }
}

function pendText(amt, unlockSec) {
  if (!(amt > 0)) return t('list.mmNone');
  const ready = unlockSec * 1000 <= Date.now();
  return ready
    ? `${fmt(amt, 4)}（${t('list.mmUnlocked')}）`
    : `${fmt(amt, 4)}（${t('list.mmUnlockAt')} ${new Date(unlockSec * 1000).toLocaleString()}）`;
}

function bind() {

  for (const a of document.querySelectorAll('a[data-route]')) {
    a.onclick = (ev) => {
      ev.preventDefault();
      navTo(a.getAttribute('href'));
    };
  }
  window.addEventListener('popstate', () => router());

  bindSwap();

  for (const b of document.querySelectorAll('#mktDims button')) {
    b.onclick = () => { marketDim = b.dataset.dim; refreshMarkets(); };
  }
  if ($('mktSearch')) $('mktSearch').addEventListener('input', () => refreshMarkets());

  for (const b of document.querySelectorAll('#chTabs button')) {
    b.onclick = () => {
      chartMode = b.dataset.cmode;
      for (const x of document.querySelectorAll('#chTabs button')) x.classList.toggle('on', x === b);
      drawChart();
    };
  }

  for (const b of document.querySelectorAll('[data-cstyle]')) {
    b.onclick = () => {
      candleStyle = b.dataset.cstyle;
      for (const x of document.querySelectorAll('[data-cstyle]')) x.classList.toggle('on', x.dataset.cstyle === candleStyle);
      if (view === 'token') drawChart('tkChart', 'tkLegend'); else drawChart();
    };
  }

  chartCollapsed = isMobile();
  applyChartCollapsed();
  if ($('chartToggleTop')) $('chartToggleTop').onclick = () => {
    chartCollapsed = !chartCollapsed;
    applyChartCollapsed();
    if (!chartCollapsed) requestAnimationFrame(() => drawChart());
  };

  const tkId = $('tkId');
  if (tkId) tkId.onclick = (e) => {
    if (e.target.closest('#tradePairBtn') || e.target.closest('#tradePairPicker')) return;
    const href = $('tokenDetailsBtn')?.getAttribute('href');
    if (href && href !== '#') navTo(href);
  };

  if ($('tradePairBtn')) $('tradePairBtn').onclick = (e) => {
    e.stopPropagation();
    const pk = $('tradePairPicker');
    if (pk && pk.hidden) openTradePicker(); else closeTradePicker();
  };
  if ($('tradePairSearch')) $('tradePairSearch').oninput = (e) => renderTradePicker(e.target.value);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tradePairPicker') && !e.target.closest('#tradePairBtn')) closeTradePicker();
  });

  for (const b of document.querySelectorAll('#chTf button')) {
    b.onclick = () => {
      chartBucket = Number(b.dataset.tf) || 120;
      for (const x of document.querySelectorAll('#chTf button')) x.classList.toggle('on', x === b);
      if (curPair) refreshCandles();
    };
  }

  for (const b of document.querySelectorAll('#tradeMktDims button')) {
    b.onclick = () => {
      tradeMktDim = b.dataset.tdim;
      for (const x of document.querySelectorAll('#tradeMktDims button')) x.classList.toggle('on', x === b);
      renderTradeMkts();
    };
  }

  for (const b of document.querySelectorAll('#tkTf button')) {
    b.onclick = async () => {
      chartBucket = Number(b.dataset.tf) || 120;
      for (const x of document.querySelectorAll('#tkTf button')) x.classList.toggle('on', x === b);
      if (!curPair) return;
      await refreshCandles();
      drawChart('tkChart', 'tkLegend');
      let hi = -Infinity, lo = Infinity;
      for (const k of candles) { hi = Math.max(hi, k.h); lo = Math.min(lo, k.l); }
      if ($('tkHigh')) $('tkHigh').textContent = candles.length ? fmt(hi, 4) : '-';
      if ($('tkLow')) $('tkLow').textContent = candles.length ? fmt(lo, 4) : '-';
    };
  }

  if ($('bindBtn')) $('bindBtn').onclick = bindReferrer;
  if ($('claimBtn')) $('claimBtn').onclick = claimRebate;

  for (const b of document.querySelectorAll('.pool-tab')) b.onclick = () => setPoolTab(b.dataset.pooltab);
  if ($('poolDetectBtn')) $('poolDetectBtn').onclick = poolDetect;
  if ($('poolToken')) $('poolToken').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); poolDetect(); } });

  const poolAmtClean = (el) => { const v = el.value.replace(/,/g, '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); if (v !== el.value) el.value = v; };
  if ($('poolBaseAmt')) $('poolBaseAmt').addEventListener('input', (e) => { poolAmtClean(e.target); poolRecalc('base'); poolRenderPreview(); });

  if ($('poolQuoteAmt')) $('poolQuoteAmt').addEventListener('input', (e) => { poolAmtClean(e.target); poolRecalc('quote'); poolRenderPreview(); });
  if ($('poolAddBtn')) $('poolAddBtn').onclick = async () => {
    try { await poolAddLiquidity(); } finally { const ab = $('poolAddBtn'); if (ab) ab.hidden = false; }
  };
  if ($('poolMineList')) $('poolMineList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const card = b.closest('[data-pair]');
    if (!card) return;
    if (b.dataset.act === 'remove') { const pct = Number(b.dataset.pct || 0); if (pct > 0) poolRemovePreview(card, pct); }
    else if (b.dataset.act === 'confirm') { const pct = Number(card.dataset.pct || 0); if (pct > 0) poolRemovePair(card, pct); }
    else if (b.dataset.act === 'exec') poolExecPair(card);
    else if (b.dataset.act === 'cancel') poolCancelPair(card);
    else if (b.dataset.act === 'reband') poolReband(card);
    else if (b.dataset.act === 'revoke') poolRevokeAgent(card);
  });

  if ($('mmxConnectBtn')) $('mmxConnectBtn').onclick = connectWallet;
  if ($('mmxMaker')) $('mmxMaker').addEventListener('input', () => { mmxDetectVault(); mmxLoadStatus(); });
  if ($('mmxMyIpBtn')) $('mmxMyIpBtn').onclick = mmxFillMyIp;
  if ($('mmxIssueBtn')) $('mmxIssueBtn').onclick = mmxIssue;
  if ($('mmxUpdateIpBtn')) $('mmxUpdateIpBtn').onclick = mmxUpdateIps;
  if ($('mmxKeyCopy')) $('mmxKeyCopy').onclick = () => { const v = $('mmxKeyValue').textContent || ''; if (v && navigator.clipboard) navigator.clipboard.writeText(v); };

  $('connect').onclick = connectWallet;
  $('pairSel').onchange = (e) => selectPair(e.target.value);

  for (const b of document.querySelectorAll('#lang button, #langDw button, #langAcct button')) {
    b.onclick = () => {
      lang = b.dataset.lang;
      localStorage.setItem('sordex.lang', lang);
      applyLang();
      if (view === 'home') renderHome();
    };
  }

  for (const b of document.querySelectorAll('#sideTabs button')) {
    b.onclick = () => {
      side = b.dataset.side;
      for (const x of document.querySelectorAll('#sideTabs button')) x.classList.toggle('on', x === b);
      setErr('');
      refreshSubmitLabel();

      if (lastBal.pairId === curPair?.pairId && $('avail')) $('avail').textContent = side === 'buy' ? `${fmt(lastBal.quote, 2)} ${curPair.quoteSymbol || 'USDT'}` : `${fmt(lastBal.base, 4)} ${curPair.baseSymbol || ''}`;
      prefillPrice();
      updateSummary();
      refreshBalances();
    };
  }

  for (const b of document.querySelectorAll('#pcts button')) {
    b.onclick = async () => {
      if (!account) return;
      const p = readPct(b.dataset.pct);
      await refreshBalances().catch(() => {});
      if (lastBal.pairId !== curPair.pairId) return;
      if (side === 'buy') {

        const bal = lastBal.quote;
        const px = effPrice();
        const feeBps = isTakerOrder(px) ? (curPair?.takerFeeBps ?? 0) : (curPair?.makerFeeBps ?? 0);
        const buyTax = curPair?.buyTaxBps ?? 0;
        const costPerBase = px * (1 + (feeBps + buyTax) / 10000);
        if (costPerBase > 0) $('qty').value = floorFix((bal * p) / costPerBase, Math.min(8, decimalsBase));
      } else {

        const bal = lastBal.base;
        $('qty').value = floorFix(bal * p, Math.min(8, decimalsBase));
      }
      recalcTotalFromQty();
    };
  }

  const numClean = (el) => { const v = el.value.replace(/,/g, '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); if (v !== el.value) el.value = v; };

  const clampDec = (el, max) => { const m = el.value.match(/^(\d*)\.(\d*)$/); if (m && m[2].length > max) el.value = max > 0 ? m[1] + '.' + m[2].slice(0, max) : m[1]; };
  const tickDec = () => { const tk = Number(curPair?.tick); return tk > 0 ? Math.min(18, Math.max(0, Math.ceil(-Math.log10(tk) - 1e-9))) : 8; };
  $('price').oninput = (e) => { numClean(e.target); clampDec(e.target, tickDec()); setErr(''); recalcTotalFromQty(); };
  $('qty').oninput = (e) => { numClean(e.target); clampDec(e.target, Math.min(18, decimalsBase ?? 18)); setErr(''); recalcTotalFromQty(); };
  if ($('total')) $('total').oninput = (e) => { numClean(e.target); clampDec(e.target, Math.min(18, decimalsQuote ?? 18)); setErr(''); recalcQtyFromTotal(); };

  for (const id of ['asks', 'bids']) {
    const el = $(id);
    if (el) el.addEventListener('click', (e) => {
      const row = e.target.closest('.row');
      if (row && row.dataset.price) fillPriceFromBook(Number(row.dataset.price));
    });
  }

  for (const b of document.querySelectorAll('#typeSeg button[data-type]')) {
    b.onclick = () => {
      orderType = b.dataset.type;
      if ($('typeSel')) $('typeSel').value = orderType;
      setErr('');
      for (const x of document.querySelectorAll('#typeSeg button[data-type]')) x.classList.toggle('on', x === b);

      const priceField = $('priceField');
      if (priceField) priceField.hidden = orderType === 'market';
      if (orderType === 'market') { if ($('price')) $('price').value = ''; }
      else prefillPrice();
      updateSummary();
    };
  }

  $('submit').onclick = () => (orderType === 'market' ? marketTake() : submitOrder());

  for (const b of document.querySelectorAll('#bottomTabs button')) {
    b.onclick = () => {
      const tab = b.dataset.tab;
      for (const x of document.querySelectorAll('#bottomTabs button')) x.classList.toggle('on', x === b);
      $('tabOrders').classList.toggle('hide', tab !== 'orders');
      $('tabTrades').classList.toggle('hide', tab !== 'trades');
      if (tab === 'trades') refreshMyTrades(true);
      if ($('viewTrade')) $('viewTrade').dataset.otab = tab;
      if (tab === 'markets') renderTradeMkts();
      if ($('tabAssets')) $('tabAssets').classList.toggle('hide', tab !== 'assets');
      if (tab === 'assets') renderPairAssets();
    };
  }

  if ($('hamb')) $('hamb').onclick = (e) => { e.stopPropagation(); openDrawer(); };
  if ($('dwClose')) $('dwClose').onclick = closeDrawer;
  if ($('scrim')) $('scrim').onclick = closeDrawer;
  if ($('dwConnect')) $('dwConnect').onclick = () => { closeDrawer(); connectWallet(); };
  if ($('dwCopy')) $('dwCopy').onclick = async () => {
    if (await copyText(account || '')) toast(t('wallet.copied'), 'ok', 1600);
  };
  if ($('dwDisconnect')) $('dwDisconnect').onclick = () => { closeDrawer(); disconnectWallet(); };

  const copyAddr = async () => { if (await copyText(account || '')) toast(t('wallet.copied'), 'ok', 1600); };
  if ($('sbCopy')) $('sbCopy').onclick = copyAddr;
  if ($('acctCopy')) $('acctCopy').onclick = copyAddr;
  if ($('sbDisconnect')) $('sbDisconnect').onclick = () => disconnectWallet();
  if ($('acctDisconnect')) $('acctDisconnect').onclick = () => disconnectWallet();
  if ($('acctConnect')) $('acctConnect').onclick = () => connectWallet();
  if ($('walletMenu')) $('walletMenu').addEventListener('click', (e) => { if (e.target.closest('.wm-acct')) closeWalletMenu(); });

  for (const b of document.querySelectorAll('#homeDims button')) b.onclick = () => { homeDim = b.dataset.hdim; if (_marketCache) renderHomeList(_marketCache); };

  for (const th of document.querySelectorAll('#marketsTable th.sortable')) th.onclick = () => {
    const k = th.dataset.sort;
    mktSort = !mktSort || mktSort.key !== k ? { key: k, dir: -1 } : mktSort.dir === -1 ? { key: k, dir: 1 } : null;
    refreshMarkets();
  };

  if ($('tradeFav')) $('tradeFav').onclick = (e) => { e.stopPropagation(); if (curPair) $('tradeFav').classList.toggle('on', toggleFav(curPair.pairId)); };
  for (const b of document.querySelectorAll('#ppDims button')) b.onclick = (e) => { e.stopPropagation(); ppDim = b.dataset.ppdim; renderTradePicker($('tradePairSearch')?.value || ''); };
  if ($('ppClose')) $('ppClose').onclick = (e) => { e.stopPropagation(); closeTradePicker(); };

  if ($('sumToggle')) $('sumToggle').onclick = () => $('sumCard')?.classList.toggle('closed');

  const placeSummary = () => {
    const w = $('sumWrap'); if (!w) return;
    const dst = isMobile() ? $('sumSlot') : $('orderForm');
    if (!dst) return;
    if (isMobile()) { if (w.parentNode !== dst) dst.appendChild(w); }
    else if (w.parentNode !== dst) dst.insertBefore(w, $('submit'));
  };
  placeSummary();
  window.matchMedia && window.matchMedia('(max-width:640px)').addEventListener('change', () => { placeSummary(); renderOrders(); requestAnimationFrame(() => drawChart()); });

  if ($('modalClose')) $('modalClose').onclick = closeModal;
  if ($('modalScrim')) $('modalScrim').onclick = closeModal;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  for (const b of document.querySelectorAll('#acctTabs button')) b.onclick = () => setAcctTab(b.dataset.atab);
  for (const b of document.querySelectorAll('#pnlSeries button')) b.onclick = () => {
    pnlSeriesKey = b.dataset.series; for (const x of document.querySelectorAll('#pnlSeries button')) x.classList.toggle('on', x === b); drawPnl();
  };
  for (const b of document.querySelectorAll('#pnlRange button')) b.onclick = () => {
    pnlRange = Number(b.dataset.range); for (const x of document.querySelectorAll('#pnlRange button')) x.classList.toggle('on', x === b); drawPnl();
  };
  const pc = $('pnlChart');
  if (pc) {
    const at = (e) => { const r = pc.getBoundingClientRect(); const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; drawPnl(cx); };
    pc.addEventListener('mousemove', at);
    pc.addEventListener('mouseleave', () => drawPnl());
    pc.addEventListener('touchstart', at, { passive: true });
    pc.addEventListener('touchmove', at, { passive: true });
    pc.addEventListener('touchend', () => drawPnl());
  }
  window.addEventListener('resize', () => { if (view === 'account') drawPnl(); });
  for (const b of document.querySelectorAll('#colorSeg button')) b.onclick = () => {
    try { localStorage.setItem('sordex.colors', b.dataset.colors); } catch {}
    applyColors();
    try { renderBook(); } catch {}
  };
  for (const b of document.querySelectorAll('#themeSeg button')) b.onclick = () => setTheme(b.dataset.theme);
  const tb = $('themeBtn'); if (tb) tb.onclick = () => setTheme(getTheme() === 'light' ? 'dark' : 'light');

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  for (const b of document.querySelectorAll('#mtabs button')) {
    b.onclick = () => {
      const v = $('viewTrade');
      if (v) v.dataset.mtab = b.dataset.mtab;
      for (const x of document.querySelectorAll('#mtabs button')) x.classList.toggle('on', x === b);

      if (b.dataset.mtab === 'chart') requestAnimationFrame(() => drawChart());
    };
  }

  const openSheet = (s, keepSide) => {
    const el = $('orderSheet');
    if (!el) return;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (s && s !== side) {
      side = s;
      for (const x of document.querySelectorAll('#sideTabs button')) x.classList.toggle('on', x.dataset.side === side);
      setErr(''); refreshSubmitLabel(); prefillPrice(); updateSummary(); refreshBalances();
    }
  };
  const closeSheet = () => {
    $('orderSheet')?.classList.remove('open');
    document.body.style.overflow = '';
  };
  if ($('tbBuy')) $('tbBuy').onclick = () => openSheet('buy');
  if ($('tbSell')) $('tbSell').onclick = () => openSheet('sell');
  if ($('sheetBackdrop')) $('sheetBackdrop').onclick = closeSheet;
  if ($('sheetClose')) $('sheetClose').onclick = closeSheet;

  const searchInput = $('pairSearch');
  const searchList = $('pairSearchList');
  let searchIdx = -1;
  const renderSearch = () => {
    if (!searchList) return;
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) { searchList.hidden = true; searchList.innerHTML = ''; return; }
    const hits = pairs.filter((p) => {
      const b = (p.baseSymbol || '').toLowerCase(), q2 = (p.quoteSymbol || '').toLowerCase();
      return b.includes(q) || q2.includes(q) || String(p.pairId) === q;
    }).slice(0, 8);
    if (!hits.length) {
      searchList.innerHTML = `<div class="sempty">${esc(t('wallet.noResult'))}</div>`;
    } else {
      searchList.innerHTML = hits.map((p, i) => `<div class="sitem" data-pid="${esc(p.pairId)}" data-i="${i}">
        <span class="sym">${esc((p.baseSymbol || p.base.slice(0, 6)) + '/' + (p.quoteSymbol || 'USDT'))}</span>
        <span class="px">#${esc(p.pairId)}</span></div>`).join('');
      searchIdx = -1;
      for (const it of searchList.querySelectorAll('.sitem')) {
        it.onclick = () => { searchInput.value = ''; searchList.hidden = true; navTo('/trade/' + it.dataset.pid); };
      }
    }
    searchList.hidden = false;
  };
  if (searchInput) {
    searchInput.oninput = renderSearch;
    searchInput.onfocus = renderSearch;
    searchInput.onkeydown = (e) => {
      const items = [...(searchList?.querySelectorAll('.sitem') || [])];
      if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        searchIdx = (searchIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle('on', i === searchIdx));
      } else if (e.key === 'Enter') {
        const target = items[searchIdx >= 0 ? searchIdx : 0];
        if (target) target.click();
      } else if (e.key === 'Escape') {
        searchList.hidden = true; searchInput.blur();
      }
    };
  }
  document.addEventListener('click', (e) => {
    if (searchList && !e.target.closest('.searchwrap')) searchList.hidden = true;
  });

  if ($('connect')) {
    const orig = $('connect').onclick;
    $('connect').onclick = (e) => {
      if (account) {
        e.stopPropagation();
        const m = $('walletMenu'); if (!m) return;
        const willShow = m.hidden;
        m.hidden = !willShow;
        const s = $('walletScrim'); if (s) s.hidden = !willShow;
        if (willShow) refreshWalletMenu();
      } else orig?.();
    };
  }
  if ($('walletScrim')) $('walletScrim').onclick = closeWalletMenu;
  document.addEventListener('click', (e) => {
    const m = $('walletMenu');
    if (m && !m.hidden && !e.target.closest('#walletMenu') && !e.target.closest('#connect')) closeWalletMenu();
  });
  if ($('wmCopy')) $('wmCopy').onclick = async () => {
    if (await copyText(account || '')) toast(t('wallet.copied'), 'ok', 1600);
  };
  if ($('wmDisconnect')) $('wmDisconnect').onclick = () => disconnectWallet();

  for (const b of document.querySelectorAll('[data-pxstep]')) {
    b.onclick = () => {
      const dir = Number(b.dataset.pxstep);
      let p = Number($('price').value || 0);
      if (!(p > 0)) p = effPrice();

      const tick = Math.max(Number(curPair?.tick) || 0, 10 ** -priceTickDecimals(String(p))) || 0.0001;
      const np = Math.max(0, p + dir * tick);
      $('price').value = fmt(np, priceDp());
      recalcTotalFromQty();
    };
  }

  for (const b of document.querySelectorAll('[data-qtystep]')) {
    b.onclick = () => {
      const dir = Number(b.dataset.qtystep);
      const q = Number($('qty').value || 0);
      const step = q > 0 ? Math.pow(10, Math.floor(Math.log10(q)) - 1) : 1;
      const nq = Math.max(0, q + dir * step);
      $('qty').value = nq > 0 ? String(Number(nq.toFixed(Math.min(8, decimalsBase)))) : '';
      setErr(''); recalcTotalFromQty();
    };
  }

  if ($('typeSel')) $('typeSel').onchange = (e) => document.querySelector(`#typeSeg button[data-type="${e.target.value}"]`)?.click();

  setQtyUnit();
}

function setQtyUnit() {
  const u = $('qtyUnit');
  if (u) u.textContent = curPair?.baseSymbol || t('order.sizeUnit');
}

async function boot() {
  bind();
  applyColors();
  applyTheme();
  applyLang();
  syncStatusBar();
  refreshSubmitLabel();
  renderStatus();

  router();

  pub.getBlockNumber()
    .then(() => { nodeOk = true; })
    .catch(() => { nodeOk = false; })
    .finally(() => renderStatus());

  await loadPairs();
  router();

  let lastRefreshAt = 0, liveOk = false, liveWs = null, liveRetry = 0, lastLiveMsg = 0, liveDebounce = null;
  const refreshView = () => {
    lastRefreshAt = Date.now();
    if (view === 'trade') { refreshBook(); refreshTrades(); refreshCandles(); }
    else if (view === 'token') {
      refreshBook(); refreshTrades();
      refreshCandles().then(() => { drawChart('tkChart', 'tkLegend'); renderTkTrades(); });
    }
  };
  const scheduleRefresh = () => {
    if (liveDebounce || document.hidden) return;
    liveDebounce = setTimeout(() => { liveDebounce = null; refreshView(); }, 150);
  };
  const scheduleReconnect = () => {
    const d = Math.min(30000, 1000 * 2 ** Math.min(liveRetry++, 5)) * (0.7 + Math.random() * 0.6);
    setTimeout(connectLive, d);
  };
  function connectLive() {
    if (typeof WebSocket === 'undefined') return;
    let ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + CONFIG.apiBase + '/ws'); }
    catch { scheduleReconnect(); return; }
    liveWs = ws;
    ws.onopen = () => { liveRetry = 0; lastLiveMsg = Date.now(); };
    ws.onmessage = (ev) => {
      lastLiveMsg = Date.now();
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'hello') { liveOk = true; scheduleRefresh(); return; }
      if (m.type !== 'update') return;
      if (Array.isArray(m.pairs) && curPair && !m.pairs.includes(String(curPair.pairId))) return;
      scheduleRefresh();
    };
    ws.onclose = () => { if (liveWs === ws) { liveOk = false; liveWs = null; scheduleReconnect(); } };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  connectLive();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshView(); });
  setInterval(() => {
    if (document.hidden) return;

    if (liveOk && liveWs && Date.now() - lastLiveMsg > 70000) { try { liveWs.close(); } catch {} return; }
    const every = liveOk ? 60000 : 3000;
    if (Date.now() - lastRefreshAt >= every - 500) refreshView();
  }, 3000);

  if (window.ethereum) {
    const accts = await window.ethereum.request({ method: 'eth_accounts' }).catch(() => []);
    if (accts.length) await connectWallet();
  }
}

boot();
