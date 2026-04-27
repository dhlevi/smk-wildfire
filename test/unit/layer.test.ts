/**
 * Unit tests for src/smk/layer/layer.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Layer, type LayerConfig }              from '../../src/smk/layer/layer'
import { SMKEvent }                             from '../../src/smk/event'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig( overrides: Partial<LayerConfig> = {} ): LayerConfig {
    return Object.assign( { id: 'test-layer', type: 'wms' }, overrides )
}

// ---------------------------------------------------------------------------
// LayerEvent integration (via SMKEvent.define)
// ---------------------------------------------------------------------------

describe( 'Layer — event mixin', () => {
    it( 'Layer is a constructor', () => {
        expect( typeof Layer ).toBe( 'function' )
    } )

    it( 'prototype chain includes LayerEvent methods', () => {
        const ly = new Layer( makeConfig() )
        expect( typeof ( ly as any ).startedLoading ).toBe( 'function' )
        expect( typeof ( ly as any ).finishedLoading ).toBe( 'function' )
        expect( typeof ( ly as any ).changedFeature ).toBe( 'function' )
        expect( typeof ( ly as any ).destroy ).toBe( 'function' )
    } )

    it( 'inherits from SMKEvent', () => {
        const ly = new Layer( makeConfig() )
        expect( ly ).toBeInstanceOf( Layer )
        // SMKEvent prototype methods should be reachable
        expect( typeof ( ly as any ).destroy ).toBe( 'function' )
    } )

    it( 'two instances have independent dispatchers', () => {
        const a   = new Layer( makeConfig( { id: 'a' } ) )
        const b   = new Layer( makeConfig( { id: 'b' } ) )
        const log: string[] = []

        ;( a as any ).startedLoading( () => log.push( 'a' ) )
        ;( b as any ).startedLoading( () => log.push( 'b' ) )

        ;( a as any ).startedLoading()
        expect( log ).toEqual( [ 'a' ] )

        ;( b as any ).startedLoading()
        expect( log ).toEqual( [ 'a', 'b' ] )
    } )
} )

// ---------------------------------------------------------------------------
// Constructor & property accessors
// ---------------------------------------------------------------------------

describe( 'Layer — constructor', () => {
    it( 'stores config reference', () => {
        const cfg = makeConfig()
        const ly  = new Layer( cfg )
        expect( ly.config ).toBe( cfg )
    } )

    it( 'id accessor returns config.id', () => {
        const ly = new Layer( makeConfig( { id: 'my-layer' } ) )
        expect( ly.id ).toBe( 'my-layer' )
    } )

    it( 'loading starts as false', () => {
        const ly = new Layer( makeConfig() )
        expect( ly.loading ).toBe( false )
    } )

    it( 'setting loading=true fires startedLoading', () => {
        const ly      = new Layer( makeConfig() )
        const started = vi.fn()
        ;( ly as any ).startedLoading( started )
        ly.loading = true
        expect( started ).toHaveBeenCalledTimes( 1 )
    } )

    it( 'setting loading=false fires finishedLoading', () => {
        const ly       = new Layer( makeConfig() )
        const finished = vi.fn()
        ;( ly as any ).finishedLoading( finished )
        ly.loading = true
        ly.loading = false
        expect( finished ).toHaveBeenCalledTimes( 1 )
    } )

    it( 'setting loading to same value does not fire events', () => {
        const ly  = new Layer( makeConfig() )
        const fn  = vi.fn()
        ;( ly as any ).startedLoading( fn )
        ;( ly as any ).finishedLoading( fn )
        ly.loading = false    // already false — no-op
        expect( fn ).not.toHaveBeenCalled()
        ly.loading = true
        ly.loading = true     // same value — no-op
        expect( fn ).toHaveBeenCalledTimes( 1 )
    } )
} )

// ---------------------------------------------------------------------------
// inScaleRange
// ---------------------------------------------------------------------------

describe( 'Layer#inScaleRange', () => {
    it( 'returns true when no scale limits defined', () => {
        const ly = new Layer( makeConfig() )
        expect( ly.inScaleRange( { scale: 50000 } ) ).toBe( true )
    } )

    it( 'returns false when scale is above maxScale (too zoomed out)', () => {
        const ly = new Layer( makeConfig( { maxScale: 10000 } ) )
        // scale = 5000 < maxScale = 10000 out of range (too zoomed in)
        expect( ly.inScaleRange( { scale: 5000 } ) ).toBe( false )
    } )

    it( 'returns false when scale is below minScale (too zoomed in)', () => {
        const ly = new Layer( makeConfig( { minScale: 100000 } ) )
        // scale = 200000 > minScale = 100000 out of range (too zoomed out)
        expect( ly.inScaleRange( { scale: 200000 } ) ).toBe( false )
    } )

    it( 'returns true when scale is within [maxScale, minScale]', () => {
        const ly = new Layer( makeConfig( { minScale: 500000, maxScale: 1000 } ) )
        expect( ly.inScaleRange( { scale: 50000 } ) ).toBe( true )
    } )

    it( 'handles minScale only', () => {
        const ly = new Layer( makeConfig( { minScale: 100000 } ) )
        expect( ly.inScaleRange( { scale: 50000 } ) ).toBe( true )
        expect( ly.inScaleRange( { scale: 200000 } ) ).toBe( false )
    } )
} )

// ---------------------------------------------------------------------------
// canMergeWith
// ---------------------------------------------------------------------------

describe( 'Layer#canMergeWith', () => {
    it( 'returns false by default', () => {
        const a = new Layer( makeConfig( { id: 'a' } ) )
        const b = new Layer( makeConfig( { id: 'b' } ) )
        expect( a.canMergeWith( b ) ).toBe( false )
    } )
} )

// ---------------------------------------------------------------------------
// canAddToMap
// ---------------------------------------------------------------------------

describe( 'Layer#canAddToMap', () => {
    it( 'returns true by default', () => {
        const ly = new Layer( makeConfig() )
        expect( ly.canAddToMap() ).toBe( true )
    } )
} )

// ---------------------------------------------------------------------------
// getConfig
// ---------------------------------------------------------------------------

describe( 'Layer#getConfig', () => {
    it( 'returns the config object', () => {
        const cfg = makeConfig( { title: 'My Layer' } )
        const ly  = new Layer( cfg )
        expect( ly.getConfig() ).toBe( cfg )
    } )
} )

// ---------------------------------------------------------------------------
// getLegends (async)
// ---------------------------------------------------------------------------

describe( 'Layer#getLegends', () => {
    it( 'returns an empty array by default (initLegends stub)', async () => {
        const ly = new Layer( makeConfig() )
        const legends = await ly.getLegends()
        expect( legends ).toEqual( [] )
    } )

    it( 'caches the legendPromise on second call', () => {
        const ly = new Layer( makeConfig() )
        const p1 = ly.getLegends()
        const p2 = ly.getLegends()
        expect( p1 ).toBe( p2 )
    } )

    it( 'applies style properties to each legend entry', async () => {
        const ly = new Layer( makeConfig() )
        // Swap initLegends to return a fake legend entry
        ly.initLegends = () =>
            Promise.resolve( [ { url: 'http://x', width: 20, height: 10 } ] )
        const legends = await ly.getLegends()
        expect( legends[ 0 ].style[ 'background-image' ] ).toBe( 'url( http://x)' )
        expect( legends[ 0 ].style[ 'width' ] ).toBe( '20px' )
    } )
} )

// ---------------------------------------------------------------------------
// getFeaturesAtPoint (stub)
// ---------------------------------------------------------------------------

describe( 'Layer#getFeaturesAtPoint', () => {
    it( 'returns undefined (base implementation is a stub)', () => {
        const ly   = new Layer( makeConfig() )
        const result = ly.getFeaturesAtPoint( { x: 0, y: 0 } )
        expect( result ).toBeUndefined()
    } )
} )
