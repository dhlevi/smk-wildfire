import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
    makePromise,
    resolved,
    rejected,
    waitAll,
    type,
    templateReplace,
    isDeepEqual,
    grammaticalNumber,
    makeSet,
    makeDelayedCall,
    extractCRS,
    traverse,
    circlePoints,
    wrapFunction,
    asyncReduce,
    projection,
    makeId,
    makeUUID,
    getMetersPerUnit,
    makeMutex,
} from '../../src/smk/util'

// ---------------------------------------------------------------------------
// Promise helpers
// ---------------------------------------------------------------------------

describe( 'makePromise', () => {
    it( 'resolves via the withFn callback', async () => {
        const p = makePromise<number>( ( res ) => res( 42 ) )
        await expect( p ).resolves.toBe( 42 )
    } )

    it( 'rejects via the withFn callback', async () => {
        const p = makePromise( ( _, rej ) => rej( new Error( 'boom' ) ) )
        await expect( p ).rejects.toThrow( 'boom' )
    } )

    it( 'returns a never-settling promise when called with no callback', async () => {
        const p = makePromise()
        let settled = false
        p.then( () => { settled = true } ).catch( () => { settled = true } )
        // give the microtask queue a chance to run
        await new Promise( r => setTimeout( r, 0 ) )
        expect( settled ).toBe( false )
    } )
} )

describe( 'resolved / rejected / waitAll', () => {
    it( 'resolved() wraps a value', async () => {
        await expect( resolved( 'hello' ) ).resolves.toBe( 'hello' )
    } )

    it( 'rejected() rejects with the value', async () => {
        await expect( rejected( 'err' ) ).rejects.toBe( 'err' )
    } )

    it( 'waitAll resolves all promises', async () => {
        const result = await waitAll( [ resolved( 1 ), resolved( 2 ), resolved( 3 ) ] )
        expect( result ).toEqual( [ 1, 2, 3 ] )
    } )

    it( 'waitAll rejects if any promise rejects', async () => {
        await expect( waitAll( [ resolved( 1 ), rejected( 'x' ) ] ) ).rejects.toBe( 'x' )
    } )
} )

// ---------------------------------------------------------------------------
// type()
// ---------------------------------------------------------------------------

describe( 'type', () => {
    it.each( [
        [ 'number',    42 ],
        [ 'string',    'hi' ],
        [ 'boolean',   true ],
        [ 'undefined', undefined ],
        [ 'function',  () => {} ],
        [ 'null',      null ],
        [ 'array',     [] ],
        [ 'array',     [ 1, 2 ] ],
        [ 'object',    {} ],
        [ 'object',    { a: 1 } ],
    ] as const )( 'type(%s)', ( expected, value ) => {
        expect( type( value ) ).toBe( expected )
    } )
} )

// ---------------------------------------------------------------------------
// templateReplace()
// ---------------------------------------------------------------------------

describe( 'templateReplace', () => {
    it( 'replaces a single token', () => {
        expect( templateReplace( 'Hello <%= name %>!', ( k ) => k === 'name' ? 'World' : null ) )
            .toBe( 'Hello World!' )
    } )

    it( 'replaces multiple tokens', () => {
        const result = templateReplace( '<%= a %> and <%= b %>', ( k ) => k === 'a' ? '1' : '2' )
        expect( result ).toBe( '1 and 2' )
    } )

    it( 'leaves unknown tokens as-is when replacer returns null', () => {
        expect( templateReplace( '<%= x %>', () => null ) ).toBe( '<%= x %>' )
    } )

    it( 'returns template unchanged when there are no tokens', () => {
        expect( templateReplace( 'no tokens', () => 'x' ) ).toBe( 'no tokens' )
    } )

    it( 'returns template unchanged when template is empty', () => {
        expect( templateReplace( '', () => 'x' ) ).toBe( '' )
    } )

    it( 'single-token whole-string case returns the replaced value directly', () => {
        // When the whole string is exactly one token, it returns the replacer result
        // as a raw value (not embedded in a string), allowing non-string substitutions.
        expect( templateReplace( '<%= val %>', ( k ) => k === 'val' ? '99' : null ) ).toBe( '99' )
    } )
} )

// ---------------------------------------------------------------------------
// isDeepEqual()
// ---------------------------------------------------------------------------

describe( 'isDeepEqual', () => {
    it( 'equal primitives', () => {
        expect( isDeepEqual( 1, 1 ) ).toBe( true )
        expect( isDeepEqual( 'a', 'a' ) ).toBe( true )
        expect( isDeepEqual( true, true ) ).toBe( true )
        expect( isDeepEqual( null, null ) ).toBe( true )
    } )

    it( 'unequal primitives', () => {
        expect( isDeepEqual( 1, 2 ) ).toBe( false )
        expect( isDeepEqual( 'a', 'b' ) ).toBe( false )
    } )

    it( 'different types', () => {
        expect( isDeepEqual( 1, '1' ) ).toBe( false )
        expect( isDeepEqual( null, undefined ) ).toBe( false )
        expect( isDeepEqual( [], {} ) ).toBe( false )
    } )

    it( 'equal arrays', () => {
        expect( isDeepEqual( [ 1, 2, 3 ], [ 1, 2, 3 ] ) ).toBe( true )
    } )

    it( 'arrays of different length', () => {
        expect( isDeepEqual( [ 1, 2 ], [ 1, 2, 3 ] ) ).toBe( false )
    } )

    it( 'arrays with different values', () => {
        expect( isDeepEqual( [ 1, 2 ], [ 1, 3 ] ) ).toBe( false )
    } )

    it( 'equal objects', () => {
        expect( isDeepEqual( { a: 1, b: 2 }, { b: 2, a: 1 } ) ).toBe( true )
    } )

    it( 'objects with different keys', () => {
        expect( isDeepEqual( { a: 1 }, { b: 1 } ) ).toBe( false )
    } )

    it( 'objects with different values', () => {
        expect( isDeepEqual( { a: 1 }, { a: 2 } ) ).toBe( false )
    } )

    it( 'nested equal structures', () => {
        expect( isDeepEqual(
            { x: [ 1, { y: 'z' } ] },
            { x: [ 1, { y: 'z' } ] }
        ) ).toBe( true )
    } )

    it( 'nested unequal structures', () => {
        expect( isDeepEqual(
            { x: [ 1, { y: 'z' } ] },
            { x: [ 1, { y: 'w' } ] }
        ) ).toBe( false )
    } )
} )

// ---------------------------------------------------------------------------
// grammaticalNumber()
// ---------------------------------------------------------------------------

describe( 'grammaticalNumber', () => {
    it( 'zero case', () => {
        expect( grammaticalNumber( 0, 'no items', 'one item', '{} items' ) ).toBe( 'no items' )
    } )

    it( 'one case', () => {
        expect( grammaticalNumber( 1, 'no items', 'one item', '{} items' ) ).toBe( 'one item' )
    } )

    it( 'many case substitutes count', () => {
        expect( grammaticalNumber( 5, 'no items', 'one item', '{} items' ) ).toBe( '5 items' )
    } )

    it( 'falls back to one for many when many is omitted', () => {
        expect( grammaticalNumber( 3, 'no items', 'one item' ) ).toBe( 'one item' )
    } )

    it( 'returns empty string for null cases', () => {
        expect( grammaticalNumber( 0, null, null ) ).toBe( '' )
    } )
} )

// ---------------------------------------------------------------------------
// makeSet()
// ---------------------------------------------------------------------------

describe( 'makeSet', () => {
    it( 'creates a lookup object from an array', () => {
        expect( makeSet( [ 'a', 'b', 'c' ] ) ).toEqual( { a: true, b: true, c: true } )
    } )

    it( 'empty array produces empty object', () => {
        expect( makeSet( [] ) ).toEqual( {} )
    } )
} )

// ---------------------------------------------------------------------------
// makeDelayedCall()
// ---------------------------------------------------------------------------

describe( 'makeDelayedCall', () => {
    beforeEach( () => { vi.useFakeTimers() } )
    afterEach( () => { vi.useRealTimers() } )

    it( 'does not call fn immediately', () => {
        const fn = vi.fn()
        const d = makeDelayedCall( fn, { delay: 100 } )
        d()
        expect( fn ).not.toHaveBeenCalled()
    } )

    it( 'calls fn after the delay', () => {
        const fn = vi.fn()
        const d = makeDelayedCall( fn, { delay: 100 } )
        d()
        vi.advanceTimersByTime( 100 )
        expect( fn ).toHaveBeenCalledTimes( 1 )
    } )

    it( 'debounces — only last call fires', () => {
        const fn = vi.fn()
        const d = makeDelayedCall( fn, { delay: 200 } )
        d( 1 )
        vi.advanceTimersByTime( 100 )
        d( 2 )
        vi.advanceTimersByTime( 200 )
        expect( fn ).toHaveBeenCalledTimes( 1 )
        expect( fn ).toHaveBeenCalledWith( 2 )
    } )

    it( 'cancel() prevents the scheduled call', () => {
        const fn = vi.fn()
        const d = makeDelayedCall( fn, { delay: 100 } )
        d()
        d.cancel()
        vi.advanceTimersByTime( 200 )
        expect( fn ).not.toHaveBeenCalled()
    } )

    it( 'option.arguments overrides call-site arguments', () => {
        const fn = vi.fn()
        const d = makeDelayedCall( fn, { delay: 50, arguments: [ 'fixed' ] } )
        d( 'ignored' )
        vi.advanceTimersByTime( 100 )
        expect( fn ).toHaveBeenCalledWith( 'fixed' )
    } )
} )

// ---------------------------------------------------------------------------
// extractCRS()
// ---------------------------------------------------------------------------

describe( 'extractCRS', () => {
    it( 'extracts the CRS name from a standard GeoJSON CRS object', () => {
        expect( extractCRS( { properties: { name: 'EPSG:3857' } } ) ).toBe( 'EPSG:3857' )
    } )

    it( 'throws when properties.name is missing', () => {
        expect( () => extractCRS( { properties: {} } ) ).toThrow( 'unable to determine CRS' )
        expect( () => extractCRS( {} ) ).toThrow( 'unable to determine CRS' )
    } )
} )

// ---------------------------------------------------------------------------
// traverse
// ---------------------------------------------------------------------------

describe( 'traverse', () => {
    const double = ( c: number[] ) => c.map( x => x * 2 )

    it( 'traverses a Point', () => {
        const result = traverse.GeoJSON(
            { type: 'Point', coordinates: [ 1, 2 ] },
            { coordinate: double }
        )
        expect( result.coordinates ).toEqual( [ 2, 4 ] )
    } )

    it( 'traverses a LineString', () => {
        const result = traverse.GeoJSON(
            { type: 'LineString', coordinates: [ [ 1, 1 ], [ 2, 2 ] ] },
            { coordinate: double }
        )
        expect( result.coordinates ).toEqual( [ [ 2, 2 ], [ 4, 4 ] ] )
    } )

    it( 'traverses a Polygon', () => {
        const result = traverse.GeoJSON(
            { type: 'Polygon', coordinates: [ [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 0 ] ] ] },
            { coordinate: double }
        )
        expect( result.coordinates[ 0 ][ 1 ] ).toEqual( [ 2, 0 ] )
    } )

    it( 'traverses a Feature', () => {
        const result = traverse.GeoJSON( {
            type: 'Feature',
            properties: { name: 'test' },
            geometry: { type: 'Point', coordinates: [ 3, 4 ] },
        }, { coordinate: double } )
        expect( result.geometry.coordinates ).toEqual( [ 6, 8 ] )
    } )

    it( 'traverses a FeatureCollection', () => {
        const result = traverse.GeoJSON( {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [ 1, 2 ] } },
                { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [ 3, 4 ] } },
            ],
        }, { coordinate: double } )
        expect( result.features[ 0 ].geometry.coordinates ).toEqual( [ 2, 4 ] )
        expect( result.features[ 1 ].geometry.coordinates ).toEqual( [ 6, 8 ] )
    } )

    it( 'uses identity transform when no callback supplied', () => {
        const geojson = { type: 'Point', coordinates: [ 5, 6 ] }
        const result = traverse.GeoJSON( geojson )
        expect( result.coordinates ).toEqual( [ 5, 6 ] )
    } )
} )

// ---------------------------------------------------------------------------
// circlePoints()
// ---------------------------------------------------------------------------

describe( 'circlePoints', () => {
    it( 'returns segmentCount + 1 points (closed ring)', () => {
        expect( circlePoints( { x: 0, y: 0 }, 1, 8 ) ).toHaveLength( 9 )
    } )

    it( 'first and last point are the same (closed)', () => {
        const pts = circlePoints( { x: 0, y: 0 }, 1, 12 )
        // Use toBeCloseTo: sin(2π) produces a tiny non-zero float (~-2.4e-16)
        expect( pts[ 0 ][ 0 ] ).toBeCloseTo( pts[ pts.length - 1 ][ 0 ], 10 )
        expect( pts[ 0 ][ 1 ] ).toBeCloseTo( pts[ pts.length - 1 ][ 1 ], 10 )
    } )

    it( 'all points are on the circle', () => {
        const r = 5
        const pts = circlePoints( { x: 10, y: 20 }, r, 16 )
        for ( const [ x, y ] of pts ) {
            const dist = Math.sqrt( ( x - 10 ) ** 2 + ( y - 20 ) ** 2 )
            expect( dist ).toBeCloseTo( r, 10 )
        }
    } )
} )

// ---------------------------------------------------------------------------
// wrapFunction()
// ---------------------------------------------------------------------------

describe( 'wrapFunction', () => {
    it( 'replaces obj[fName] with the wrapped version', () => {
        const obj: any = { greet: ( name: string ) => `Hello ${name}` }
        wrapFunction( obj, 'greet', ( inner: any ) => ( name: string ) => inner( name ) + '!' )
        expect( obj.greet( 'World' ) ).toBe( 'Hello World!' )
    } )

    it( 'inner refers to the original function', () => {
        const original = vi.fn( () => 'orig' )
        const obj: any = { fn: original }
        wrapFunction( obj, 'fn', ( inner: any ) => () => 'wrapped:' + inner() )
        obj.fn()
        expect( original ).toHaveBeenCalledTimes( 1 )
    } )
} )

// ---------------------------------------------------------------------------
// asyncReduce()
// ---------------------------------------------------------------------------

describe( 'asyncReduce', () => {
    it( 'accumulates values across async iterations', async () => {
        const items = [ 1, 2, 3, 4 ]
        let i = 0
        const result = await asyncReduce( async ( accum, done ) => {
            if ( i >= items.length ) return done( accum )
            return accum + items[ i++ ]
        }, 0 )
        expect( result ).toBe( 10 )
    } )

    it( 'done() exits early', async () => {
        let calls = 0
        const result = await asyncReduce( async ( accum, done ) => {
            calls++
            return done( 99 )
        }, 0 )
        expect( result ).toBe( 99 )
        expect( calls ).toBe( 1 )
    } )
} )

// ---------------------------------------------------------------------------
// projection()
// ---------------------------------------------------------------------------

describe( 'projection', () => {
    it( 'picks specified keys from an object', () => {
        expect( projection( 'a', 'c' )( { a: 1, b: 2, c: 3 } ) ).toEqual( { a: 1, c: 3 } )
    } )

    it( 'omits keys not present in the source object', () => {
        expect( projection( 'a', 'x' )( { a: 1 } ) ).toEqual( { a: 1 } )
    } )

    it( 'returns empty object when no keys match', () => {
        expect( projection( 'x', 'y' )( { a: 1 } ) ).toEqual( {} )
    } )
} )

// ---------------------------------------------------------------------------
// makeId()
// ---------------------------------------------------------------------------

describe( 'makeId', () => {
    it( 'joins parts with =', () => {
        expect( makeId( 'Layer', 'Vector' ) ).toBe( 'layer=vector' )
    } )

    it( 'lowercases and replaces non-alphanumeric chars with -', () => {
        expect( makeId( 'My Layer Name' ) ).toBe( 'my-layer-name' )
    } )

    it( 'strips leading and trailing hyphens from each part', () => {
        expect( makeId( '  hello  ' ) ).toBe( 'hello' )
    } )

    it( 'filters out undefined parts', () => {
        expect( makeId( 'a', undefined, 'b' ) ).toBe( 'a=b' )
    } )

    it( 'uses ~ for empty parts after normalisation', () => {
        expect( makeId( '' ) ).toBe( '~' )
    } )
} )

// ---------------------------------------------------------------------------
// makeUUID()
// ---------------------------------------------------------------------------

describe( 'makeUUID', () => {
    it( 'matches the UUID v4 format', () => {
        const uuid = makeUUID()
        expect( uuid ).toMatch( /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ )
    } )

    it( 'generates unique values', () => {
        const ids = new Set( Array.from( { length: 100 }, makeUUID ) )
        expect( ids.size ).toBe( 100 )
    } )
} )

// ---------------------------------------------------------------------------
// getMetersPerUnit()
// ---------------------------------------------------------------------------

describe( 'getMetersPerUnit', () => {
    it( 'returns 1 for meters', () => {
        expect( getMetersPerUnit( 'm' ) ).toBe( 1 )
        expect( getMetersPerUnit( 'Meter' ) ).toBe( 1 )
    } )

    it( 'returns correct value for feet', () => {
        expect( getMetersPerUnit( 'ft' ) ).toBeCloseTo( 0.3048, 4 )
    } )

    it( 'throws for unknown unit', () => {
        expect( () => getMetersPerUnit( 'parsec' ) ).toThrow( 'parsec is an unknown unit' )
    } )
} )

// ---------------------------------------------------------------------------
// makeMutex()
// ---------------------------------------------------------------------------

describe( 'makeMutex', () => {
    it( 'lock is held immediately after acquire', () => {
        const acquire = makeMutex( 'test' )
        const lock = acquire()
        expect( lock.held() ).toBe( true )
    } )

    it( 'lock is not held after release', () => {
        const acquire = makeMutex( 'test' )
        const lock = acquire()
        lock.release()
        expect( lock.held() ).toBe( false )
    } )

    it( 'second acquire invalidates the first lock', () => {
        const acquire = makeMutex( 'test' )
        const first  = acquire()
        const second = acquire()
        expect( first.held() ).toBe( false )
        expect( second.held() ).toBe( true )
    } )

    it( 'lock carries the supplied name', () => {
        const acquire = makeMutex( 'myMutex' )
        expect( acquire().name ).toBe( 'myMutex' )
    } )
} )
