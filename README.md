# SorDex Frontend

The web frontend of [SorDex](https://sordexpro.com), a non-custodial spot order-book DEX on BNB Chain.

Orders lock assets in the on-chain order book, and every fill settles atomically back to the trader's wallet. The platform never holds user funds: every transaction is built in the browser and signed by the user's own wallet.

[中文说明](#中文说明)

## Features

- Spot trading with limit and market orders against the on-chain order book and signed market-maker quotes
- Quick Trade (swap) with a minimum-received guarantee
- Token listing and liquidity provision (`/pool`)
- Market-maker onboarding and API documentation (`/api.html`)
- Account overview: balances, open orders, fill history, PnL
- English and Chinese; dark and light themes
- Fee-on-transfer token support, with the tax shown before you trade

## Tech stack

Plain HTML, CSS and JavaScript (ES modules). There is no framework and no build step. [viem](https://viem.sh) handles wallet and contract interaction and is shipped as a pre-bundled browser module (`public/viem.js`).

## Project structure

```
public/
  index.html            single-page app shell
  app.js                application logic (routing, trading, wallet, i18n)
  app.css, v2.css       styles (v2.css also contains the light theme)
  theme-init.js         applies the saved theme before first paint
  config.js             contract addresses and chain settings
  api.html, api-lang.js public API documentation
  reclaim-legacy.*      asset recovery page for previous contract versions
  viem.js               bundled viem (see "Rebuilding viem.js")
scripts/
  dev-server.mjs        local static server with API proxy
  build-viem.mjs        rebuilds public/viem.js
```

## Run locally

Requires Node.js 18 or later.

```bash
git clone https://github.com/sordexpro/SorDex.git
cd SorDex
npm run dev
```

Open http://localhost:8080. The dev server serves `public/` and proxies `/api`, `/ws` and `/rpc` to the production backend at https://sordexpro.com. To use another backend, set `UPSTREAM`:

```bash
UPSTREAM=https://your-backend.example PORT=3000 npm run dev
```

Any static web server works in production, as long as:

- unknown paths fall back to `index.html` (the app uses client-side routes such as `/trade` and `/pool`);
- `/api`, `/ws` and `/rpc` are routed to a SorDex backend.

## Rebuilding viem.js

```bash
npm install
npm run build:viem
```

## Smart contracts

All contracts are deployed on BNB Chain mainnet and verified on BscScan. Their addresses are in `public/config.js`.

| Contract | Address |
|---|---|
| SettlementOrderBook | [0x3beCfBF418b46712A10a26212255B01823B81505](https://bscscan.com/address/0x3beCfBF418b46712A10a26212255B01823B81505#code) |
| ListingRegistry | [0xBCb5f317FDeEeC3D5A98a98A99d6d60E849EA477](https://bscscan.com/address/0xBCb5f317FDeEeC3D5A98a98A99d6d60E849EA477#code) |
| SignedQuoteSettler | [0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d](https://bscscan.com/address/0xD5D43Ea31dEaFaeD32127516A1a2c381a0ef2f1d#code) |
| MixedTakeRouter | [0xf8Bd78ed7622Bb3976BebB03D99eA5AAff71022D](https://bscscan.com/address/0xf8Bd78ed7622Bb3976BebB03D99eA5AAff71022D#code) |
| MMCollateralVault | [0x269d78A4E302A5E78Fdb6681D9D4fF002e86E63b](https://bscscan.com/address/0x269d78A4E302A5E78Fdb6681D9D4fF002e86E63b#code) |
| FeeVault | [0x2b0934913FEF658F0628F004Ff5451aF2b8C21e6](https://bscscan.com/address/0x2b0934913FEF658F0628F004Ff5451aF2b8C21e6#code) |
| MarketMakerRegistry | [0xBFF929d9acFA13eCd81812a98dFa946c6a37A94B](https://bscscan.com/address/0xBFF929d9acFA13eCd81812a98dFa946c6a37A94B#code) |
| ReferralRegistry | [0xef80E6087E8cB8058014635f3e1aDd2EF18347dd](https://bscscan.com/address/0xef80E6087E8cB8058014635f3e1aDd2EF18347dd#code) |

Contract ownership is held by a 3-of-4 Safe multisig, and sensitive parameter changes go through an 8-day timelock.

## Security

Please do not report security vulnerabilities through public issues. See [SECURITY.md](SECURITY.md).

## License

The source code in this repository is licensed under the [GNU General Public License v3.0](LICENSE).

`public/viem.js` bundles [viem](https://github.com/wevm/viem) and its dependencies. Each keeps its own MIT license; the license notices are preserved in the file.

### Trademarks

The SorDex name, the SORDEX logo (`public/logo.png`, `public/logo-dark.png`) and related brand assets are **not** licensed under the GPL. You may not use them to identify a fork, a derivative work or any other product or service. If you deploy your own version of this code, remove or replace them.

---

## 中文说明

SorDex 是 BNB Chain 上的非托管现货订单簿 DEX，本仓库是它的网页前端。

挂单时资产锁在链上订单簿里，每笔成交都原子结算回用户钱包。平台从不持有用户资金，所有交易都在浏览器里生成，由用户自己的钱包签名。

**本地运行**（需要 Node.js 18 或更高版本）：

```bash
git clone https://github.com/sordexpro/SorDex.git
cd SorDex
npm run dev
```

然后打开 http://localhost:8080。开发服务器默认把 `/api`、`/ws`、`/rpc` 转发到 https://sordexpro.com；要换成别的后端，设置 `UPSTREAM` 环境变量。

**许可证**：代码采用 GPL-3.0。SorDex 名称和 SORDEX Logo 不在许可范围内，不得用于标识分叉或衍生产品。

**安全问题**：请不要在公开 Issue 里提交，见 [SECURITY.md](SECURITY.md)。
