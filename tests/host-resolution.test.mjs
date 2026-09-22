import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hostModuleRoots, optionalImport, resolveHostSpecifier } from '../src/adapter.js'
import { supportsImageInput, toPiModels } from '../src/catalog.js'
import { FALLBACK_MODEL_IDS, IMAGE_INPUT_MODEL_IDS } from '../src/constants.js'

/**
 * Builds a throwaway node_modules holding an ESM-only package whose exports map
 * has no `require`/`default` condition — the exact shape of
 * `@earendil-works/pi-ai`, which `require.resolve` cannot see.
 */
function makeEsmOnlyRoot() {
  const root = mkdtempSync(join(tmpdir(), 'grok-host-'))
  const pkg = join(root, 'node_modules', '@acme', 'esm-only')
  mkdirSync(join(pkg, 'dist', 'sub'), { recursive: true })
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({
    name: '@acme/esm-only',
    version: '1.0.0',
    type: 'module',
    exports: {
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
      './sub/*': { types: './dist/sub/*.d.ts', import: './dist/sub/*.js' },
    },
  }))
  writeFileSync(join(pkg, 'dist', 'index.js'), "export const marker = 'esm-only-root'\n")
  writeFileSync(join(pkg, 'dist', 'sub', 'thing.js'), "export const marker = 'esm-only-sub'\n")
  return root
}

test('an import-only exports map defeats require.resolve (why manual lookup exists)', () => {
  const root = makeEsmOnlyRoot()
  try {
    const req = createRequire(join(root, 'noop.js'))
    assert.throws(() => req.resolve('@acme/esm-only'), /ERR_PACKAGE_PATH_NOT_EXPORTED/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resolveHostSpecifier reads the import condition and subpath patterns', () => {
  const root = makeEsmOnlyRoot()
  try {
    const main = resolveHostSpecifier('@acme/esm-only', [root])
    assert.ok(main?.endsWith(join('dist', 'index.js')), `unexpected main: ${main}`)
    const sub = resolveHostSpecifier('@acme/esm-only/sub/thing', [root])
    assert.ok(sub?.endsWith(join('dist', 'sub', 'thing.js')), `unexpected sub: ${sub}`)
    assert.equal(resolveHostSpecifier('@acme/absent', [root]), undefined)
    assert.equal(resolveHostSpecifier('@acme/esm-only/sub/missing', [root]), undefined)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('optionalImport falls back to the host roots for a bare specifier', async () => {
  const root = makeEsmOnlyRoot()
  try {
    const mod = await optionalImport('@acme/esm-only', { hostRoots: [root], timeoutMs: 2_000 })
    assert.equal(mod?.marker, 'esm-only-root')
    const sub = await optionalImport('@acme/esm-only/sub/thing', { hostRoots: [root], timeoutMs: 2_000 })
    assert.equal(sub?.marker, 'esm-only-sub')
    assert.equal(await optionalImport('@acme/nope', { hostRoots: [root], timeoutMs: 500 }), undefined)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('an injected importFn bypasses host-root resolution', async () => {
  const root = makeEsmOnlyRoot()
  try {
    const seen = []
    const mod = await optionalImport('@acme/esm-only', {
      hostRoots: [root],
      timeoutMs: 500,
      importFn: async id => { seen.push(id); throw new Error('nope') },
    })
    assert.equal(mod, undefined)
    assert.deepEqual(seen, ['@acme/esm-only'], 'only the literal specifier is attempted')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('hostModuleRoots honours the override and derives the DSH profile root', () => {
  const roots = hostModuleRoots({
    DSH_GROK_PEER_ROOT: '/custom/peers',
    NPM_CONFIG_PREFIX: '/opt/npm',
    DSH_HOME: '/custom/dsh-home',
  }, '/opt/dsh/lib/bin.js')
  assert.equal(roots[0], '/custom/peers', 'the override is tried first')
  assert.ok(roots.includes(join('/opt/dsh/lib', 'node_modules')))
  assert.ok(roots.includes(join('/opt/dsh', 'node_modules')))
  assert.ok(roots.includes(join('/opt/npm', 'lib', 'node_modules')))
  assert.ok(roots.includes(join('/custom/dsh-home', 'profiles', 'node_modules')))
  assert.equal(new Set(roots).size, roots.length, 'roots must be de-duplicated')
})

test('image input is advertised only for models verified to accept it', () => {
  assert.deepEqual([...IMAGE_INPUT_MODEL_IDS], ['grok-4.7', 'grok-4.7-build-fast', 'grok-4.6'])
  assert.equal(supportsImageInput('grok-4.7'), true)
  assert.equal(supportsImageInput('grok-4.7-build-fast'), true)
  assert.equal(supportsImageInput('grok-4.6'), true)
  // grok-4.5 describes a solid red image as "green"; never advertise vision.
  assert.equal(supportsImageInput('grok-4.5'), false)
  assert.equal(supportsImageInput(undefined), false)
  assert.equal(supportsImageInput('unknown-model'), false)
})

test('toPiModels declares text+image only where the model supports it', () => {
  const models = toPiModels([
    { id: 'grok-4.7', name: 'Grok 4.7' },
    { id: 'grok-4.6', name: 'Grok 4.6' },
    { id: 'grok-4.5', name: 'Grok 4.5' },
  ])
  const byId = new Map(models.map(model => [model.id, model]))
  assert.deepEqual(byId.get('grok-4.7').input, ['text', 'image'])
  assert.deepEqual(byId.get('grok-4.6').input, ['text', 'image'])
  assert.deepEqual(byId.get('grok-4.5').input, ['text'])
  for (const id of FALLBACK_MODEL_IDS) {
    assert.ok(byId.has(id), `${id} should still be mapped`)
  }
})
