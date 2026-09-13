import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isValidName, nameError, displayName, fullName } from './names.ts'

// These mirror users_latin_name_ck. If the constraint changes and this does
// not, registration starts failing at the database with a message nobody can
// act on — so the cases here are the ones the SQL file lists too.
describe('name shape', () => {
  it('accepts the punctuation real names carry', () => {
    for (const n of ['Sarah', "O'Brien", 'Anne-Marie', 'Jr.', 'Ana Maria', 'van Dijk'.replace('v', 'V')]) {
      assert.equal(isValidName(n), true, n)
    }
  })

  it('rejects what the constraint rejects', () => {
    for (const n of ['李明华', '123456', '', '   ', '9Lives', 'Иван']) {
      assert.equal(isValidName(n), false, JSON.stringify(n))
    }
  })

  it('requires both halves', () => {
    assert.match(nameError('Sarah', '') ?? '', /both/)
    assert.match(nameError('', 'Chen') ?? '', /both/)
    assert.equal(nameError('Sarah', 'Chen'), null)
  })

  it('explains a non-Latin name rather than just refusing', () => {
    assert.match(nameError('李', '明华') ?? '', /Latin/)
  })
})

describe('display name', () => {
  it('is First L.', () => {
    assert.equal(displayName('Sarah', 'Chen'), 'Sarah C.')
    assert.equal(displayName('  Ana  ', ' ruiz '), 'Ana R.')
  })

  it('keeps a lone first name whole', () => {
    assert.equal(displayName('Madonna', ''), 'Madonna')
  })

  it('is empty when there is nothing to show', () => {
    assert.equal(displayName('', ''), '')
  })
})

describe('full name', () => {
  it('joins and trims', () => {
    assert.equal(fullName(' Sarah ', ' Chen '), 'Sarah Chen')
  })
})
