import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import semver from 'semver'

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
)

/**
 * The gate profile startup and the desktop installer share: every
 * `@deepseek-ai/dsh` or `@deepseek-ai/dsh-*` peer must satisfy the running dsh
 * version, prereleases included. Failing it does not disable one feature — the
 * whole bundle is skipped before any plugin code loads, which is how 1.1.2
 * disappeared from the desktop app the moment it updated to 0.2.0-rc.1.
 */
const rejectedPeers = runtime => Object.entries(manifest.peerDependencies)
  .filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
  .filter(([, range]) => !semver.satisfies(runtime, range, { includePrerelease: true }))
  .map(([name]) => name)

test('every dsh peer a runtime in the declared span admits', () => {
  for (const runtime of ['0.1.5-rc.2', '0.1.5', '0.1.6-alpha.1', '0.1.7-rc.2', '0.2.0-rc.1', '0.2.0', '0.2.14']) {
    assert.deepEqual(rejectedPeers(runtime), [], `dsh ${runtime} must be admitted`)
  }
})

test('the dsh peers span the line instead of enumerating released versions', () => {
  // 1.1.2 used `^0.1.5-rc.2`, which is `<0.2.0`: correct for the host it was
  // written against and fatal for the next one. The range must cover the whole
  // 0.2 line and stop before 0.3, so the next minor gets a fresh verification
  // rather than another silent removal.
  for (const runtime of ['0.1.5-rc.1', '0.3.0-0', '0.3.0-alpha.1', '0.3.0-rc.1', '0.3.0', '1.0.0']) {
    assert.notDeepEqual(rejectedPeers(runtime), [], `dsh ${runtime} must be refused`)
  }
})

test('the pi-ai peer admits the build the desktop host ships', () => {
  // Not part of the gate — only `@deepseek-ai/dsh*` names are — but the plugin
  // resolves pi-ai out of the host tree, so the declaration must name the
  // version actually present: 0.85.1 in dsh 0.2.0-rc.1, 0.82.1 before it.
  for (const version of ['0.82.1', '0.85.1']) {
    assert.ok(
      semver.satisfies(version, manifest.peerDependencies['@earendil-works/pi-ai'], { includePrerelease: true }),
      `pi-ai ${version} must be admitted`,
    )
  }
})

test('every dsh peer carries the same span', () => {
  const peers = Object.entries(manifest.peerDependencies)
    .filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
  assert.ok(peers.length > 0, 'the plugin declares its dsh peers')
  for (const [name, range] of peers) {
    assert.equal(range, '>=0.1.5-rc.2 <0.3.0-0', `${name} must use the shared span`)
  }
})
