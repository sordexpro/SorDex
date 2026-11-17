# Market Maker Integration: Contract Calls and API Key

[中文](#中文说明)

This guide explains how a market maker connects to SorDex on BNB Chain. Your funds stay in your own address. You only grant an allowance to the settlement contract, then quote with your own bot through the API.

The flow has two parts:

1. **Authorize (on-chain).** The **funding address** calls the contracts below. The funding address can be a regular wallet (EOA), a Safe multisig, or a treasury contract. Every option uses the same calls; each executes them its own way.
2. **Get an API key (off-chain signature, no gas).** The **private-key address that signs your quotes** signs one message to receive an API key. Your bot sends this key with its quotes.

The SorDex web app at `/mm` generates every parameter below from a simple form, with copy buttons, a Safe Transaction Builder file, and ready-to-run `cast` commands.

## Contracts (BNB Chain mainnet, chainId 56)

| Contract | Address |
|---|---|
| SignedQuoteSettler (settlement) | `0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d` |
| ListingRegistry (pairs) | `0xBCb5f317FDeEeC3D5A98a98A99d6d60E849EA477` |
| USDT (quote token) | `0x55d398326f99059fF775485246999027B3197955` |

All contracts are verified on BscScan. Pair IDs and base token addresses come from `GET /api/pairs`. Only pairs with `listingComplete: true` are open for market making.

## Who executes what

| Funding address type | How to run the calls | Who signs quotes |
|---|---|---|
| Regular wallet (EOA) | Send each transaction from the wallet | The wallet itself, or a separate signing address |
| Safe multisig | Bundle all calls into one Safe transaction (Transaction Builder) | A separate signing address (a Safe cannot sign quotes) |
| Treasury contract | Through the contract's own execute / governance function, using the `to` and `data` below | A separate signing address |

Every call must be sent **by the funding address itself** (`msg.sender` = funding address).

## Step 1: Authorize

Run the calls in this order.

### 1. Approve the base token

```
to:       <base token address of the pair>
function: approve(address spender, uint256 amount)
spender:  0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d   (settlement contract)
amount:   token amount in smallest units (amount × 10^decimals)
```

The settlement contract can move at most this amount from the funding address when your sell quotes fill. Approve only what you plan to use for market making.

### 2. Approve USDT

Same as above, with `to` = USDT (`0x55d398326f99059fF775485246999027B3197955`, 18 decimals). This caps what your buy quotes can spend.

### 3. Switch to "funds stay in my address"

```
to:       0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d
function: setCustody(uint8 mode)
mode:     1   (1 = funds stay in the funding address; 0 = market maker vault)
```

Fills are paid directly from the funding address within the allowances. This setting applies to **all pairs** of the funding address, and it cancels every quote the address signed before.

### 4. Set the signing address (only if another address signs your quotes)

Skip this step if the funding address is a regular wallet that signs its own quotes. A Safe or treasury contract must set one.

```
to:       0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d
function: setAgent(address agent, uint64 expiry)
agent:    the private-key address that signs quotes
expiry:   Unix timestamp (seconds) when the authorization ends, e.g. now + 180 days
```

The signing address can only sign quotes. It cannot withdraw or transfer funds. It stops working at `expiry`, and you can revoke it at any time (see below).

### 5. Set the price range (required when a signing address is used)

Quotes signed by a signing address only fill inside this range, so a leaked key cannot trade at absurd prices.

```
to:       0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d
function: setPriceBand(uint256 pairId, uint256 minNum, uint256 minDen, uint256 maxNum, uint256 maxDen)
```

Prices are fractions in **smallest units**: `price_raw = price_in_USDT × 10^(quoteDecimals − baseDecimals)`, written as `num / den`.

Example: an 18-decimal token, USDT (18 decimals), range 0.0000006 to 0.0000024 USDT:

```
minNum = 600000   minDen = 1000000000000   (0.0000006)
maxNum = 240000   maxDen = 100000000000    (0.0000024)
```

Any equivalent fraction works. The minimum must not exceed the maximum. To change the range later, call `setPriceBand` again.

### Revoke

| Purpose | Call |
|---|---|
| Stop the settlement contract from moving a token | `approve(settlement, 0)` on that token |
| Remove a signing address | `setAgent(agent, 0)`. Its quotes, including unexpired ones, are cancelled immediately |

### Example with `cast` (regular wallet)

```bash
SETTLER=0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d
RPC=https://bsc-dataseed.binance.org
cast send $TOKEN "approve(address,uint256)" $SETTLER 1000000000000000000000000 --rpc-url $RPC --private-key $PRIVATE_KEY
cast send 0x55d398326f99059fF775485246999027B3197955 "approve(address,uint256)" $SETTLER 500000000000000000 --rpc-url $RPC --private-key $PRIVATE_KEY
cast send $SETTLER "setCustody(uint8)" 1 --rpc-url $RPC --private-key $PRIVATE_KEY
# Only if another address signs quotes:
cast send $SETTLER "setAgent(address,uint64)" $SIGNER $(( $(date +%s) + 180*86400 )) --rpc-url $RPC --private-key $PRIVATE_KEY
cast send $SETTLER "setPriceBand(uint256,uint256,uint256,uint256,uint256)" $PAIR_ID 600000 1000000000000 240000 100000000000 --rpc-url $RPC --private-key $PRIVATE_KEY
```

### Example with Safe

Open Safe → Apps → Transaction Builder and add the calls above (or drag in the batch file generated by the SorDex `/mm` page). Execute them as **one** Safe transaction. The file format is:

```json
{
  "version": "1.0",
  "chainId": "56",
  "meta": { "name": "SORDEX market maker setup" },
  "transactions": [
    { "to": "<token>", "value": "0", "data": "0x095ea7b3…" },
    { "to": "0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d", "value": "0", "data": "0x…" }
  ]
}
```

## Step 2: Get an API key

The **signing address** connects to the SorDex `/mm` page and signs once. The page checks eligibility first. A signer is eligible if any of these holds:

- it is the funding address itself;
- the funding address authorized it with `setAgent` (and the authorization has not expired);
- the funding address is a Safe and the signer is one of its owners.

The key is bound to the **funding address** and to an IP allowlist. It is shown **once**. The server stores only its hash, so a lost key cannot be recovered; sign again to rotate it, which invalidates the old key.

### Signing the request yourself

`POST /api/mm/issue` with an EIP-712 signature:

```
domain:  { name: "SorDexMMAccess", version: "1", chainId: 56, verifyingContract: <settlement contract> }
type:    MMAccess(address maker, string action, string ips, uint256 deadline, uint256 nonce)
message: maker = funding address, action = "issue", ips = allowlist joined by ";",
         deadline = Unix seconds (at most 1 hour ahead), nonce = any increasing number (e.g. milliseconds)
body:    { maker, ips: [..], signature, deadline, nonce, label?, contactEmail? }
```

Response: `{ ok: true, apiKey: "sdx_mk_…" }`.

### Quoting

Send signed quotes to `POST /api/quote` or `POST /api/quote/batch` with the header `x-mm-key: <your key>`, from an allowlisted IP. Quote fields and the EIP-712 quote type are documented on the SorDex API page (`/api.html`).

Quotes signed by a signing address must:

- carry an expiry no more than 1 hour ahead;
- fall inside the price range from step 5.

## Risk notes

- Your maximum exposure equals the allowances you grant. Keep them to what you use for market making.
- If a signing key leaks, trades can only happen within your allowances and price range. Revoke it with `setAgent(agent, 0)`.
- A treasury contract with time-locked governance needs a proposal for every change (allowance, range, renewal). Set a wide enough range and a long enough expiry.
- If your treasury holds vesting or locked tokens, confirm they are transferable before approving; otherwise fills will fail and your quotes will be skipped.

---

## 中文说明

做市商的资金始终留在自己的地址里，只给结算合约授权额度，然后用自己的程序通过 API 报价。

接入分两步：

1. **授权（链上）**：由**资金地址**调用下面的合约。资金地址可以是普通钱包、Safe 多签或金库合约，三种情况的调用完全相同，各自按自己的方式执行。
2. **获取 API Key（链下签名，不花 gas）**：由**签报价的私钥地址**签一次名领取，做市程序报价时带上这个 Key。

SorDex 网页的 `/mm` 页面可以根据表单自动生成下面所有参数，提供复制按钮、Safe 批量交易文件和可直接运行的 `cast` 命令。

**合约地址**（BNB Chain 主网）：
- 结算合约 SignedQuoteSettler：`0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d`
- USDT：`0x55d398326f99059fF775485246999027B3197955`
- 交易对编号和代币地址从 `GET /api/pairs` 取；只有 `listingComplete: true` 的交易对可以做市。

**授权步骤**（都必须由资金地址发出）：

| 顺序 | 调用 | 说明 |
|---|---|---|
| 1 | 代币 `approve(结算合约, 数量)` | 数量按代币精度换算成最小单位；卖单最多卖出这么多 |
| 2 | USDT `approve(结算合约, 数量)` | 买单最多花掉这么多 |
| 3 | 结算合约 `setCustody(1)` | 改为"资金留在自己地址"。对资金地址的所有交易对生效，执行后之前签过的报价全部作废 |
| 4 | 结算合约 `setAgent(签报价地址, 到期时间)` | 仅当另一个私钥地址签报价时需要；Safe 和金库合约必须设置。到期时间用 Unix 秒 |
| 5 | 结算合约 `setPriceBand(交易对, 最低价分子, 分母, 最高价分子, 分母)` | 使用签报价地址时必须设置。价格用最小单位的分数表示：`原始价格 = USDT 价格 × 10^(USDT 精度 − 代币精度)` |

**撤销**：
- 授权额度归零：对该代币调用 `approve(结算合约, 0)`。
- 取消签报价地址：调用 `setAgent(地址, 0)`。这个地址签过的报价，包括还没过期的，立即全部作废。

**获取 API Key**：
- 用签报价的私钥地址连接 `/mm` 页面签一次名。能签名领取的有三种：资金地址本人；被资金地址用 `setAgent` 授权、且还没过期的地址；资金地址是 Safe 时，它的任一签名人。
- Key 绑定资金地址和 IP 白名单，只在领取时显示一次。服务器只保存哈希，丢了只能重新签名领一把新的，旧的随即失效。

**风险提示**：
- 授权额度就是最大风险敞口。
- 签报价的私钥泄露时，成交也只会发生在授权额度和价格区间之内，应立即用 `setAgent(地址, 0)` 撤销。
- 金库合约如果走时间锁治理，每次调整都要走提案流程，价格区间和有效期建议设得宽一些。
