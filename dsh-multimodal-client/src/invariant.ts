/**
 * Package-owned invariant companion for `dsh-multimodal-client`.
 * @module dsh-multimodal-client/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-multimodal-client'

/** Cordis companion plugin name. */
export const name = 'multimodal-client-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: keyed UI slot registrations with no host-side state. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
