/**
 * merge-config — deep config-merging system using path-based strategy dispatch.
 * Converted from merge-config.js (include.module -> ES module).
 */

import { type as smkType } from './util'
import { SMK } from './smk-ref'

type ObjectIndex = [ Record<string, any>, string | number ]

interface PathMatcher {
    regex:    RegExp
    path:     string
    strategy: MergeStrategy
}

type MergeStrategy = ( base: ObjectIndex, source: ObjectIndex, path: string ) => void

// ---------------------------------------------------------------------------
// Path - strategy registry
// ---------------------------------------------------------------------------

const pathMatchers: PathMatcher[] = []

function addPathMatchStrategy( pathPattern: string, handler: MergeStrategy ): void {
    pathMatchers.push( {
        regex:    new RegExp( '^' + pathPattern + '$' ),
        path:     pathPattern,
        strategy: handler,
    } )
}

addPathMatchStrategy( '',                                                              objectMerge )
addPathMatchStrategy( '.+/style/markerSize',                                           assignMerge )
addPathMatchStrategy( '.+/style/markerOffset',                                         assignMerge )
addPathMatchStrategy( '.+/style/popupOffset',                                          assignMerge )
addPathMatchStrategy( '.+/style/shadowSize',                                           assignMerge )
addPathMatchStrategy( '/name',                                                         valueMerge )
addPathMatchStrategy( '/viewer',                                                        objectMerge )
addPathMatchStrategy( '/viewer/location',                                               assignMerge )
addPathMatchStrategy( '/viewer/displayContext',                                         arrayOfObjectMerge( 'id' ) )
addPathMatchStrategy( '/viewer/displayContext<.+?>(/items<.+?>)*/items',               arrayOfObjectMerge( 'id' ) )
addPathMatchStrategy( '/layers',                                                        arrayOfObjectMerge( 'id' ) )
addPathMatchStrategy( '/layers<.+?>/id',                                               ignoreMerge )
addPathMatchStrategy( '/layers<.+?>/attributes',                                       assignMerge )
addPathMatchStrategy( '/layers<.+?>/queries',                                          arrayOfObjectMerge( 'id' ) )
addPathMatchStrategy( '/layers<.+?>/queries<.+?>/parameters',                          arrayOfObjectMerge( 'id' ) )
addPathMatchStrategy( '/tools',                                                         toolMerge )
addPathMatchStrategy( '/tools<.+?>/type',                                              ignoreMerge )
addPathMatchStrategy( '/tools<.+?>/instance',                                          ignoreMerge )
addPathMatchStrategy( '/tools<.+?>/position',                                          assignMerge )
addPathMatchStrategy( '/tools<layers,.+?>/display',                                    arrayOfObjectMerge( 'id' ) )
addPathMatchStrategy( '/tools<layers,.+?>/display<.+?>(/items<.+?>)*/items',           arrayOfObjectMerge( 'id' ) )
addPathMatchStrategy( '/tools<.+?>/internalLayers',                                    arrayOfObjectMerge( 'id' ) )
addPathMatchStrategy( '/tools<.+?>/internalLayers<.+?>/style',                         objectMerge )

const typeStrategy: Record<string, MergeStrategy> = {
    object:  objectMerge,
    array:   arrayMerge,
    boolean: valueMerge,
    number:  valueMerge,
    string:  valueMerge,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPathStrategy( path: string ): MergeStrategy | undefined {
    for ( const pm of pathMatchers ) {
        if ( !pm.regex.test( path ) ) continue
        if ( path !== pm.path )
            console.debug( JSON.stringify( path ), '~', JSON.stringify( pm.path ) )
        return pm.strategy
    }
}

function deref( oi: ObjectIndex ): any {
    const [ o, i ] = oi
    if ( i == null ) return o
    return o[ i ]
}

// ---------------------------------------------------------------------------
// Merge strategies
// ---------------------------------------------------------------------------

export function merge( base: ObjectIndex, source: ObjectIndex, path: string ): void {
    const strategy = getPathStrategy( path )
    if ( strategy ) {
        strategy( base, source, path )
        return
    }

    const btype = smkType( deref( base ) )
    const bStrat = typeStrategy[ btype ]
    if ( bStrat ) {
        bStrat( base, source, path )
        return
    }

    const stype = smkType( deref( source ) )
    const sStrat = typeStrategy[ stype ]
    if ( sStrat ) {
        sStrat( base, source, path )
        return
    }

    if ( stype === 'null' || stype === 'undefined' ) return

    console.warn( path, 'no merge strategy', base, source )
    throw new Error( `no merge strategy for "${path}"` )
}

export function ignoreMerge( _base: ObjectIndex, _source: ObjectIndex, path: string ): void {
    console.debug( path, 'ignored' )
}

export function assignMerge( base: ObjectIndex, source: ObjectIndex, path: string ): void {
    const b = deref( base )
    const s = deref( source )

    if ( !b ) {
        base[ 0 ][ base[ 1 ] ] = s
        console.log( path, '=', JSON.parse( JSON.stringify( s ) ) )
        return
    }

    if ( s === null ) {
        delete base[ 0 ][ base[ 1 ] ]
        console.log( path, 'deleted' )
        return
    }

    base[ 0 ][ base[ 1 ] ] = s
    console.log( path, '=', JSON.parse( JSON.stringify( s ) ) )
}

function assertObject( v: any, ctx: string, path: string ): void {
    if ( smkType( v ) !== 'object' ) throw new Error( `Expected an Object in ${ctx} at ${path}` )
}

function assertArray( v: any, ctx: string, path: string ): void {
    if ( smkType( v ) !== 'array' ) throw new Error( `Expected an Array in ${ctx} at ${path}` )
}

function assertValue( v: any, ctx: string, path: string ): void {
    const t = smkType( v )
    if ( t !== 'number' && t !== 'string' && t !== 'boolean' )
        throw new Error( `Expected a Value in ${ctx} at ${path}` )
}

export function valueMerge( base: ObjectIndex, source: ObjectIndex, path: string ): void {
    const b = deref( base )
    const s = deref( source )

    if ( !b ) {
        base[ 0 ][ base[ 1 ] ] = s
        console.log( path, '=', JSON.parse( JSON.stringify( s ) ) )
        return
    }

    if ( s === null ) {
        delete base[ 0 ][ base[ 1 ] ]
        console.log( path, 'deleted' )
        return
    }

    assertValue( s, 'source', path )
    base[ 0 ][ base[ 1 ] ] = s
    console.log( path, '=', JSON.parse( JSON.stringify( s ) ) )
}

export function objectMerge( base: ObjectIndex, source: ObjectIndex, path: string ): void {
    const b = deref( base )
    const s = deref( source )

    if ( !b ) {
        base[ 0 ][ base[ 1 ] ] = s
        console.log( path, '=', s )
        return
    }

    if ( s === null ) {
        delete base[ 0 ][ base[ 1 ] ]
        console.log( path, 'deleted' )
        return
    }

    assertObject( b, 'base', path )
    assertObject( s, 'source', path )

    Object.keys( s ).forEach( ( k ) => {
        merge( [ b, k ], [ s, k ], path + '/' + k )
    } )
}

export function arrayMerge( base: ObjectIndex, source: ObjectIndex, path: string ): void {
    const b = deref( base )
    const s = deref( source )

    if ( !b ) {
        base[ 0 ][ base[ 1 ] ] = s
        console.log( path, '=', s )
        return
    }

    if ( s === null ) {
        delete base[ 0 ][ base[ 1 ] ]
        console.log( path, 'deleted' )
        return
    }

    assertArray( b, 'base', path )
    assertArray( s, 'source', path )

    base[ 0 ][ base[ 1 ] ] = b.concat( s )
    console.log( path, 'concat', s )
}

export function arrayOfObjectMerge( key: string ): MergeStrategy {
    return function ( base, source, path ) {
        let b = deref( base )
        const s = deref( source )

        if ( !b ) b = []

        if ( s === null ) {
            delete base[ 0 ][ base[ 1 ] ]
            console.log( path, 'deleted' )
            return
        }

        assertArray( b, 'base', path )
        assertArray( s, 'source', path )

        const res: any[] = []

        b.forEach( ( bo: any ) => {
            updateObjectSet( res, bo, key, path, true )
        } )

        s.forEach( ( so: any ) => {
            updateObjectSet( res, so, key, path )
        } )

        base[ 0 ][ base[ 1 ] ] = res
    }
}

function updateObjectSet( set: any[], item: any, key: string, path: string, isBase = false ): void {
    assertArray( set, 'set', path )
    assertObject( item, 'item', path )

    const keyVal = item[ key ]
    const matchAll = keyVal === '*'

    if ( keyVal == null ) throw new Error( `Key value is null at ${path}` )

    const indexes = set
        .map( ( o, i ) => {
            if ( matchAll ) return i
            if ( o[ key ] === keyVal ) return i
            return undefined
        } )
        .filter( ( i ) => i !== undefined ) as number[]

    if ( matchAll || indexes.length > 0 ) {
        if ( indexes.length > 1 && !matchAll ) throw new Error( `Match more than 1 object at ${path}` )

        const item2 = JSON.parse( JSON.stringify( item ) )
        delete item2[ key ]

        indexes.forEach( ( i ) => {
            merge( [ set, i ], [ [ item2 ], 0 ], path + '<' + set[ i ][ key ] + '>' )
        } )
    } else {
        set.push( item )
        if ( !isBase ) console.log( path, 'concat', item )
    }
}

function updateToolSet( set: any[], item: any, path: string, isBase = false ): void {
    assertArray( set, 'set', path )
    assertObject( item, 'item', path )

    const itemType = item.type
    const itemInst = item.instance

    const indexes = set
        .map( ( o, i ) => {
            if ( o.type === itemType ) {
                if ( !itemInst ) return i
                if ( o.instance === itemInst ) return i
            }
            return undefined
        } )
        .filter( ( i ) => i !== undefined ) as number[]

    if ( indexes.length > 0 ) {
        if ( indexes.length > 1 ) throw new Error( `Match more than 1 object at ${path}` )

        const item2 = JSON.parse( JSON.stringify( item ) )
        delete item2.type
        delete item2.instance

        merge(
            [ set, indexes[ 0 ] ],
            [ [ item2 ], 0 ],
            `${path}<${set[ indexes[ 0 ] ].type},${set[ indexes[ 0 ] ].instance}>`,
        )
    } else {
        set.push( item )
        if ( !isBase ) console.log( path, 'concat', item )
    }
}

export function toolMerge( base: ObjectIndex, source: ObjectIndex, path: string ): void {
    let b = deref( base )
    const s = deref( source )

    if ( !b ) b = []

    if ( s === null ) {
        delete base[ 0 ][ base[ 1 ] ]
        console.log( path, 'deleted' )
        return
    }

    assertArray( b, 'base', path )
    assertArray( s, 'source', path )

    const res: any[] = []

    b.forEach( ( bo: any ) => {
        updateToolSet( res, bo, path, true )
    } )

    s.forEach( ( so: any ) => {
        updateToolSet( res, so, path )
    } )

    base[ 0 ][ base[ 1 ] ] = res
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function mergeConfigs( configs: any[] ): any {
    const base = JSON.parse( JSON.stringify( SMK?.CONFIG || {} ) )
    let inline = 0

    while ( configs.length > 0 ) {
        const source = configs.shift()

        const $s = 'config ' + JSON.stringify( source.$source || 'inline #' + ( ++inline ) )
        delete source.$source
        console.groupCollapsed( $s )

        console.debug( 'merging:', JSON.parse( JSON.stringify( { base, source } ) ) )
        merge( [ { $: base }, '$' ], [ { $: source }, '$' ], '' )

        console.groupEnd()
    }

    console.log( 'merged config', JSON.parse( JSON.stringify( base ) ) )

    return base
}

mergeConfigs.merge             = merge
mergeConfigs.arrayOfObjectMerge = arrayOfObjectMerge
mergeConfigs.assignMerge       = assignMerge
mergeConfigs.ignoreMerge       = ignoreMerge
mergeConfigs.objectMerge       = objectMerge
mergeConfigs.toolMerge         = toolMerge
mergeConfigs.valueMerge        = valueMerge

// Assign to SMK.TYPE for backward compat (smk-map.ts looks up smk.TYPE.mergeConfigs)
if ( typeof window !== 'undefined' ) {
    const smk = SMK
    if ( smk && smk.TYPE ) smk.TYPE.mergeConfigs = mergeConfigs
}

export default mergeConfigs
