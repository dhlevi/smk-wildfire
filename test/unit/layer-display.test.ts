/**
 * Unit tests for src/smk/layer-display.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    LayerDisplay,
    LayerDisplayContext,
    type LayerDisplayOption,
    type LayerCatalog,
} from '../../src/smk/layer-display'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCatalog( ids: string[], extra: Record<string, any> = {} ): LayerCatalog {
    const cat: LayerCatalog = {}
    ids.forEach( id => {
        cat[ id ] = {
            config: { id, title: `Title of ${ id }`, isVisible: true, ...( extra[ id ] || {} ) },
            getLegends: () => Promise.resolve( [] ),
        }
    } )
    return cat
}

function layerOption( id: string, overrides: Partial<LayerDisplayOption> = {} ): LayerDisplayOption {
    return Object.assign( { id, type: 'layer' }, overrides )
}

// ---------------------------------------------------------------------------
// LayerDisplay base
// ---------------------------------------------------------------------------

describe( 'LayerDisplay base', () => {
    it( 'constructs with defaults', () => {
        const ld = new LayerDisplay( { id: 'x', type: 'layer', title: 'X' } )
        expect( ld.id ).toBe( 'x' )
        expect( ld.isVisible ).toBe( true )
        expect( ld.isEnabled ).toBe( true )
        expect( ld.inFilter ).toBe( true )
        expect( ld.showItem ).toBe( true )
    } )

    it( 'forceVisible overrides isVisible=false', () => {
        const ld = new LayerDisplay( { id: 'y', type: 'layer', isVisible: false }, true )
        expect( ld.isVisible ).toBe( true )
    } )

    it( 'getConfig returns relevant fields', () => {
        const ld  = new LayerDisplay( { id: 'cfg', type: 'layer', title: 'Cfg', class: 'c1' } )
        const cfg = ld.getConfig()
        expect( cfg.id ).toBe( 'cfg' )
        expect( cfg.title ).toBe( 'Cfg' )
        expect( cfg.class ).toBe( 'c1' )
    } )

    it( 'getVisible returns isVisible', () => {
        const ld = new LayerDisplay( { id: 'v', isVisible: false } )
        expect( ld.getVisible() ).toBe( false )
    } )
} )

// ---------------------------------------------------------------------------
// LayerDisplay.layer
// ---------------------------------------------------------------------------

describe( 'LayerDisplay.layer', () => {
    it( 'constructs from catalog', () => {
        const cat = makeCatalog( [ 'lyr1' ] )
        const ld  = new LayerDisplay.layer( layerOption( 'lyr1' ), cat )
        expect( ld.id ).toBe( 'lyr1' )
    } )

    it( 'lazy-reads title from catalog', () => {
        const cat = makeCatalog( [ 'lyr2' ] )
        cat[ 'lyr2' ].config.title = 'Lazy Title'
        const ld  = new LayerDisplay.layer( layerOption( 'lyr2' ), cat )
        expect( ld.title ).toBe( 'Lazy Title' )
    } )

    it( 'uses option title when provided', () => {
        const cat = makeCatalog( [ 'lyr3' ] )
        const ld  = new LayerDisplay.layer( layerOption( 'lyr3', { title: 'Override' } ), cat )
        expect( ld.title ).toBe( 'Override' )
    } )

    it( 'disables itself for unknown layer id', () => {
        const ld = new LayerDisplay.layer( layerOption( 'unknown-id' ), {} )
        const _  = ld.title   // trigger lazy getter
        expect( ld.isEnabled ).toBe( false )
        expect( ld.isVisible ).toBe( false )
    } )

    it( 'each calls callback with empty parents', () => {
        const cat = makeCatalog( [ 'lyr4' ] )
        const ld  = new LayerDisplay.layer( layerOption( 'lyr4' ), cat )
        const fn  = vi.fn()
        ld.each( fn )
        expect( fn ).toHaveBeenCalledTimes( 1 )
        expect( fn.mock.calls[ 0 ][ 0 ] ).toBe( ld )
    } )

    it( 'each does nothing when disabled', () => {
        const cat = makeCatalog( [ 'lyr5' ] )
        const ld  = new LayerDisplay.layer( layerOption( 'lyr5' ), cat )
        ld.isEnabled = false
        const fn  = vi.fn()
        ld.each( fn )
        expect( fn ).not.toHaveBeenCalled()
    } )

    it( 'getVisible respects scale limits', () => {
        const cat = makeCatalog( [ 'lyr6' ], { lyr6: { minScale: 100000, maxScale: 1000 } } )
        const ld  = new LayerDisplay.layer( layerOption( 'lyr6' ), cat )
        expect( ld.getVisible( 50000 ) ).toBe( true )   // within range
        expect( ld.getVisible( 200000 ) ).toBe( false )  // too zoomed out
        expect( ld.getVisible( 500 ) ).toBe( false )     // too zoomed in
    } )
} )

// ---------------------------------------------------------------------------
// LayerDisplay.folder
// ---------------------------------------------------------------------------

describe( 'LayerDisplay.folder', () => {
    it( 'constructs from items', () => {
        const cat = makeCatalog( [ 'a', 'b' ] )
        const fd  = new LayerDisplay.folder( {
            id: 'fold', type: 'folder', items: [
                layerOption( 'a' ),
                layerOption( 'b' ),
            ]
        }, cat )
        expect( fd.items ).toHaveLength( 2 )
    } )

    it( 'each visits folder then children', () => {
        const cat   = makeCatalog( [ 'c', 'd' ] )
        const fd    = new LayerDisplay.folder( {
            id: 'fold2', type: 'folder', items: [ layerOption( 'c' ), layerOption( 'd' ) ]
        }, cat )
        const visited: string[] = []
        fd.each( item => { visited.push( item.id ) } )
        expect( visited[ 0 ] ).toBe( 'fold2' )
        expect( visited ).toContain( 'c' )
        expect( visited ).toContain( 'd' )
    } )

    it( 'each stops children when callback returns false', () => {
        const cat   = makeCatalog( [ 'e', 'f' ] )
        const fd    = new LayerDisplay.folder( {
            id: 'fold3', type: 'folder', items: [ layerOption( 'e' ), layerOption( 'f' ) ]
        }, cat )
        const visited: string[] = []
        fd.each( item => { visited.push( item.id ); return false } )
        expect( visited ).toEqual( [ 'fold3' ] )
    } )

    it( 'getConfig includes nested items', () => {
        const cat = makeCatalog( [ 'g' ] )
        const fd  = new LayerDisplay.folder( {
            id: 'fold4', type: 'folder', items: [ layerOption( 'g' ) ]
        }, cat )
        const cfg = fd.getConfig()
        expect( Array.isArray( cfg.items ) ).toBe( true )
        expect( ( cfg.items as LayerDisplayOption[] ).find( i => i.id === 'g' ) ).toBeTruthy()
    } )

    it( 'generates an id when option.id is missing', () => {
        const cat = makeCatalog( [] )
        const fd  = new LayerDisplay.folder( { type: 'folder', title: 'Auto', items: [] }, cat )
        expect( typeof fd.id ).toBe( 'string' )
        expect( fd.id.length ).toBeGreaterThan( 0 )
    } )
} )

// ---------------------------------------------------------------------------
// LayerDisplay.group
// ---------------------------------------------------------------------------

describe( 'LayerDisplay.group', () => {
    it( 'forces all children visible', () => {
        const cat = makeCatalog( [ 'h' ], { h: { isVisible: false } } )
        const grp = new LayerDisplay.group( {
            id: 'grp1', type: 'group', items: [ layerOption( 'h', { isVisible: false } ) ]
        }, cat )
        expect( grp.items[ 0 ].isVisible ).toBe( true )
    } )

    it( 'is always expanded', () => {
        const cat = makeCatalog( [] )
        const grp = new LayerDisplay.group( { id: 'grp2', type: 'group', items: [] }, cat )
        expect( grp.isExpanded ).toBe( true )
    } )
} )

// ---------------------------------------------------------------------------
// LayerDisplayContext
// ---------------------------------------------------------------------------

describe( 'LayerDisplayContext — construction', () => {
    it( 'collects layer ids', () => {
        const cat = makeCatalog( [ 'L1', 'L2' ] )
        const ctx = new LayerDisplayContext( [
            layerOption( 'L1' ),
            layerOption( 'L2' ),
        ], cat )
        expect( ctx.layerIds ).toContain( 'L1' )
        expect( ctx.layerIds ).toContain( 'L2' )
    } )

    it( 'root is a folder', () => {
        const cat = makeCatalog( [] )
        const ctx = new LayerDisplayContext( [], cat )
        expect( ctx.root ).toBeInstanceOf( LayerDisplay.folder )
    } )

    it( 'fires changedVisibility event', () => {
        const cat = makeCatalog( [ 'L3' ] )
        const fn  = vi.fn()
        const ctx = new LayerDisplayContext( [ layerOption( 'L3' ) ], cat )
        ;( ctx as any ).changedVisibility( fn )
        ;( ctx as any ).changedVisibility()
        expect( fn ).toHaveBeenCalled()
    } )

    it( 'sets isActuallyVisible on items after construction', () => {
        const cat = makeCatalog( [ 'L4' ] )
        const ctx = new LayerDisplayContext( [ layerOption( 'L4' ) ], cat )
        const item = ctx.getItem( 'L4' )
        expect( item?.isActuallyVisible ).toBe( true )
    } )
} )

describe( 'LayerDisplayContext — item queries', () => {
    let ctx: LayerDisplayContext

    beforeEach( () => {
        const cat = makeCatalog( [ 'q1', 'q2' ] )
        ctx = new LayerDisplayContext( [
            layerOption( 'q1' ),
            layerOption( 'q2' ),
        ], cat )
    } )

    it( 'getItem returns the LayerDisplay for a known id', () => {
        expect( ctx.getItem( 'q1' ) ).toBeDefined()
        expect( ctx.getItem( 'q1' )!.id ).toBe( 'q1' )
    } )

    it( 'getItem returns undefined for unknown id', () => {
        expect( ctx.getItem( 'nope' ) ).toBeUndefined()
    } )

    it( 'getLayerIds returns all layer ids', () => {
        expect( ctx.getLayerIds() ).toEqual( [ 'q1', 'q2' ] )
    } )

    it( 'getLayerIndex returns sequential indices', () => {
        expect( ctx.getLayerIndex( 'q1' ) ).toBe( 0 )
        expect( ctx.getLayerIndex( 'q2' ) ).toBe( 1 )
    } )

    it( 'isItemVisible returns true for visible items', () => {
        expect( ctx.isItemVisible( 'q1' ) ).toBe( true )
    } )

    it( 'isItemVisible returns false for unknown id', () => {
        expect( ctx.isItemVisible( 'none' ) ).toBe( false )
    } )
} )

describe( 'LayerDisplayContext — mutation', () => {
    let ctx: LayerDisplayContext

    beforeEach( () => {
        const cat = makeCatalog( [ 'm1', 'm2' ] )
        ctx = new LayerDisplayContext( [
            layerOption( 'm1' ),
            layerOption( 'm2' ),
        ], cat )
    } )

    it( 'setItemVisible hides an item', () => {
        ctx.setItemVisible( 'm1', false )
        expect( ctx.isItemVisible( 'm1' ) ).toBe( false )
    } )

    it( 'setItemVisible fires changedVisibility', () => {
        const fn = vi.fn()
        ;( ctx as any ).changedVisibility( fn )
        ctx.setItemVisible( 'm1', false )
        expect( fn ).toHaveBeenCalled()
    } )

    it( 'setItemEnabled disables a layer', () => {
        ctx.setItemEnabled( 'm1', false )
        expect( ctx.getItem( 'm1' )!.isEnabled ).toBe( false )
    } )

    it( 'setView triggers changedVisibility', () => {
        const fn = vi.fn()
        ;( ctx as any ).changedVisibility( fn )
        ctx.setView( { scale: 50000 } )
        expect( fn ).toHaveBeenCalled()
    } )

    it( 'setFilter marks non-matching items as inFilter=false', () => {
        ctx.setFilter( /^NOMATCH$/ )
        expect( ctx.getItem( 'm1' )!.inFilter ).toBe( false )
    } )

    it( 'setFilter marks matching items as inFilter=true', () => {
        ctx.setFilter( /m1/ )
        expect( ctx.getItem( 'm1' )!.inFilter ).toBe( true )
        expect( ctx.getItem( 'm2' )!.inFilter ).toBe( false )
    } )
} )

describe( 'LayerDisplayContext — getConfig', () => {
    it( 'returns config for root items', () => {
        const cat = makeCatalog( [ 'cfg1' ] )
        const ctx = new LayerDisplayContext( [ layerOption( 'cfg1' ) ], cat )
        const cfg = ctx.getConfig()
        expect( Array.isArray( cfg ) ).toBe( true )
        expect( cfg[ 0 ].id ).toBe( 'cfg1' )
    } )
} )

describe( 'LayerDisplayContext — duplicate handling', () => {
    it( 'warns and disables duplicate layer ids', () => {
        const warnSpy = vi.spyOn( console, 'warn' ).mockImplementation( () => {} )
        const cat     = makeCatalog( [ 'dup' ] )
        const ctx     = new LayerDisplayContext( [
            layerOption( 'dup' ),
            layerOption( 'dup' ),
        ], cat )
        expect( warnSpy ).toHaveBeenCalled()
        warnSpy.mockRestore()
        // Only one should be in layerIds
        expect( ctx.layerIds.filter( id => id === 'dup' ) ).toHaveLength( 1 )
    } )
} )
