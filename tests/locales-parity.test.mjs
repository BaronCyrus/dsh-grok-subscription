import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { en, zh } from '../src/locales.js'

const CLIENT_SOURCES = [
  new URL('../src/client.jsx', import.meta.url),
  new URL('../src/client-composer-quota.jsx', import.meta.url),
]

/** Static keys passed to the bound translator: t('someKey'). */
function referencedKeys(file) {
  const text = readFileSync(file, 'utf8')
  const keys = new Set()
  for (const match of text.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'\s*\)/g)) keys.add(match[1])
  return keys
}

test('zh and en expose exactly the same copy keys', () => {
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  const missingInEn = zhKeys.filter(key => !(key in en))
  const missingInZh = enKeys.filter(key => !(key in zh))
  assert.deepEqual(missingInEn, [], `keys missing from en: ${missingInEn.join(', ')}`)
  assert.deepEqual(missingInZh, [], `keys missing from zh: ${missingInZh.join(', ')}`)
  assert.deepEqual(zhKeys, enKeys)
})

test('every key the UI translates exists in both locales', () => {
  for (const file of CLIENT_SOURCES) {
    for (const key of referencedKeys(file)) {
      assert.ok(key in zh, `${file.pathname.split('/').pop()} uses t('${key}') but zh has no such key`)
      assert.ok(key in en, `${file.pathname.split('/').pop()} uses t('${key}') but en has no such key`)
    }
  }
})

test('every copy value is a non-empty string in both locales', () => {
  for (const [name, table] of [['zh', zh], ['en', en]]) {
    for (const [key, value] of Object.entries(table)) {
      assert.equal(typeof value, 'string', `${name}.${key} must be a string`)
      assert.ok(value.trim().length > 0, `${name}.${key} must not be empty`)
    }
  }
})
