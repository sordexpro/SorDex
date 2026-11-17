import { createPublicClient, http, parseAbi, formatUnits, encodeFunctionData } from '/viem.js';

const DATA = {"usdt":"0x55d398326f99059fF775485246999027B3197955","gens":[{"key":"2026-11-16 16:12","vaultAbi":2,"vault":"0xbc9AfB855Ec6A24C430504Dc72AC2D99d52d35bD","book":"0xc897cE69696518b4022ECa19dC44c8938e63323F","feeVault":"0xe6a35036e78708fb5ad8618Cc207FD5E02E03d02","pairs":[{"pairId":1,"base":"0x21577b2079bf9cB9eb76F457ED049A239686767b","sym":"CLNA","dec":18},{"pairId":2,"base":"0xbA2aE424d960c26247Dd6c32edC70B295c744C43","sym":"DOGE","dec":8}]},{"key":"2026-11-16 00:53","vaultAbi":2,"vault":"0x395Db5a85087662e1b8923CFCa8f78b498167137","book":"0xa57FAC81aa052fE5020c95C5908F4940A9a65AaF","feeVault":"0x8163fCf402698b8Eb4Ac40292488B6Bb17a040cb","pairs":[{"pairId":1,"base":"0x2F53124E83C973ae505D888c88F502B823ed93ae","sym":"SDLQ","dec":18},{"pairId":2,"base":"0xc6604F07F188aBa25Cb95BF9F068D5Bd4cbbfD6a","sym":"CLNB","dec":18}]},{"key":"2026-11-13 22:25","vaultAbi":2,"vault":"0x3FF36db4c5Ff2F2Aea774BD5311b195Ce9C07335","book":"0xA2542763D51879AE43091E5b50e7EA00Db9085dd","feeVault":"0x0C0E749Ba496065521325471d33b2c40aF02b058","pairs":[{"pairId":1,"base":"0x243C34C478e92610abD1781a3418e02bfc0aA822","sym":"CLNC","dec":18},{"pairId":2,"base":"0x2F53124E83C973ae505D888c88F502B823ed93ae","sym":"SDLQ","dec":18},{"pairId":3,"base":"0x0fa2eB5522Af2ea6fc270B62809B161273478194","sym":"TAXX","dec":18}]},{"key":"2026-11-13 17:18","vaultAbi":2,"vault":"0xe23e938Bc2313e2859c8a28adBc59871c7Cac55B","book":"0x36088C1E7A80D2B9ceA2706e7af06504e0FC77b7","feeVault":"0xEa25E736c113e2881E2d3229802B49297d62f6a6","pairs":[{"pairId":1,"base":"0xA24D15530EAaD8F5F992A61FeD58d664d39964A6","sym":"TX6","dec":6},{"pairId":2,"base":"0x9bc682779eBF5E0C71F443D62648AD336308C6c7","sym":"BRNT","dec":18},{"pairId":3,"base":"0x2F53124E83C973ae505D888c88F502B823ed93ae","sym":"SDLQ","dec":18}]},{"key":"2026-11-13 11:13","vaultAbi":2,"vault":"0x6A5fae9e6177bC9e86b8F42b8095b53221870826","book":"0x8dB94C0c2dFA4940b6f380723C599E68501eb73F","feeVault":"0xd23a3F4fBbf1058aC4A6693c8F2d33a661AA615F","pairs":[{"pairId":1,"base":"0x274676f186ca1e87b299136aFB87ad0EC1675eE8","sym":"TAX3","dec":18},{"pairId":2,"base":"0x0e46b017F776De39C1c2Baaa447ace3652AA283A","sym":"SIX6","dec":6},{"pairId":3,"base":"0x6661022DAB5739C843929d0F774b163a4A8025cD","sym":"TAX5","dec":18},{"pairId":4,"base":"0x06FB2ef331e4c9aD117aB5120B0c13fa04d0E7BA","sym":"TX6","dec":6}]},{"key":"2026-11-11 14:05","vaultAbi":1,"vault":"0xaeA5721979E0123515993d201091A6FBb93a0767","book":"0xB5717726afC9B32dB3Db169aFED22C607B2a0183","feeVault":"0x9d6035f1F8deFEC0E74032b26Fc8AE2a124859F7","pairs":[{"pairId":1,"base":"0x0deB6636620252f6C4Cb90D1b21772eB630f16A9","sym":"TF","dec":18},{"pairId":2,"base":"0xF08D1886E2A69dfaBd22a45Eed8e1407B338B97e","sym":"RADR","dec":18},{"pairId":3,"base":"0xF08D1886E2A69dfaBd22a45Eed8e1407B338B97e","sym":"RADR","dec":18},{"pairId":4,"base":"0xD1E10775F931a711032DBf4c18494B57b650A417","sym":"MI","dec":18},{"pairId":5,"base":"0x816Ce9ff05C91f42032FF9199A78A53117530679","sym":"CLNA","dec":18},{"pairId":6,"base":"0xc6604F07F188aBa25Cb95BF9F068D5Bd4cbbfD6a","sym":"CLNB","dec":18},{"pairId":7,"base":"0x9D45ce6B1A04016D2C38bfEBc4E9ac0bb514bb08","sym":"SDTT","dec":18},{"pairId":8,"base":"0xC4fAc78A0BB8163A501d746CbDc8421a405AD44B","sym":"SDTX","dec":18}]},{"key":"2026-11-11 04:02","vaultAbi":1,"vault":"0xc534a07C98cff3e9Fe420F822c38Dd7A6f8029F9","book":"0x42Ca3548FBC32d42a8ce4Fb20D6DA1d05b2D38F8","feeVault":"0x03bef9a64c870330944502Fb767FD1F959a7C3d8","pairs":[{"pairId":1,"base":"0x0deB6636620252f6C4Cb90D1b21772eB630f16A9","sym":"TF","dec":18}]},{"key":"2026-11-09 23:36","vaultAbi":1,"vault":"0x9aac1A98587584EEaDEB95414d0d76e82B597e2d","book":null,"feeVault":"0xa78e300e964e9AcCfB0AA8cFc7F903A2B0Dc1db4","pairs":[{"pairId":1,"base":"0x0deB6636620252f6C4Cb90D1b21772eB630f16A9","sym":"TF","dec":18}]},{"key":"2026-11-07 23:17","vaultAbi":1,"vault":"0x1991c9D830DB641e08A03EaF92Ce60c76AbC00d7","book":"0xf24B8a1d5F73104a7ce77237a43B9073038f3F75","feeVault":null,"pairs":[{"pairId":1,"base":"0x0deB6636620252f6C4Cb90D1b21772eB630f16A9","sym":"TF","dec":18}]},{"key":"2026-11-06 18:22","vaultAbi":0,"vault":null,"book":"0x187FFdAA8aa888fC4E687b1bEFad82D294ac80Fc","feeVault":"0x7108526332c6f70B214ea56F9b8378D9cdbbB4fD","pairs":[]}],"orders":[{"gen":"2026-11-06 18:22","book":"0x187FFdAA8aa888fC4E687b1bEFad82D294ac80Fc","id":1,"owner":"0x84b5E65467AB34671Aa7B3753300C9839753189C","pairId":1},{"gen":"2026-11-13 11:13","book":"0x8dB94C0c2dFA4940b6f380723C599E68501eb73F","id":1,"owner":"0x832936E236Db28141A78c99f31A9A24D40Da7Da3","pairId":1},{"gen":"2026-11-16 00:53","book":"0xa57FAC81aa052fE5020c95C5908F4940A9a65AaF","id":17,"owner":"0x0580D53fcc45c08a109A78b5C920F2Fa8E9De600","pairId":2},{"gen":"2026-11-16 16:12","book":"0xc897cE69696518b4022ECa19dC44c8938e63323F","id":1,"owner":"0x0580D53fcc45c08a109A78b5C920F2Fa8E9De600","pairId":1},{"gen":"2026-11-16 16:12","book":"0xc897cE69696518b4022ECa19dC44c8938e63323F","id":3,"owner":"0x5C06F91607e430120c61d3B6F7C55859A1aFED0B","pairId":1}]};
const USDT = DATA.usdt;
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const RPC = (window.__SORDEX__ && window.__SORDEX__.rpc) || '/rpc';
const CHAIN = { id: 56, name: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: MULTICALL3 } } };
const pub = createPublicClient({ chain: CHAIN, transport: http(RPC) });

const V1 = parseAbi([
  'function availableOf(address mm, address token) view returns (uint256)',
  'function pendingWithdraw(address mm, address token) view returns (uint256)',
  'function unlockAt(address mm, address token) view returns (uint256)',
  'function requestWithdraw(address token, uint256 amount)',
  'function executeWithdraw(address token)',
  'function cancelWithdraw(address token)',
]);
const V2 = parseAbi([
  'function availableOf(address mm, uint256 pairId, address token) view returns (uint256)',
  'function pendingWithdraw(address mm, uint256 pairId, address token) view returns (uint256)',
  'function unlockAt(address mm, uint256 pairId, address token) view returns (uint256)',
  'function requestWithdraw(uint256 pairId, address token, uint256 amount)',
  'function executeWithdraw(uint256 pairId, address token)',
  'function cancelWithdraw(uint256 pairId, address token)',
]);
const FEE = parseAbi(['function claimable(address account, address token) view returns (uint256)', 'function claim(address token, address receiver) returns (uint256)']);
const BOOK = parseAbi(['function cancelOrder(uint256 id)']);

const I18N = {
  zh: {
    back: '返回 SORDEX', title: '历史合约资产取回',
    sub: 'SORDEX 升级过几次合约。如果你曾在旧版本里存入做市资金、挂单，或有没领的手续费，这些资产仍然属于你，可以在这里取回。',
    wallet: '钱包', connect: '连接钱包', refresh: '重新查询', notConnected: '未连接',
    howTitle: '怎么取回',
    how1: '做市金库：先点「申请提现」，等锁定期结束后点「完成提现」，资产回到你的钱包。锁定期内可以随时取消。',
    how2: '旧挂单：点「撤单」，挂单里锁定的资产会直接退回你的钱包。',
    how3: '手续费：点「领取」，直接转到你的钱包。',
    how4: '每一步都是你自己的钱包签名发出的链上交易，需要少量 BNB 付手续费。平台不经手你的资产。',
    hint: '请连接你当初在 SORDEX 使用的钱包。',
    noWallet: '没有检测到钱包。请在装有钱包插件的浏览器里打开，或在钱包 App 内置的浏览器里打开本页。',
    connectFail: '钱包没有连接成功，请重试。',
    switchChain: '请在钱包里切换到 BNB 智能链（BSC）后再操作。',
    scanning: '正在查询历史合约里的资产…',
    scanFail: '查询没有完成，可能是网络不稳定，请点「重新查询」。',
    none: '这个钱包在历史合约里没有可以取回的资产。',
    found: '找到 {n} 项可以取回的资产。',
    secVault: '做市金库', secOrders: '旧挂单', secFee: '可领手续费',
    gen: '{t} 版本', pair: '交易对 #{id}',
    avail: '可提现', pending: '提现中', unlockAt: '解锁时间', unlocked: '已解锁，可以完成提现',
    req: '申请提现', exec: '完成提现', cancel: '取消提现', cancelOrder: '撤单', claim: '领取',
    orderLabel: '挂单 #{id}', orderNote: '撤单后，挂单里锁定的资产会退回你的钱包。',
    feeAmt: '可领取',
    confirm: '请在钱包里确认…', waiting: '交易已发出，正在等待链上确认…',
    okReq: '已申请提现。锁定期结束后，回到这里点「完成提现」。',
    okExec: '提现完成，资产已回到你的钱包。', okCancel: '已取消提现，资产回到可提现余额。',
    okOrder: '已撤单，锁定的资产已退回你的钱包。', okClaim: '已领取，手续费已转到你的钱包。',
    notYet: '还没到解锁时间，请在 {t} 之后再来完成提现。',
    rejected: '你在钱包里取消了这次操作。',
    noGas: '钱包里的 BNB 不够付手续费，请先转入少量 BNB 再试。',
    willFail: '这笔操作在链上会失败，可能状态已经变了。请点「重新查询」后再试。',
    failed: '交易没有成功，资产没有变化。请稍后再试，如果一直失败请联系平台。',
    genericFail: '操作没有成功，请稍后再试。如果一直失败，请联系平台。',
  },
  en: {
    back: 'Back to SORDEX', title: 'Recover assets from earlier contracts',
    sub: 'SORDEX has upgraded its contracts a few times. If you deposited market-making funds, placed orders, or earned fees on an earlier version, those assets are still yours and you can recover them here.',
    wallet: 'Wallet', connect: 'Connect wallet', refresh: 'Check again', notConnected: 'Not connected',
    howTitle: 'How it works',
    how1: 'Market-making vault: tap "Request withdrawal", wait for the lock period to end, then tap "Complete withdrawal" and the assets go back to your wallet. You can cancel at any time during the lock period.',
    how2: 'Earlier orders: tap "Cancel order" and the assets locked in the order go straight back to your wallet.',
    how3: 'Fees: tap "Claim" to send them straight to your wallet.',
    how4: 'Every step is an on-chain transaction signed by your own wallet and needs a little BNB for gas. The platform never handles your assets.',
    hint: 'Connect the wallet you used on SORDEX.',
    noWallet: 'No wallet found. Open this page in a browser with a wallet extension, or in the built-in browser of your wallet app.',
    connectFail: "Your wallet didn't connect. Please try again.",
    switchChain: 'Please switch your wallet to BNB Smart Chain (BSC) and try again.',
    scanning: 'Checking earlier contracts for your assets…',
    scanFail: "The check didn't finish, probably because of a network hiccup. Tap \"Check again\".",
    none: 'This wallet has nothing to recover from earlier contracts.',
    found: 'Found {n} item(s) you can recover.',
    secVault: 'Market-making vault', secOrders: 'Earlier orders', secFee: 'Claimable fees',
    gen: 'Version of {t}', pair: 'Pair #{id}',
    avail: 'Available to withdraw', pending: 'Withdrawal in progress', unlockAt: 'Unlocks at', unlocked: 'Unlocked, ready to complete',
    req: 'Request withdrawal', exec: 'Complete withdrawal', cancel: 'Cancel withdrawal', cancelOrder: 'Cancel order', claim: 'Claim',
    orderLabel: 'Order #{id}', orderNote: 'Cancelling returns the assets locked in this order to your wallet.',
    feeAmt: 'Claimable',
    confirm: 'Please confirm in your wallet…', waiting: 'Transaction sent, waiting for on-chain confirmation…',
    okReq: 'Withdrawal requested. Come back after the lock period ends and tap "Complete withdrawal".',
    okExec: 'Withdrawal complete. The assets are back in your wallet.', okCancel: 'Withdrawal cancelled. The assets are back in your available balance.',
    okOrder: 'Order cancelled. The locked assets are back in your wallet.', okClaim: 'Claimed. The fees are now in your wallet.',
    notYet: 'Not unlocked yet. Please come back after {t} to complete the withdrawal.',
    rejected: 'You cancelled this in your wallet.',
    noGas: "Your wallet doesn't have enough BNB for gas. Please add a little BNB and try again.",
    willFail: 'This would fail on-chain, probably because something has changed. Tap "Check again" and retry.',
    failed: "The transaction didn't go through and nothing changed. Please try again later, and contact us if it keeps failing.",
    genericFail: "That didn't work. Please try again later, and contact us if it keeps failing.",
  },
};
let lang = (() => { try { return localStorage.getItem('sordex.lang') || ''; } catch { return ''; } })() || (/^zh/i.test(navigator.language || '') ? 'zh' : 'en');
if (!I18N[lang]) lang = 'zh';
const t = (k, vars) => String(I18N[lang][k] ?? I18N.zh[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => (vars && vars[v] != null ? vars[v] : ''));

const $ = (id) => document.getElementById(id);
let account = null, lastScan = null, msgState = { key: 'hint', cls: 'muted', vars: null };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function say(key, cls = 'muted', vars = null) { msgState = { key, cls, vars }; const m = $('msg'); m.textContent = key ? t(key, vars) : ''; m.className = 'msg ' + cls; }

function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title') + ' · SORDEX';
  for (const n of document.querySelectorAll('[data-t]')) n.textContent = t(n.dataset.t);
  for (const b of document.querySelectorAll('.lang button')) b.classList.toggle('on', b.dataset.lang === lang);
  $('acct').textContent = account ? account.slice(0, 6) + '…' + account.slice(-4) : t('notConnected');
  $('connect').hidden = !!account;
  say(msgState.key, msgState.cls, msgState.vars);
  if (lastScan) render(lastScan);
}

function fmtTs(sec) {
  const d = new Date(Number(sec) * 1000), p = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const tz = 'UTC' + (off >= 0 ? '+' : '-') + Math.floor(Math.abs(off) / 60) + (Math.abs(off) % 60 ? ':' + p(Math.abs(off) % 60) : '');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} (${tz})`;
}
const fmtAmt = (v, dec) => { const s = formatUnits(v, dec); const [i, f = ''] = s.split('.'); return f ? `${i}.${f.slice(0, 6).replace(/0+$/, '')}`.replace(/\.$/, '') : i; };
const tokenOf = (gen, addr) => {
  if (addr.toLowerCase() === USDT.toLowerCase()) return { sym: 'USDT', dec: 18 };
  const p = gen.pairs.find((x) => x.base.toLowerCase() === addr.toLowerCase());
  return p ? { sym: p.sym, dec: p.dec } : { sym: addr.slice(0, 6) + '…', dec: 18 };
};
const pairSym = (gen, id) => { const p = gen.pairs.find((x) => x.pairId === id); return p ? `${p.sym}/USDT` : t('pair', { id }); };

async function ensureChain() {
  const id = await window.ethereum.request({ method: 'eth_chainId' }).catch(() => null);
  if (id && parseInt(id, 16) === 56) return true;
  try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] }); } catch { say('switchChain', 'bad'); return false; }
  const id2 = await window.ethereum.request({ method: 'eth_chainId' }).catch(() => null);
  if (id2 && parseInt(id2, 16) === 56) return true;
  say('switchChain', 'bad'); return false;
}
async function connect() {
  if (!window.ethereum) { say('noWallet', 'bad'); return; }
  try {
    const accts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accts || !accts.length) { say('connectFail', 'bad'); return; }
    account = accts[0];
    applyLang();
    await scan();
  } catch (e) { say(e && e.code === 4001 ? 'rejected' : 'connectFail', 'bad'); }
}

async function scan() {
  if (!account) { say('hint'); return; }
  say('scanning'); $('list').textContent = '';
  try {
    let nowSec = Math.floor(Date.now() / 1000);
    try { nowSec = Number((await pub.getBlock()).timestamp); } catch {}
    const items = [];
    for (const gen of DATA.gens) {
      const calls = [], meta = [];
      if (gen.vaultAbi) {
        const tokens = gen.vaultAbi === 1
          ? [...new Set([USDT, ...gen.pairs.map((p) => p.base)])].map((tok) => ({ pairId: null, tok }))
          : gen.pairs.flatMap((p) => [{ pairId: p.pairId, tok: p.base }, { pairId: p.pairId, tok: USDT }]);
        for (const x of tokens) {
          const abi = gen.vaultAbi === 1 ? V1 : V2;
          const args = gen.vaultAbi === 1 ? [account, x.tok] : [account, BigInt(x.pairId), x.tok];
          for (const fn of ['availableOf', 'pendingWithdraw', 'unlockAt']) calls.push({ address: gen.vault, abi, functionName: fn, args });
          meta.push({ kind: 'vault', ...x });
        }
      }
      if (gen.feeVault) { calls.push({ address: gen.feeVault, abi: FEE, functionName: 'claimable', args: [account, USDT] }); meta.push({ kind: 'fee' }); }
      if (!calls.length) continue;
      const r = await pub.multicall({ contracts: calls, allowFailure: true });
      let i = 0;
      for (const m of meta) {
        if (m.kind === 'vault') {
          const [a, p, u] = [r[i], r[i + 1], r[i + 2]]; i += 3;
          const avail = a.status === 'success' ? a.result : 0n, pend = p.status === 'success' ? p.result : 0n, unlock = u.status === 'success' ? u.result : 0n;
          if (avail > 0n || pend > 0n) items.push({ kind: 'vault', gen, ...m, avail, pend, unlock, ready: pend > 0n && Number(unlock) <= nowSec });
        } else {
          const c = r[i]; i += 1;
          if (c.status === 'success' && c.result > 0n) items.push({ kind: 'fee', gen, amount: c.result });
        }
      }
    }

    for (const o of DATA.orders) {
      if (o.owner.toLowerCase() !== account.toLowerCase()) continue;
      const gen = DATA.gens.find((g) => g.key === o.gen);
      try { await pub.call({ account, to: o.book, data: encodeFunctionData({ abi: BOOK, functionName: 'cancelOrder', args: [BigInt(o.id)] }) }); }
      catch { continue; }
      items.push({ ...o, kind: 'order', gen });
    }
    lastScan = items;
    render(items);
    say(items.length ? 'found' : 'none', items.length ? 'ok' : 'muted', { n: items.length });
  } catch { lastScan = null; say('scanFail', 'bad'); }
}

function render(items) {
  const list = $('list'); list.textContent = '';
  const groups = [['vault', 'secVault'], ['order', 'secOrders'], ['fee', 'secFee']];
  for (const [kind, title] of groups) {
    const rows = items.filter((x) => x.kind === kind);
    if (!rows.length) continue;
    list.appendChild(el('div', 'sec', t(title)));
    for (const it of rows) list.appendChild(card(it));
  }
}
function line(k, v) { const r = el('div', 'row'); r.appendChild(el('span', 'k', k)); r.appendChild(el('span', 'v', v)); return r; }
function card(it) {
  const c = el('div', 'card'), head = el('div', 'tok'), btns = el('div', 'btns'), cm = el('div', 'cardmsg muted');
  const genTag = (pairId) => el('span', 'tag', (pairId ? pairSym(it.gen, pairId) + ' · ' : '') + t('gen', { t: it.gen.key }));
  const btn = (key, cls, fn) => { const b = el('button', cls || '', t(key)); b.onclick = () => fn(b); btns.appendChild(b); return b; };
  if (it.kind === 'vault') {
    const tk = tokenOf(it.gen, it.tok);
    head.textContent = tk.sym; head.appendChild(genTag(it.pairId)); c.appendChild(head);
    if (it.avail > 0n) c.appendChild(line(t('avail'), `${fmtAmt(it.avail, tk.dec)} ${tk.sym}`));
    if (it.pend > 0n) {
      c.appendChild(line(t('pending'), `${fmtAmt(it.pend, tk.dec)} ${tk.sym}`));
      c.appendChild(line(t('unlockAt'), it.ready ? t('unlocked') : fmtTs(it.unlock)));
    }
    const abi = it.gen.vaultAbi === 1 ? V1 : V2;
    const base = it.gen.vaultAbi === 1 ? [it.tok] : [BigInt(it.pairId), it.tok];
    if (it.avail > 0n && !(it.pend > 0n)) btn('req', 'primary', () => send(c, it.gen.vault, abi, 'requestWithdraw', [...base, it.avail], 'okReq'));
    if (it.pend > 0n) {
      btn('exec', 'primary', () => (it.ready ? send(c, it.gen.vault, abi, 'executeWithdraw', base, 'okExec') : cmsg(c, 'notYet', 'bad', { t: fmtTs(it.unlock) })));
      btn('cancel', 'ghost', () => send(c, it.gen.vault, abi, 'cancelWithdraw', base, 'okCancel'));
    }
  } else if (it.kind === 'order') {
    head.textContent = t('orderLabel', { id: it.id }); head.appendChild(genTag(it.pairId)); c.appendChild(head);
    c.appendChild(el('div', 'note', t('orderNote')));
    btn('cancelOrder', 'primary', () => send(c, it.book, BOOK, 'cancelOrder', [BigInt(it.id)], 'okOrder'));
  } else {
    head.textContent = 'USDT'; head.appendChild(genTag(null)); c.appendChild(head);
    c.appendChild(line(t('feeAmt'), `${fmtAmt(it.amount, 18)} USDT`));
    btn('claim', 'primary', () => send(c, it.gen.feeVault, FEE, 'claim', [USDT, account], 'okClaim'));
  }
  c.appendChild(btns); c.appendChild(cm);
  return c;
}
function cmsg(c, key, cls = 'muted', vars) { const m = c.querySelector('.cardmsg'); m.textContent = t(key, vars); m.className = 'cardmsg ' + cls; }

let busy = false;
async function send(c, to, abi, fn, args, okKey) {
  if (busy || !account) return;
  busy = true;
  for (const b of document.querySelectorAll('#list button')) b.disabled = true;
  try {
    if (!(await ensureChain())) return;
    const data = encodeFunctionData({ abi, functionName: fn, args });
    try { await pub.call({ account, to, data }); } catch { cmsg(c, 'willFail', 'bad'); return; }
    cmsg(c, 'confirm');
    const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: account, to, data }] });
    cmsg(c, 'waiting');
    const rc = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (rc.status !== 'success') { cmsg(c, 'failed', 'bad'); return; }
    cmsg(c, okKey, 'ok');
    setTimeout(scan, 1500);
  } catch (e) {
    const s = String((e && (e.message || e.shortMessage)) || '').toLowerCase();
    cmsg(c, e && e.code === 4001 ? 'rejected' : /insufficient funds|gas required exceeds/.test(s) ? 'noGas' : 'genericFail', 'bad');
  } finally {
    busy = false;
    for (const b of document.querySelectorAll('#list button')) b.disabled = false;
  }
}

$('connect').onclick = connect;
$('refresh').onclick = () => (account ? scan() : connect());
for (const b of document.querySelectorAll('.lang button')) b.onclick = () => { lang = b.dataset.lang; try { localStorage.setItem('sordex.lang', lang); } catch {} applyLang(); };
applyLang();
if (window.ethereum) {
  window.ethereum.request({ method: 'eth_accounts' }).then((a) => { if (a && a.length) { account = a[0]; applyLang(); scan(); } }).catch(() => {});
}
