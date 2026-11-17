// Rebuilds public/viem.js (browser ESM bundle of the viem functions the app uses).
// Usage: npm install && npm run build:viem
import { build } from 'esbuild';

await build({
  stdin: {
    contents: `export { createPublicClient, createWalletClient, custom, http, parseUnits, formatUnits, parseAbi, encodeFunctionData } from 'viem';
export { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';`,
    resolveDir: process.cwd(),
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  minify: true,
  outfile: 'public/viem.js',
});
console.log('public/viem.js rebuilt');
