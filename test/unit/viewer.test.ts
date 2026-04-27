/**
 * Unit tests for src/smk/viewer.ts
 *
 * Most of the viewer behaviour depends on concrete subclasses (leaflet / esri3d)
 * and on unconverted deps (feature-set, layer-display, base-maps, turf).
 *
 * These tests cover the parts that are self-contained:
 *   - ViewerEvent mixin wiring
 *   - zoomScale table + getZoomBracketForScale
 *   - loading property accessor
 *   - constructor invariants
 *   - getZoomBracketForScale edge cases
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Viewer }                               from '../../src/smk/viewer'

// ---------------------------------------------------------------------------
// ViewerEvent integration
// ---------------------------------------------------------------------------

describe( 'Viewer — event mixin', () => {
    it( 'Viewer is a constructor', () => {
        expect( typeof Viewer ).toBe( 'function' )
    } )

    it( 'prototype chain includes all ViewerEvent methods', () => {
        const v = new Viewer()
        const methods = [
            'changedView',
            'changedBaseMap',
            'startedLoading',
            'finishedLoading',
            'pickedLocation',
            'changedLocation',
            'changedPopup',
            'changedLayerVisibility',
            'changedDevice',
            'destroy',
        ]
        methods.forEach( m =>
            expect( typeof ( v as any )[ m ], `method ${ m }` ).toBe( 'function' )
        )
    } )

    it( 'two instances have independent dispatchers', () => {
        const a   = new Viewer()
        const b   = new Viewer()
        const log: string[] = []

        ;( a as any ).changedView( () => log.push( 'a' ) )
        ;( b as any ).changedView( () => log.push( 'b' ) )

        ;( a as any ).changedView()
        expect( log ).toEqual( [ 'a' ] )
        ;( b as any ).changedView()
        expect( log ).toEqual( [ 'a', 'b' ] )
    } )
} )

// ---------------------------------------------------------------------------
// Loading accessor
// ---------------------------------------------------------------------------

describe( 'Viewer — loading property', () => {
    it( 'starts as false', () => {
        const v = new Viewer()
        expect( v.loading ).toBe( false )
    } )

    it( 'setting loading=true fires startedLoading', () => {
        const v  = new Viewer()
        const fn = vi.fn()
        ;( v as any ).startedLoading( fn )
        v.loading = true
        expect( fn ).toHaveBeenCalledTimes( 1 )
    } )

    it( 'setting loading=false fires finishedLoading', () => {
        const v  = new Viewer()
        const fn = vi.fn()
        ;( v as any ).finishedLoading( fn )
        v.loading = true
        v.loading = false
        expect( fn ).toHaveBeenCalledTimes( 1 )
    } )

    it( 'no event when setting to same value', () => {
        const v  = new Viewer()
        const fn = vi.fn()
        ;( v as any ).startedLoading( fn )
        ;( v as any ).finishedLoading( fn )
        v.loading = false   // already false
        expect( fn ).not.toHaveBeenCalled()
        v.loading = true
        v.loading = true    // same
        expect( fn ).toHaveBeenCalledTimes( 1 )
    } )
} )

// ---------------------------------------------------------------------------
// Zoom scale table
// ---------------------------------------------------------------------------

describe( 'Viewer — zoomScale table', () => {
    it( 'zoomScale has entries from index 1 to 19', () => {
        const v = new Viewer()
        for ( let z = 1; z <= 19; z++ ) {
            expect( v.zoomScale[ z ] ).toBeGreaterThan( 0 )
        }
    } )

    it( 'scale decreases as zoom level increases', () => {
        const v = new Viewer()
        for ( let z = 2; z <= 19; z++ ) {
            expect( v.zoomScale[ z ] ).toBeLessThan( v.zoomScale[ z - 1 ] )
        }
    } )
} )

// ---------------------------------------------------------------------------
// getZoomBracketForScale
// ---------------------------------------------------------------------------

describe( 'Viewer#getZoomBracketForScale', () => {
    let v: Viewer

    beforeEach( () => { v = new Viewer() } )

    it( 'returns [0,1] when scale is larger than zoom-1 scale (very zoomed out)', () => {
        const veryLarge = v.zoomScale[ 1 ] * 2
        expect( v.getZoomBracketForScale( veryLarge ) ).toEqual( [ 0, 1 ] )
    } )

    it( 'returns [19,20] when scale is smaller than zoom-19 scale (very zoomed in)', () => {
        const verySmall = v.zoomScale[ 19 ] / 2
        expect( v.getZoomBracketForScale( verySmall ) ).toEqual( [ 19, 20 ] )
    } )

    it( 'finds a bracket straddling a midpoint scale', () => {
        // pick a scale value between zoom 5 and zoom 6
        const midScale = ( v.zoomScale[ 5 ] + v.zoomScale[ 6 ] ) / 2
        const bracket  = v.getZoomBracketForScale( midScale )
        expect( bracket ).toEqual( [ 5, 6 ] )
    } )

    it( 'scale exactly equal to a zoom level - bracket below it', () => {
        const exactScale = v.zoomScale[ 10 ]
        const bracket    = v.getZoomBracketForScale( exactScale )
        // scale > zoomScale[10] is false (equal), scale > zoomScale[11] is true
        // so the loop returns [10, 11]
        expect( bracket ).toEqual( [ 10, 11 ] )
    } )
} )

// ---------------------------------------------------------------------------
// distanceToMeters / distanceFromMeters (no DOM or network involved)
// ---------------------------------------------------------------------------

describe( 'Viewer#distanceToMeters / distanceFromMeters', () => {
    let v: Viewer

    beforeEach( () => { v = new Viewer() } )

    it( 'converts Yard to m', () => {
        // 1 yard = 0.9144 m (approximately)
        expect( v.distanceToMeters( 1, 'Yard' ) ).toBeCloseTo( 0.9144, 3 )
    } )

    it( 'round-trips Meter to m Meter', () => {
        const d = 42.5
        expect( v.distanceFromMeters( v.distanceToMeters( d, 'Meter' ), 'Meter' ) ).toBeCloseTo( d, 5 )
    } )

    it( 'converts m to m (no-op)', () => {
        expect( v.distanceToMeters( 500, 'm' ) ).toBeCloseTo( 500, 3 )
    } )
} )

// ---------------------------------------------------------------------------
// resolveAttachmentUrl
// ---------------------------------------------------------------------------

describe( 'Viewer#resolveAttachmentUrl', () => {
    let v: Viewer

    beforeEach( () => {
        v = new Viewer()
        v.serviceUrl = undefined
        v.lmfId      = 'map-001'
        v.resolveUrl = ( url: string ) => `/resolved/${ url }`
    } )

    it( 'returns a direct URL unchanged', () => {
        expect( v.resolveAttachmentUrl( 'http://x.example/image.png' ) )
            .toBe( 'http://x.example/image.png' )
    } )

    it( '@id shorthand resolves via resolveUrl (no serviceUrl)', () => {
        expect( v.resolveAttachmentUrl( '@some-icon' ) )
            .toBe( '/resolved/attachments/some-icon' )
    } )

    it( 'id only resolves via resolveUrl', () => {
        expect( v.resolveAttachmentUrl( null, 'abc', 'png' ) )
            .toBe( '/resolved/attachments/abc.png' )
    } )

    it( 'with serviceUrl uses REST endpoint', () => {
        v.serviceUrl = 'https://svc.example'
        expect( v.resolveAttachmentUrl( null, 'img-01' ) )
            .toBe( 'https://svc.example/MapConfigurations/map-001/Attachments/img-01' )
    } )

    it( 'no url no id no required=false throws', () => {
        expect( () => v.resolveAttachmentUrl( null ) ).toThrow()
    } )

    it( 'no url no id with required=false returns undefined', () => {
        expect( v.resolveAttachmentUrl( null, undefined, undefined, false ) ).toBeUndefined()
    } )
} )
