import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { grokCliAvailable, resolveGrokBin } from '../src/session.js'

/** Windows path identity: NTFS ignores case, and both separators are the same. */
const winKey = path => String(path).toLowerCase().replaceAll('/', '\\')

/**
 * A Windows-like filesystem for the injected `exists` probe: only the listed
 * files exist, and lookups ignore case the way NTFS does (`PATHEXT` declares
 * `.EXE`, the installed file is `grok.exe`).
 */
function windowsFs(files) {
  const known = new Set(files.map(winKey))
  return path => known.has(winKey(path))
}

/** Windows resolves `grok.EXE` and `grok.exe` to one file, so paths compare as such. */
const assertWinEqual = (actual, expected) => assert.equal(winKey(actual), winKey(expected))

const WIN_PATH = ['C:\\Tools\\.grok\\bin', 'C:\\Windows\\system32'].join(';')
const WIN_GROK_HOME = 'C:\\Users\\me\\.grok'
const WIN_LOCAL_BIN = join(WIN_GROK_HOME, 'bin', 'grok')
const WIN_ON_PATH = join('C:\\Tools\\.grok\\bin', 'grok')

test('resolveGrokBin finds the installed .exe beside an extension-less CLI path', () => {
  const exists = windowsFs([`${WIN_LOCAL_BIN}.exe`])
  assertWinEqual(resolveGrokBin({ GROK_HOME: WIN_GROK_HOME }, exists, 'win32'), `${WIN_LOCAL_BIN}.exe`)
})

test('resolveGrokBin still prefers an extension-less install that really exists', () => {
  const exists = windowsFs([WIN_LOCAL_BIN, `${WIN_LOCAL_BIN}.exe`])
  assertWinEqual(resolveGrokBin({ GROK_HOME: WIN_GROK_HOME }, exists, 'win32'), WIN_LOCAL_BIN)
})

test('resolveGrokBin falls back to the bare name when nothing is installed', () => {
  const exists = windowsFs([])
  assert.equal(resolveGrokBin({ GROK_HOME: WIN_GROK_HOME }, exists, 'win32'), 'grok')
})

test('resolveGrokBin keeps an explicit DSH_GROK_BIN and completes its extension', () => {
  const exists = windowsFs([`${WIN_ON_PATH}.exe`])
  const env = { DSH_GROK_BIN: 'C:\\Tools\\.grok\\bin\\grok' }
  assertWinEqual(resolveGrokBin(env, exists, 'win32'), `${WIN_ON_PATH}.exe`)
  // A bare override is a command name, never a file next to the host's cwd.
  assert.equal(resolveGrokBin({ DSH_GROK_BIN: 'grok' }, () => false, 'win32'), 'grok')
})

test('grokCliAvailable is true on win32 when PATH holds grok.exe', () => {
  const exists = windowsFs([`${WIN_ON_PATH}.exe`])
  assert.equal(grokCliAvailable({ PATH: WIN_PATH, PATHEXT: '.COM;.EXE;.BAT;.CMD' }, exists, 'win32'), true)
})

test('grokCliAvailable is true on win32 when the .grok home holds grok.exe', () => {
  const exists = windowsFs([`${WIN_LOCAL_BIN}.exe`])
  assert.equal(grokCliAvailable({ PATH: 'C:\\Windows', GROK_HOME: WIN_GROK_HOME }, exists, 'win32'), true)
})

test('grokCliAvailable honours PATHEXT beyond .exe', () => {
  const cmd = `${WIN_ON_PATH}.cmd`
  assert.equal(grokCliAvailable({ PATH: WIN_PATH, PATHEXT: '.CMD;.EXE' }, windowsFs([cmd]), 'win32'), true)
  // A suffix the platform would not resolve must not be reported as runnable.
  assert.equal(grokCliAvailable({ PATH: WIN_PATH, PATHEXT: '.EXE' }, windowsFs([cmd]), 'win32'), false)
})

test('grokCliAvailable uses the default Windows suffixes when PATHEXT is absent', () => {
  const exists = windowsFs([`${WIN_ON_PATH}.exe`])
  assert.equal(grokCliAvailable({ PATH: WIN_PATH }, exists, 'win32'), true)
})

test('grokCliAvailable reads a quoted Windows PATH entry', () => {
  const dir = 'C:\\Program Files\\Grok'
  const exists = windowsFs([join(dir, 'grok.exe')])
  assert.equal(grokCliAvailable({ PATH: `"${dir}";C:\\Windows`, PATHEXT: '.EXE' }, exists, 'win32'), true)
})

test('grokCliAvailable splits PATH by platform, not by the running host', () => {
  // A POSIX host must still read the Windows delimiter, and vice versa.
  const winOnly = windowsFs([`${WIN_ON_PATH}.exe`])
  assert.equal(grokCliAvailable({ PATH: WIN_PATH }, winOnly, 'win32'), true)
  const posixOnly = path => String(path) === '/usr/local/bin/grok.exe'
  assert.equal(grokCliAvailable({ PATH: WIN_PATH }, posixOnly, 'linux'), false)
})

test('grokCliAvailable on POSIX keeps the extension-less contract', () => {
  const found = path => String(path) === '/usr/local/bin/grok'
  assert.equal(grokCliAvailable({ PATH: '/usr/local/bin:/usr/bin' }, found, 'linux'), true)
  assert.equal(grokCliAvailable({ PATH: '/usr/local/bin:/usr/bin' }, found, 'darwin'), true)
  // An .exe-only install is not a Linux/macOS CLI, and no false positive appears.
  const exeOnly = path => String(path) === '/usr/local/bin/grok.exe'
  assert.equal(grokCliAvailable({ PATH: '/usr/local/bin' }, exeOnly, 'linux'), false)
  assert.equal(grokCliAvailable({ PATH: '/usr/local/bin' }, () => false, 'darwin'), false)
})

test('grokCliAvailable tolerates an empty or missing PATH', () => {
  assert.equal(grokCliAvailable({}, () => false, 'win32'), false)
  assert.equal(grokCliAvailable({ PATH: '' }, () => false, 'linux'), false)
  assert.equal(grokCliAvailable({ PATH: ';;;' }, () => false, 'win32'), false)
})

test('windows smoke test: a real temp directory holding grok.exe is detected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grok-cli-'))
  try {
    const binary = join(dir, 'grok.exe')
    writeFileSync(binary, '')
    const env = { PATH: `${dir};C:\\Windows`, PATHEXT: '.exe', GROK_HOME: join(dir, 'absent') }
    assert.equal(grokCliAvailable(env, existsSync, 'win32'), true)
    assert.equal(resolveGrokBin(env, existsSync, 'win32'), 'grok')
    assert.equal(grokCliAvailable({ ...env, PATH: 'C:\\Windows' }, existsSync, 'win32'), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
