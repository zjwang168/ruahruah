// Labels that are DATA, not copy.
//
// A service type arrives from the database as `elder_care`. Seven files each
// carried their own `SERVICE_LABELS` map to turn that into words, each a
// slightly different subset — /caregiver/requests knew seven of the nine,
// /caregiver/applications six, and neither knew `babysitter` or `postpartum`,
// so those rendered as raw enum values. Translating that arrangement would
// have meant translating the same table seven times and keeping the gaps.
//
// The vocabulary is in the dictionary now, under common.service.*, and this is
// how a component reads it.

import type { MessageKey } from './dict'
import type { TFn } from './provider'

/**
 * Falls back to the raw value, never to blank. `t` returns the key itself when
 * a string is missing, which is how an unknown enum is detected here — a new
 * service type added to the database but not to the dictionary renders as
 * `elder_care` rather than as `common.service.elder_care`, which is ugly but
 * still legible to whoever is looking at the screen.
 */
export function serviceLabel(t: TFn, value: string | null | undefined): string {
  if (!value) return ''
  const key = `common.service.${value}` as MessageKey
  const out = t(key)
  return out === key ? value : out
}
