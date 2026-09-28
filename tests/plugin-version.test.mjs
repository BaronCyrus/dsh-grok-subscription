import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  compareSemver,
  createGrokPluginManager,
  findInstall,
  PACKAGE_NAME,
  parseSemver,
  resolvePnpm,
} from '../src/plugin-version.js'
import { createRpcHandler } from '../src/rpc.js'

const writeManifest = async (path, manifest) => {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(manifest))
}

/** Fake DSH home whose `web` profile installed the package from the registry. */
async function npmInstall(root, version = '1.0.10') {
  const installedDir = join(root, 'profiles', 'web', 'node_modules', PACKAGE_NAME)
  await writeManifest(join(root, 'profiles', 'web', 'package.json'), {
    dependencies: { [PACKAGE_NAME]: version },
  })
  await writeManifest(join(installedDir, 'package.json'), { name: PACKAGE_NAME, version })
  return pathToFileURL(join(installedDir, 'package.json'))
}

const registryOk = version => async () => ({ ok: true, status: 200, async json() { return { version } } })

/**
 * A fake desktop runtime, shaped like the real host process: `argv[1]` is the
 * desktop host entry point (never the CLI), the runtime directory carrying the
 * `dsh` package arrives as its own argument, and the bundled pnpm entry travels
 * in the arguments too.
 */
async function desktopRuntime(root) {
  const runtimeDir = join(root, 'resources', 'app.asar', 'dsh')
  const hostEntry = join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'index.js')
  const pnpm = join(root, 'resources', 'runtime', 'pnpm', 'bin', 'pnpm.mjs')
  await writeManifest(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), {
    name: '@deepseek-ai/dsh',
    version: '0.1.7-rc.2',
  })
  await writeManifest(hostEntry, { name: '@deepseek-ai/dsh-desktop-host', version: '0.1.7-rc.2' })
  await writeManifest(pnpm, { name: 'pnpm', version: '11.7.0' })
  return {
    runtimeDir,
    hostEntry,
    pnpm,
    argv: [
      join(root, 'DeepSeek Harness'),
      hostEntry,
      runtimeDir,
      join(root, 'profiles', 'desktop'),
      join(root, 'resources', 'runtime', 'primary-runtime'),
      pnpm,
      join(root, 'resources', 'runtime', 'bin'),
    ],
  }
}

/** Land the requested version on disk so the post-install check can confirm it. */
const installRecorder = async ({ args, cwd }) => {
  await writeManifest(join(cwd, 'node_modules', PACKAGE_NAME, 'package.json'), {
    name: PACKAGE_NAME,
    version: args.at(-1).split('@').at(-1),
  })
  return { code: 0, stdout: '', stderr: '' }
}

test('semver comparison treats a release as newer than its prerelease', () => {
  assert.equal(compareSemver('1.0.10', '1.0.9'), 1)
  assert.equal(compareSemver('1.0.10', '1.0.10'), 0)
  assert.equal(compareSemver('1.0.10-rc.1', '1.0.10'), -1)
  assert.equal(parseSemver('not-a-version'), undefined)
})

test('findInstall matches the running package and classifies registry installs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grok-plugin-version-'))
  const packageJson = join(root, 'installed', 'package.json')
  await mkdir(join(root, 'installed'), { recursive: true })
  await writeFile(packageJson, JSON.stringify({ version: '1.0.10' }))
  const profile = join(root, 'profiles', 'web', 'node_modules', 'dsh-grok-subscription')
  await mkdir(join(profile, '..'), { recursive: true })
  await rm(profile, { recursive: true, force: true })
  await symlink(join(root, 'installed'), profile, 'dir')
  await writeFile(join(root, 'profiles', 'web', 'package.json'), JSON.stringify({
    dependencies: { 'dsh-grok-subscription': '^1.0.10' },
  }))

  const found = await findInstall({ dshHome: root, ownPackageJsonUrl: pathToFileURL(packageJson) })
  assert.deepEqual(found, { kind: 'npm', profile: 'web' })
})

test('version reads stay cached and updates invoke the owning profile only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grok-plugin-manifest-'))
  const manifest = join(root, 'package.json')
  await writeFile(manifest, JSON.stringify({ version: '1.0.10' }))
  let fetches = 0
  const commands = []
  const manager = createGrokPluginManager({
    fetchImpl: async () => {
      fetches += 1
      return { ok: true, json: async () => ({ version: '1.0.11' }) }
    },
    runCommand: async call => {
      commands.push(call)
      return { code: 0 }
    },
    ownPackageJsonUrl: pathToFileURL(manifest),
    env: { DSH_HOME: '/missing/grok-home' },
    ttlMs: 60_000,
    now: () => 1_000,
  })

  const first = await manager.read()
  const second = await manager.read()
  assert.equal(fetches, 1)
  assert.equal(first.current, '1.0.10')
  assert.equal(second.latest, '1.0.11')
  assert.equal(second.updateAvailable, true)
  assert.equal(second.install.kind, 'unknown')
  await assert.rejects(() => manager.update(), /owning profile/)
  assert.deepEqual(commands, [])
})

test('update installs the exact version into the owning profile, pinned and age-free', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grok-version-update-'))
  const ownPackageJsonUrl = await npmInstall(root, '1.0.10')
  const calls = []
  let registryRequests = 0
  const manager = createGrokPluginManager({
    env: { DSH_HOME: root },
    ownPackageJsonUrl,
    execPath: '/node',
    argv: ['/node', '/dsh/bin.js'],
    fetchImpl: () => {
      registryRequests += 1
      return registryOk('1.1.1')()
    },
    runCommand: async (call, options) => {
      calls.push(call)
      return installRecorder(call, options)
    },
  })
  const updated = await manager.update()
  assert.deepEqual(updated, { version: '1.1.1', profile: 'web' })
  assert.equal(calls[0].command, 'pnpm', 'without a bundled entry the pnpm name is the fallback')
  assert.deepEqual(calls[0].args, [
    'add', '--save-exact', '--config.minimumReleaseAge=0', `${PACKAGE_NAME}@1.1.1`,
  ])
  assert.equal(calls[0].cwd, join(root, 'profiles', 'web'))
  await manager.read()
  assert.equal(registryRequests, 2, 'a successful update invalidates the cached version')
})

test('desktop hosts install with the bundled pnpm, never by launching the desktop host again', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grok-version-desktop-'))
  const ownPackageJsonUrl = await npmInstall(root, '1.0.20')
  const runtime = await desktopRuntime(root)
  assert.equal(resolvePnpm({ argv: runtime.argv }), runtime.pnpm)
  const calls = []
  const manager = createGrokPluginManager({
    env: { DSH_HOME: root },
    ownPackageJsonUrl,
    execPath: '/Applications/DeepSeek Harness',
    argv: runtime.argv,
    fetchImpl: registryOk('1.1.1'),
    runCommand: async (call, options) => {
      calls.push(call)
      return installRecorder(call, options)
    },
  })
  // npmInstall() writes profiles/web, so the owning profile is that one.
  assert.deepEqual(await manager.update(), { version: '1.1.1', profile: 'web' })
  const [call] = calls
  assert.equal(call.command, '/Applications/DeepSeek Harness', 'the host executable is the Node runtime')
  assert.deepEqual(call.args, [
    runtime.pnpm, 'add', '--save-exact', '--config.minimumReleaseAge=0', `${PACKAGE_NAME}@1.1.1`,
  ])
  const flattened = JSON.stringify(call)
  assert.equal(flattened.includes(runtime.hostEntry), false, 'the desktop host entry is never launched again')
  assert.equal(flattened.includes('--expose-internals'), false, 'no launcher flag leaks into a script position')
  assert.equal(flattened.includes('plugin'), false, 'the CLI that refuses the desktop profile is not used')
})

test('an update that installs nothing is a failure, not a reported success', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grok-version-verify-'))
  const ownPackageJsonUrl = await npmInstall(root, '1.0.20')
  const manager = createGrokPluginManager({
    env: { DSH_HOME: root },
    ownPackageJsonUrl,
    fetchImpl: registryOk('1.1.1'),
    settleDelayMs: 1,
    runCommand: async () => ({ code: 0, stdout: '', stderr: '' }),
  })
  await assert.rejects(
    () => manager.update(),
    /^Error: Grok plugin update did not install the requested version$/u,
  )
})

test('the package-manager resolver trusts only real pnpm entries and owned runtime roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grok-version-resolve-'))
  const runtime = await desktopRuntime(root)
  const elsewhere = await mkdtemp(join(tmpdir(), 'grok-version-resolve-other-'))
  const otherPnpm = join(elsewhere, 'resources', 'pnpm', 'bin', 'pnpm.mjs')

  assert.equal(
    resolvePnpm({ argv: runtime.argv }),
    runtime.pnpm,
    'the bundled entry named in the host arguments wins',
  )
  assert.equal(
    resolvePnpm({ argv: ['/node', '--expose-internals', '/dsh/bin.js'] }),
    undefined,
    'a flag is never a package-manager entry',
  )
  assert.equal(
    resolvePnpm({ argv: ['/node', runtime.hostEntry] }),
    undefined,
    'the entry script is never treated as the package manager',
  )
  assert.equal(
    resolvePnpm({ argv: ['/node', '/somewhere/pnpm-not-really'] }),
    undefined,
    'a name that merely contains pnpm is not the package manager',
  )
  assert.equal(
    resolvePnpm({ argv: ['/node', join(root, 'missing', 'pnpm.mjs')] }),
    undefined,
    'a pnpm entry that does not exist is not used',
  )

  await writeManifest(otherPnpm, { name: 'pnpm', version: '11.7.0' })
  const runtimeDir = join(elsewhere, 'resources', 'runtime')
  await writeManifest(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), {
    name: '@deepseek-ai/dsh',
    version: '0.1.7-rc.2',
  })
  assert.equal(
    resolvePnpm({ argv: ['/node', join(elsewhere, 'index.js'), runtimeDir] }),
    otherPnpm,
    'a runtime directory carrying the dsh package locates the bundled pnpm',
  )
})

test('plugin RPC exposes version data without install commands or registry payloads', async () => {
  const handler = createRpcHandler({}, {
    pluginManager: {
      read: async () => ({
        current: '1.0.10',
        latest: '1.0.11',
        updateAvailable: true,
        install: { kind: 'npm', profile: 'web', spec: '^1.0.10' },
        token: 'secret',
      }),
      update: async () => ({ version: '1.0.11', profile: 'web', stdout: 'secret output' }),
    },
  })

  const version = await handler('plugin/version', { force: true }, new AbortController().signal)
  assert.equal(version.ok, true)
  assert.deepEqual(version.value, {
    current: '1.0.10',
    latest: '1.0.11',
    updateAvailable: true,
    install: { kind: 'npm' },
  })

  const updated = await handler('plugin/update', {}, new AbortController().signal)
  assert.deepEqual(updated.value, { version: '1.0.11' })
})
