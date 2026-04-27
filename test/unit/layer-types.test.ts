/**
 * Unit tests for src/smk/layer/layer-types.ts
 *
 * Tests cover construction, method existence, and behaviour that can be
 * exercised in a Node / jsdom environment (no browser canvas or network).
 * Network methods (initLegends / getFeaturesInArea / getFeaturesAtPoint) are
 * tested with mocked fetch and/or DOM stubs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    VectorLayer,
    WmsLayer,
    EsriDynamicLayer,
    EsriFeatureLayer,
    EsriTiledLayer,
    ClusterLayer,
} from '../../src/smk/layer/layer-types'
import { Layer } from '../../src/smk/layer/layer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig( extra: Record<string, unknown> = {} ): any {
    return {
        id:         'test-layer',
        type:       'test',
        title:      'Test Layer',
        isVisible:  true,
        isQueryable: true,
        style:      [],
        legend:     {},
        ...extra,
    }
}

// Minimal fetch mock: returns the given JSON payload or rejects.
function mockFetchOk( payload: unknown ) {
    return vi.fn().mockResolvedValue( {
        ok:   true,
        json: () => Promise.resolve( payload ),
    } )
}

function mockFetchFail( status = 500 ) {
    return vi.fn().mockResolvedValue( {
        ok:     false,
        status,
        json:   () => Promise.resolve( {} ),
    } )
}

// ---------------------------------------------------------------------------
// Layer type registration
// ---------------------------------------------------------------------------

describe( 'Layer type registration', () => {
    it( 'Layer["vector"] is VectorLayer', () => {
        expect( ( Layer as any )[ 'vector' ] ).toBe( VectorLayer )
    } )

    it( 'Layer["wms"] is WmsLayer', () => {
        expect( ( Layer as any )[ 'wms' ] ).toBe( WmsLayer )
    } )

    it( 'Layer["esri-dynamic"] is EsriDynamicLayer', () => {
        expect( ( Layer as any )[ 'esri-dynamic' ] ).toBe( EsriDynamicLayer )
    } )

    it( 'Layer["esri-feature"] is EsriFeatureLayer', () => {
        expect( ( Layer as any )[ 'esri-feature' ] ).toBe( EsriFeatureLayer )
    } )

    it( 'Layer["esri-tiled"] is EsriTiledLayer', () => {
        expect( ( Layer as any )[ 'esri-tiled' ] ).toBe( EsriTiledLayer )
    } )

    it( 'Layer["cluster"] is ClusterLayer', () => {
        expect( ( Layer as any )[ 'cluster' ] ).toBe( ClusterLayer )
    } )
} )

// ---------------------------------------------------------------------------
// VectorLayer
// ---------------------------------------------------------------------------

describe( 'VectorLayer', () => {
    it( 'extends Layer', () => {
        const vl = new VectorLayer( makeConfig() )
        expect( vl ).toBeInstanceOf( Layer )
    } )

    it( 'constructed with config', () => {
        const cfg = makeConfig( { title: 'My Vectors' } )
        const vl  = new VectorLayer( cfg )
        expect( ( vl.config as any ).title ).toBe( 'My Vectors' )
    } )

    it( 'load() sets loadCache when loadLayer is absent', () => {
        const vl = new VectorLayer( makeConfig() ) as any
        vl.load( { type: 'FeatureCollection', features: [] } )
        expect( vl.loadCache ).toBeDefined()
    } )

    it( 'load() delegates to loadLayer when present', () => {
        const vl = new VectorLayer( makeConfig() ) as any
        const spy = vi.fn()
        vl.loadLayer = spy
        vl.load( { features: [] } )
        expect( spy ).toHaveBeenCalledOnce()
    } )

    it( 'load() no-ops for falsy data', () => {
        const vl = new VectorLayer( makeConfig() ) as any
        expect( () => vl.load( null ) ).not.toThrow()
    } )

    it( 'clear() delegates to clearLayer when present', () => {
        const vl  = new VectorLayer( makeConfig() ) as any
        const spy = vi.fn()
        vl.clearLayer = spy
        vl.clear()
        expect( spy ).toHaveBeenCalledOnce()
    } )

    it( 'clear() is safe when clearLayer is absent', () => {
        const vl = new VectorLayer( makeConfig() ) as any
        expect( () => vl.clear() ).not.toThrow()
    } )

    it( 'has initLegends method', () => {
        const vl = new VectorLayer( makeConfig() )
        expect( typeof vl.initLegends ).toBe( 'function' )
    } )
} )

// ---------------------------------------------------------------------------
// WmsLayer
// ---------------------------------------------------------------------------

describe( 'WmsLayer', () => {
    it( 'extends Layer', () => {
        expect( new WmsLayer( makeConfig() ) ).toBeInstanceOf( Layer )
    } )

    describe( 'canMergeWith()', () => {
        it( 'returns false when canMerge is false on either', () => {
            const a = new WmsLayer( makeConfig( { canMerge: true,  serviceUrl: 'http://x', opacity: 1 } ) )
            const b = new WmsLayer( makeConfig( { canMerge: false, serviceUrl: 'http://x', opacity: 1 } ) )
            expect( a.canMergeWith( b ) ).toBe( false )
        } )

        it( 'returns false when serviceUrl differs', () => {
            const a = new WmsLayer( makeConfig( { canMerge: true, serviceUrl: 'http://x', opacity: 1 } ) )
            const b = new WmsLayer( makeConfig( { canMerge: true, serviceUrl: 'http://y', opacity: 1 } ) )
            expect( a.canMergeWith( b ) ).toBe( false )
        } )

        it( 'returns false when opacity differs', () => {
            const a = new WmsLayer( makeConfig( { canMerge: true, serviceUrl: 'http://x', opacity: 0.5 } ) )
            const b = new WmsLayer( makeConfig( { canMerge: true, serviceUrl: 'http://x', opacity: 1.0 } ) )
            expect( a.canMergeWith( b ) ).toBe( false )
        } )

        it( 'returns false when type differs', () => {
            const a = new WmsLayer( makeConfig( { canMerge: true, serviceUrl: 'http://x', opacity: 1, type: 'wms'  } ) )
            const b = new WmsLayer( makeConfig( { canMerge: true, serviceUrl: 'http://x', opacity: 1, type: 'wms2' } ) )
            expect( a.canMergeWith( b ) ).toBe( false )
        } )

        it( 'returns true when all properties match', () => {
            const cfg = makeConfig( { canMerge: true, serviceUrl: 'http://x', opacity: 1, type: 'wms' } )
            const a   = new WmsLayer( cfg )
            const b   = new WmsLayer( { ...cfg } )
            expect( a.canMergeWith( b ) ).toBe( true )
        } )
    } )

    describe( 'getFeaturesInArea()', () => {
        beforeEach( () => {
            vi.stubGlobal( 'fetch', mockFetchOk( {
                features: [
                    { type: 'Feature', geometry: null, properties: { name: 'A' } },
                ],
            } ) )
        } )
        afterEach( () => vi.restoreAllMocks() )

        it( 'resolves with features array', async () => {
            const wl = new WmsLayer( makeConfig( {
                serviceUrl: 'http://wms.example.com/ows',
                layerName:  'my:layer',
            } ) )
            const area = {
                geometry: { coordinates: [ [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 0 ] ] ] },
            }
            const view = { extent: [ 0, 0, 1, 1 ], screen: { width: 100, height: 100 } }
            const result = await wl.getFeaturesInArea( area, view, {} )
            expect( result ).toHaveLength( 1 )
        } )

        it( 'assigns title from titleAttribute when present', async () => {
            const wl = new WmsLayer( makeConfig( {
                serviceUrl:     'http://wms.example.com/ows',
                layerName:      'my:layer',
                titleAttribute: 'name',
            } ) )
            const area = {
                geometry: { coordinates: [ [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 0 ] ] ] },
            }
            const view = { extent: [ 0, 0, 1, 1 ], screen: { width: 100, height: 100 } }
            const result: any[] = await wl.getFeaturesInArea( area, view, {} )
            expect( result[ 0 ].title ).toBe( 'A' )
        } )

        it( 'assigns sequential title when no titleAttribute', async () => {
            const wl = new WmsLayer( makeConfig( {
                serviceUrl: 'http://wms.example.com/ows',
                layerName:  'my:layer',
            } ) )
            const area = {
                geometry: { coordinates: [ [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 0 ] ] ] },
            }
            const view = { extent: [ 0, 0, 1, 1 ], screen: { width: 100, height: 100 } }
            const result: any[] = await wl.getFeaturesInArea( area, view, {} )
            expect( result[ 0 ].title ).toBe( 'Feature #1' )
        } )

        it( 'throws when features array is empty', async () => {
            vi.stubGlobal( 'fetch', mockFetchOk( { features: [] } ) )
            const wl = new WmsLayer( makeConfig( {
                serviceUrl: 'http://wms.example.com/ows',
                layerName:  'my:layer',
            } ) )
            const area = { geometry: { coordinates: [ [ [ 0, 0 ], [ 0, 0 ] ] ] } }
            const view = { extent: [ 0, 0, 1, 1 ], screen: { width: 100, height: 100 } }
            await expect( wl.getFeaturesInArea( area, view, {} ) ).rejects.toThrow( 'no features' )
        } )
    } )
} )

// ---------------------------------------------------------------------------
// EsriDynamicLayer
// ---------------------------------------------------------------------------

describe( 'EsriDynamicLayer', () => {
    it( 'extends Layer', () => {
        expect( new EsriDynamicLayer( makeConfig() ) ).toBeInstanceOf( Layer )
    } )

    describe( 'initLegends()', () => {
        afterEach( () => vi.restoreAllMocks() )

        it( 'resolves legend array from service response', async () => {
            vi.stubGlobal( 'fetch', mockFetchOk( {
                layers: [ { legend: [
                    { imageData: 'abc', label: 'Class A' },
                ] } ],
            } ) )
            const layer = new EsriDynamicLayer( makeConfig( {
                serviceUrl:    'http://esri.example.com/rest/services/Foo/MapServer',
                dynamicLayers: [ '{"id":0}' ],
            } ) )
            const result: any[] = await layer.initLegends()
            expect( result[ 0 ].title ).toBe( 'Class A' )
            expect( result[ 0 ].url   ).toContain( 'data:image/png;base64,' )
        } )
    } )

    describe( 'getFeaturesInArea()', () => {
        beforeEach( () => {
            // Terraformer stub
            ;( global as any ).window = { ...( global as any ).window, Terraformer: {
                ArcGIS: {
                    convert: ( _f: any ) => ( { geometry: { rings: [] } } ),
                    parse:   ( g: any ) => ( { type: 'Polygon', coordinates: [] } ),
                }
            } }

            vi.stubGlobal( 'fetch', mockFetchOk( {
                results: [ {
                    displayFieldName: 'NAME',
                    attributes:       { NAME: 'Test Feature' },
                    geometry:         {},
                } ],
            } ) )
        } )
        afterEach( () => vi.restoreAllMocks() )

        it( 'maps results to features', async () => {
            const layer = new EsriDynamicLayer( makeConfig( {
                serviceUrl:    'http://esri.example.com/rest/services/Foo/MapServer',
                dynamicLayers: [ '{"id":0}' ],
            } ) )
            const area = { geometry: { coordinates: [ [] ] } }
            const view = { extent: [ 0, 0, 1, 1 ], screen: { width: 100, height: 100 } }
            const features: any[] = await layer.getFeaturesInArea( area, view, {} )
            expect( features[ 0 ].title ).toBe( 'Test Feature' )
        } )

        it( 'throws when results is empty', async () => {
            vi.stubGlobal( 'fetch', mockFetchOk( { results: [] } ) )
            const layer = new EsriDynamicLayer( makeConfig( {
                serviceUrl:    'http://esri.example.com/rest/services/Foo/MapServer',
                dynamicLayers: [ '{"id":0}' ],
            } ) )
            const area = { geometry: { coordinates: [ [] ] } }
            const view = { extent: [ 0, 0, 1, 1 ], screen: { width: 100, height: 100 } }
            await expect( layer.getFeaturesInArea( area, view, {} ) ).rejects.toThrow( 'no features' )
        } )
    } )
} )

// ---------------------------------------------------------------------------
// EsriFeatureLayer
// ---------------------------------------------------------------------------

describe( 'EsriFeatureLayer', () => {
    it( 'extends Layer', () => {
        expect( new EsriFeatureLayer( makeConfig() ) ).toBeInstanceOf( Layer )
    } )

    it( 'has legendCache and legendCacheResolve', () => {
        const layer = new EsriFeatureLayer( makeConfig() )
        expect( layer.legendCache ).toBeInstanceOf( Promise )
        expect( typeof layer.legendCacheResolve ).toBe( 'function' )
    } )

    it( 'initLegends resolves after legendCacheResolve is called', async () => {
        const layer = new EsriFeatureLayer( makeConfig() )
        layer.legendCacheResolve( [
            { imageData: 'aaa', label: 'Red', height: 20, width: 20 },
        ] )
        const legends: any[] = await layer.initLegends()
        expect( legends[ 0 ].title ).toBe( 'Red' )
        expect( legends[ 0 ].url   ).toContain( 'data:image/png;base64,' )
    } )

    it( 'initLegends returns empty array when resolved with undefined', async () => {
        const layer = new EsriFeatureLayer( makeConfig() )
        layer.legendCacheResolve( undefined )
        const legends = await layer.initLegends()
        expect( legends ).toEqual( [] )
    } )

    describe( 'getFeaturesInArea()', () => {
        beforeEach( () => {
            ;( global as any ).window = { ...( global as any ).window, Terraformer: {
                ArcGIS: {
                    convert: ( _f: any ) => ( { geometry: { rings: [] } } ),
                    parse:   ( _g: any ) => ( { type: 'Polygon', coordinates: [] } ),
                }
            } }
            vi.stubGlobal( 'fetch', mockFetchOk( {
                features: [ {
                    displayFieldName: 'LABEL',
                    attributes:       { LABEL: 'Park A' },
                    geometry:         {},
                } ],
            } ) )
        } )
        afterEach( () => vi.restoreAllMocks() )

        it( 'maps features with title from displayFieldName', async () => {
            const layer = new EsriFeatureLayer( makeConfig( {
                serviceUrl: 'http://esri.example.com/rest/services/Foo/FeatureServer/0',
            } ) )
            const area = { geometry: { coordinates: [ [] ] } }
            const view = { extent: [ 0, 0, 1, 1 ], screen: { width: 100, height: 100 } }
            const result: any[] = await layer.getFeaturesInArea( area, view, {} )
            expect( result[ 0 ].title ).toBe( 'Park A' )
        } )
    } )
} )

// ---------------------------------------------------------------------------
// EsriTiledLayer
// ---------------------------------------------------------------------------

describe( 'EsriTiledLayer', () => {
    it( 'extends Layer', () => {
        expect( new EsriTiledLayer( makeConfig() ) ).toBeInstanceOf( Layer )
    } )

    describe( 'initLegends()', () => {
        afterEach( () => vi.restoreAllMocks() )

        it( 'resolves legend entries from service', async () => {
            vi.stubGlobal( 'fetch', mockFetchOk( {
                layers: [ { legend: [
                    { imageData: 'xyz', label: 'Roads' },
                ] } ],
            } ) )
            const layer = new EsriTiledLayer( makeConfig( {
                serviceUrl: 'http://esri.example.com/rest/services/Base/TileServer',
            } ) )
            const result: any[] = await layer.initLegends()
            expect( result[ 0 ].title ).toBe( 'Roads' )
        } )
    } )
} )

// ---------------------------------------------------------------------------
// ClusterLayer
// ---------------------------------------------------------------------------

describe( 'ClusterLayer', () => {
    it( 'extends Layer', () => {
        expect( new ClusterLayer( makeConfig() ) ).toBeInstanceOf( Layer )
    } )

    it( 'sets isQueryable to false in constructor', () => {
        const layer = new ClusterLayer( makeConfig( { isQueryable: true } ) )
        expect( ( layer.config as any ).isQueryable ).toBe( false )
    } )

    it( 'isQueryable is false even when not passed in config', () => {
        const cfg = makeConfig()
        delete cfg.isQueryable
        const layer = new ClusterLayer( cfg )
        expect( ( layer.config as any ).isQueryable ).toBe( false )
    } )
} )
