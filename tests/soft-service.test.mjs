import test from 'node:test'
import assert from 'node:assert/strict'
import { softService } from '../src/index.js'

test('softService never reads ctx[key] (Cordis inject guard)', () => {
  let propertyReads = 0
  const ctx = {
    get() { return undefined },
  }
  Object.defineProperty(ctx, 'credentials', {
    get() {
      propertyReads += 1
      throw new Error('cannot get property "credentials" without inject')
    },
    configurable: true,
  })
  assert.equal(softService(ctx, 'credentials'), undefined)
  assert.equal(propertyReads, 0)
})

test('softService returns ctx.get hit', () => {
  const service = { set() {} }
  const ctx = { get: (key) => key === 'credentials' ? service : undefined }
  assert.equal(softService(ctx, 'credentials'), service)
})
