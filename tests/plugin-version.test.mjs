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
  parseSemver,
} from '../src/plugin-version.js'
import { createRpcHandler } from '../src/rpc.js'

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
    runCommand: async argv => {
      commands.push(argv)
      return { code: 0 }
    },
    binPath: undefined,
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
