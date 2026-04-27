/**
 * Unit tests for src/smk/feature-set.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FeatureSet, type GeoFeature }           from '../../src/smk/feature-set'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFeature( id: string, extra: Partial<GeoFeature> = {} ): GeoFeature {
    return Object.assign( {
        properties: { name: id },
        geometry:   { type: 'Point', coordinates: [ 0, 0 ] },
    }, extra )
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe( 'FeatureSet — construction', () => {
    it( 'creates with empty featureSet', () => {
        const fs = new FeatureSet()
        expect( fs.featureSet ).toEqual( {} )
    } )

    it( 'pickedFeatureId starts null', () => {
        const fs = new FeatureSet()
        expect( fs.pickedFeatureId ).toBeNull()
    } )

    it( 'highlightedFeatureId starts empty', () => {
        const fs = new FeatureSet()
        expect( fs.highlightedFeatureId ).toEqual( {} )
    } )

    it( 'event methods are available', () => {
        const fs = new FeatureSet()
        const methods = [
            'addedFeatures', 'removedFeatures', 'pickedFeature',
            'zoomToFeature', 'highlightedFeatures', 'clearedFeatures', 'destroy',
        ]
        methods.forEach( m =>
            expect( typeof ( fs as any )[ m ], `method ${ m }` ).toBe( 'function' )
        )
    } )

    it( 'two instances have independent state', () => {
        const a = new FeatureSet()
        const b = new FeatureSet()
        a.add( 'layer-a', [ makeFeature( 'x' ) ] )
        expect( b.isEmpty() ).toBe( true )
    } )
} )

// ---------------------------------------------------------------------------
// add()
// ---------------------------------------------------------------------------

describe( 'FeatureSet#add', () => {
    let fs: FeatureSet

    beforeEach( () => { fs = new FeatureSet() } )

    it( 'returns ids for added features', () => {
        const f  = makeFeature( 'alpha' )
        const ids = fs.add( 'layer1', [ f ] )
        expect( ids ).toHaveLength( 1 )
        expect( typeof ids[ 0 ] ).toBe( 'string' )
    } )

    it( 'assigns id and layerId to each feature', () => {
        const f = makeFeature( 'beta' )
        const [ id ] = fs.add( 'layer-x', [ f ] )
        expect( f.id ).toBe( id )
        expect( f.layerId ).toBe( 'layer-x' )
    } )

    it( 'fires addedFeatures event', () => {
        const fn = vi.fn()
        ;( fs as any ).addedFeatures( fn )
        fs.add( 'layer1', [ makeFeature( 'g' ) ] )
        expect( fn ).toHaveBeenCalledTimes( 1 )
        expect( fn.mock.calls[ 0 ][ 0 ].layerId ).toBe( 'layer1' )
    } )

    it( 'does not fire addedFeatures when empty array', () => {
        const fn = vi.fn()
        ;( fs as any ).addedFeatures( fn )
        fs.add( 'layer1', [] )
        expect( fn ).not.toHaveBeenCalled()
    } )

    it( 'skips duplicate features (same properties + geometry)', () => {
        const f = makeFeature( 'dup' )
        fs.add( 'layer1', [ f ] )
        const ids2 = fs.add( 'layer1', [ f ] )
        expect( ids2 ).toHaveLength( 0 )
        expect( Object.keys( fs.featureSet ) ).toHaveLength( 1 )
    } )

    it( 'handles multiple features', () => {
        const ids = fs.add( 'layer1', [
            makeFeature( 'a' ),
            makeFeature( 'b' ),
            makeFeature( 'c' ),
        ] )
        expect( ids ).toHaveLength( 3 )
        expect( Object.keys( fs.featureSet ) ).toHaveLength( 3 )
    } )

    it( 'uses keyAttribute when present', () => {
        const f: GeoFeature = { properties: { fid: 'mykey' }, geometry: null }
        const [ id ] = fs.add( 'layer1', [ f ], 'fid' )
        expect( typeof id ).toBe( 'string' )
        expect( fs.has( id ) ).toBe( true )
    } )
} )

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

describe( 'FeatureSet#remove', () => {
    let fs: FeatureSet

    beforeEach( () => { fs = new FeatureSet() } )

    it( 'removes feature and returns its id', () => {
        const [ id ] = fs.add( 'layer1', [ makeFeature( 'r' ) ] )
        const removed = fs.remove( [ id ] )
        expect( removed ).toEqual( [ id ] )
        expect( fs.has( id ) ).toBe( false )
    } )

    it( 'fires removedFeatures event', () => {
        const fn = vi.fn()
        ;( fs as any ).removedFeatures( fn )
        const [ id ] = fs.add( 'layer1', [ makeFeature( 'r2' ) ] )
        fs.remove( [ id ] )
        expect( fn ).toHaveBeenCalledTimes( 1 )
        expect( fn.mock.calls[ 0 ][ 0 ].features ).toHaveLength( 1 )
    } )

    it( 'silently ignores unknown ids', () => {
        const ids = fs.remove( [ 'non-existent' ] )
        expect( ids ).toHaveLength( 0 )
    } )
} )

// ---------------------------------------------------------------------------
// clear()
// ---------------------------------------------------------------------------

describe( 'FeatureSet#clear', () => {
    it( 'removes all features', () => {
        const fs = new FeatureSet()
        fs.add( 'layer1', [ makeFeature( 'c1' ), makeFeature( 'c2' ) ] )
        fs.clear()
        expect( fs.isEmpty() ).toBe( true )
    } )

    it( 'resets pickedFeatureId', () => {
        const fs    = new FeatureSet()
        const [ id ] = fs.add( 'layer1', [ makeFeature( 'pick' ) ] )
        fs.pick( id )
        fs.clear()
        expect( fs.pickedFeatureId ).toBeNull()
    } )

    it( 'fires clearedFeatures event', () => {
        const fs = new FeatureSet()
        const fn = vi.fn()
        ;( fs as any ).clearedFeatures( fn )
        fs.clear()
        expect( fn ).toHaveBeenCalledTimes( 1 )
    } )
} )

// ---------------------------------------------------------------------------
// isEmpty() / has() / get()
// ---------------------------------------------------------------------------

describe( 'FeatureSet — queries', () => {
    let fs: FeatureSet

    beforeEach( () => { fs = new FeatureSet() } )

    it( 'isEmpty returns true when no features', () => {
        expect( fs.isEmpty() ).toBe( true )
    } )

    it( 'isEmpty returns false after add', () => {
        fs.add( 'layer1', [ makeFeature( 'q' ) ] )
        expect( fs.isEmpty() ).toBe( false )
    } )

    it( 'has returns true for existing id', () => {
        const [ id ] = fs.add( 'layer1', [ makeFeature( 'h' ) ] )
        expect( fs.has( id ) ).toBe( true )
    } )

    it( 'has returns false for unknown id', () => {
        expect( fs.has( 'nope' ) ).toBe( false )
    } )

    it( 'get returns the feature', () => {
        const f      = makeFeature( 'g' )
        const [ id ] = fs.add( 'layer1', [ f ] )
        expect( fs.get( id ) ).toBe( f )
    } )

    it( 'get returns undefined for unknown id', () => {
        expect( fs.get( 'x' ) ).toBeUndefined()
    } )
} )

// ---------------------------------------------------------------------------
// pick()
// ---------------------------------------------------------------------------

describe( 'FeatureSet#pick', () => {
    let fs:  FeatureSet
    let id1: string

    beforeEach( () => {
        fs = new FeatureSet()
        ;[ id1 ] = fs.add( 'layer1', [ makeFeature( 'p1' ) ] )
    } )

    it( 'sets pickedFeatureId', () => {
        fs.pick( id1 )
        expect( fs.pickedFeatureId ).toBe( id1 )
    } )

    it( 'fires pickedFeature event', () => {
        const fn = vi.fn()
        ;( fs as any ).pickedFeature( fn )
        fs.pick( id1 )
        expect( fn ).toHaveBeenCalledTimes( 1 )
        expect( fn.mock.calls[ 0 ][ 0 ].feature ).toBe( fs.get( id1 ) )
    } )

    it( 'returns old id', () => {
        fs.pick( id1 )
        const [ id2 ] = fs.add( 'layer1', [ makeFeature( 'p2' ) ] )
        const old = fs.pick( id2 )
        expect( old ).toBe( id1 )
    } )

    it( 'picking null clears pick', () => {
        fs.pick( id1 )
        fs.pick( null )
        expect( fs.pickedFeatureId ).toBeNull()
    } )

    it( 'picking same id is no-op (no event)', () => {
        fs.pick( id1 )
        const fn = vi.fn()
        ;( fs as any ).pickedFeature( fn )
        fs.pick( id1 )
        expect( fn ).not.toHaveBeenCalled()
    } )

    it( 'isPicked returns true for picked id', () => {
        fs.pick( id1 )
        expect( fs.isPicked( id1 ) ).toBe( true )
    } )

    it( 'isPicked returns false for unpicked id', () => {
        expect( fs.isPicked( id1 ) ).toBe( false )
    } )

    it( 'getPicked returns the picked feature', () => {
        fs.pick( id1 )
        expect( fs.getPicked() ).toBe( fs.get( id1 ) )
    } )

    it( 'getPicked returns undefined when nothing picked', () => {
        expect( fs.getPicked() ).toBeUndefined()
    } )

    it( 'throws when picking unknown id', () => {
        expect( () => fs.pick( 'bad-id' ) ).toThrow()
    } )
} )

// ---------------------------------------------------------------------------
// highlight()
// ---------------------------------------------------------------------------

describe( 'FeatureSet#highlight', () => {
    let fs:  FeatureSet
    let id1: string
    let id2: string

    beforeEach( () => {
        fs = new FeatureSet()
        ;[ id1 ] = fs.add( 'layer1', [ makeFeature( 'h1' ) ] )
        ;[ id2 ] = fs.add( 'layer1', [ makeFeature( 'h2' ) ] )
    } )

    it( 'marks features as highlighted', () => {
        fs.highlight( [ id1 ] )
        expect( fs.isHighlighted( id1 ) ).toBe( true )
        expect( fs.isHighlighted( id2 ) ).toBe( false )
    } )

    it( 'replaces previous highlights', () => {
        fs.highlight( [ id1 ] )
        fs.highlight( [ id2 ] )
        expect( fs.isHighlighted( id1 ) ).toBe( false )
        expect( fs.isHighlighted( id2 ) ).toBe( true )
    } )

    it( 'fires highlightedFeatures event', () => {
        const fn = vi.fn()
        ;( fs as any ).highlightedFeatures( fn )
        fs.highlight( [ id1 ] )
        expect( fn ).toHaveBeenCalledTimes( 1 )
    } )

    it( 'calling with no args clears all highlights', () => {
        fs.highlight( [ id1 ] )
        fs.highlight()
        expect( fs.isHighlighted( id1 ) ).toBe( false )
    } )

    it( 'returns old highlighted ids', () => {
        fs.highlight( [ id1 ] )
        const old = fs.highlight( [ id2 ] )
        expect( old ).toContain( id1 )
    } )

    it( 'throws for unknown id', () => {
        expect( () => fs.highlight( [ 'bad' ] ) ).toThrow()
    } )
} )

// ---------------------------------------------------------------------------
// getStats()
// ---------------------------------------------------------------------------

describe( 'FeatureSet#getStats', () => {
    it( 'featureCount returns number of features', () => {
        const fs = new FeatureSet()
        fs.add( 'layer1', [ makeFeature( 's1' ), makeFeature( 's2' ) ] )
        expect( fs.getStats().featureCount ).toBe( 2 )
    } )

    it( 'layerCount counts distinct layers', () => {
        const fs = new FeatureSet()
        fs.add( 'layer1', [ makeFeature( 'a' ), makeFeature( 'b' ) ] )
        fs.add( 'layer2', [ makeFeature( 'c' ) ] )
        expect( fs.getStats().layerCount ).toBe( 2 )
    } )

    it( 'featureCount is 0 for empty set', () => {
        expect( new FeatureSet().getStats().featureCount ).toBe( 0 )
    } )
} )
