//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `dsh-multimodal-client`.
* @module dsh-multimodal-client/invariant
*/
const PACKAGE_NAME = "dsh-multimodal-client";
/** Cordis companion plugin name. */
const name = "multimodal-client-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/** No runtime invariant: keyed UI slot registrations with no host-side state. */
const install = () => {};
/** Register this package's invariant companion. */
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
