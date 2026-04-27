/**
 * smk-global — bootstraps the window.SMK stub before any other module evaluates.
 *
 * MUST be the first non-type import in src/main.ts.  Rollup places modules in
 * the bundle in the order they are first encountered during DFS traversal of
 * imports.  Because this file has NO imports of its own it is guaranteed to
 * appear first, before util.ts and all other side-effect modules that assume
 * window.SMK.TYPE / window.SMK.UTIL already exist.
 *
 * The UMD wrapper creates `window.SMK = {}` (an empty object), but does not
 * create the sub-properties, so every module that does
 *   `window.SMK.TYPE.Foo = Foo`
 * would throw unless window.SMK.TYPE has been initialised first.
 */
if ( typeof window !== 'undefined' ) {
    const smk: any = window

    if ( !smk.SMK )              smk.SMK              = {}
    if ( !smk.SMK.TYPE )         smk.SMK.TYPE         = {}
    if ( !smk.SMK.UTIL )         smk.SMK.UTIL         = {}
    if ( !smk.SMK.HANDLER )      smk.SMK.HANDLER      = { has: () => false, get: () => null }
    if ( !smk.SMK.COMPONENT )    smk.SMK.COMPONENT    = {}
    if ( !smk.SMK.TYPE.Viewer )  smk.SMK.TYPE.Viewer  = {}
    if ( !smk.SMK.TYPE.Layer )   smk.SMK.TYPE.Layer   = {}
}
