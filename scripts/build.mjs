import { build } from 'esbuild'

const external = [
  '@deepseek-ai/*', '@earendil-works/*', 'react', 'react-dom', 'react/jsx-runtime',
  // The host installation owns undici; the plugin only borrows its ProxyAgent
  // for the optional Grok tunnel.
  'undici',
]

await build({
  entryPoints: ['src/index.js'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  sourcemap: false,
  legalComments: 'none',
})

await build({
  entryPoints: ['src/client.jsx'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external,
  sourcemap: false,
  legalComments: 'none',
  banner: { js: 'window.__ModuleLoader__.load({ id: "dsh-grok-subscription", factory: (require) => { var module = { exports: {} }; var exports = module.exports;' },
  footer: { js: 'return module.exports; } });' },
})
