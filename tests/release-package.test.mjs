import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path, encoding = 'utf8') => readFile(new URL(`../${path}`, import.meta.url), encoding)

test('release manifest, lockfile, and localized Settings versions agree', async () => {
  const manifest = JSON.parse(await read('package.json'))
  const lock = JSON.parse(await read('package-lock.json'))
  assert.equal(lock.name, manifest.name)
  assert.equal(lock.version, manifest.version)
  assert.equal(lock.packages[''].version, manifest.version)
  const subtitles = (await read('src/locales.js')).match(/^\s*subtitle:.*$/gm)
  assert.equal(subtitles.length, 2)
  for (const subtitle of subtitles) assert.ok(subtitle.includes(`· ${manifest.version}`))
  assert.ok((await read('CHANGELOG.md')).includes(`## ${manifest.version}`))
})

test('release package includes both guides and original README assets', async () => {
  const manifest = JSON.parse(await read('package.json'))
  const required = ['README.md', 'README.en.md', 'CHANGELOG.md', 'docs/guide.zh-CN.md', 'docs/guide.en.md', 'docs/assets/dsh-grok-mascot.png']
  for (const path of required) {
    const included = manifest.files.some(entry => path === entry || path.startsWith(`${entry}/`))
    assert.ok(included, `publish files must include ${path}`)
    assert.ok((await read(path, null)).length > 0, `${path} must exist and be nonempty`)
  }
  for (const path of ['README.md', 'README.en.md']) {
    assert.ok((await read(path)).includes('docs/assets/dsh-grok-mascot.png'))
  }
  for (const path of ['docs/guide.zh-CN.md', 'docs/guide.en.md']) {
    assert.ok((await read(path)).includes(`${manifest.name}@${manifest.version}`), `${path} must pin the release version`)
  }
})
