import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pickSide, capabilitiesOf, isSide } from './roles.ts'

describe('pickSide', () => {
  it('honours the cookie only for a side the person can hold', () => {
    assert.equal(pickSide({ family: true, caregiver: true }, 'caregiver'), 'caregiver')
    assert.equal(pickSide({ family: true, caregiver: false }, 'caregiver'), 'family')
  })
  it('needs no cookie with one profile', () => {
    assert.equal(pickSide({ family: false, caregiver: true }, null), 'caregiver')
    assert.equal(pickSide({ family: true, caregiver: false }, 'junk'), 'family')
  })
  it('defaults a two-profile account to family', () => {
    assert.equal(pickSide({ family: true, caregiver: true }, null), 'family')
  })
  it('is null with no profile at all — the caller routes to /auth/complete', () => {
    assert.equal(pickSide({ family: false, caregiver: false }, 'family'), null)
  })
})

describe('capabilitiesOf', () => {
  it('reads the two user_self columns and nothing else', () => {
    assert.deepEqual(capabilitiesOf({ family_profile_id: 'x', caregiver_profile_id: null }),
      { family: true, caregiver: false })
    assert.deepEqual(capabilitiesOf(null), { family: false, caregiver: false })
  })
  it('never trusts users.role', () => {
    assert.deepEqual(capabilitiesOf({ role: 'family' } as any), { family: false, caregiver: false })
  })
})

describe('isSide', () => {
  it('accepts the two sides and nothing else', () => {
    assert.equal(isSide('family'), true)
    assert.equal(isSide('admin'), false)
    assert.equal(isSide(undefined), false)
  })
})
