/**
 * smk-ref — typed accessor for the global window.SMK namespace.
 *
 * Replaces the `const smkRef = ( window as any ).SMK` pattern that was
 * scattered across most modules.  The Window.SMK interface is declared in
 * src/main.ts; importing `SMK` from here gives you the full SMKNamespace
 * type without per-file casts.
 *
 * Note: window.SMK is initialised in src/main.ts before any module that
 * uses it is loaded (Vite import order is preserved by the explicit imports
 * in main.ts), so accessing window.SMK at module top-level is safe.
 */

import type { SMKNamespace } from '../main'

/**
 * The global SMK namespace.  Use this instead of `( window as any ).SMK`.
 *
 * NOTE: Because window.SMK is mutated as modules register themselves
 * (TYPE.* / COMPONENT.* / etc.), always read sub-properties at call time
 * rather than caching them at module top-level.
 */
export const SMK: SMKNamespace = ( typeof window !== 'undefined'
    ? ( window as any ).SMK
    : ( {} as any ) ) as SMKNamespace

export default SMK
