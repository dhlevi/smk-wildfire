/**
 * SMK LayerDisplay & LayerDisplayContext
 * Converted from layer-display.js to TypeScript ES module.
 *
 * Depends (converted): event.ts, util.ts
 *
 * Structure:
 *   LayerDisplay       — base display item (class + namespace merge)
 *   LayerDisplay.layer — leaf layer item
 *   LayerDisplay.folder — collapsible folder of items
 *   LayerDisplay.group  — always-visible group of items
 *   createLayerDisplay  — factory (private)
 *   LayerDisplayContext — root context that owns a tree of LayerDisplay items
 *
 * Backward compat: SMK.TYPE.LayerDisplay and SMK.TYPE.LayerDisplayContext
 * are assigned at the bottom.
 */

import { SMKEvent }           from './event'
import { makeId, resolved }   from './util'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayerDisplayOption {
    id?:              string
    type?:            string
    title?:           string
    isVisible?:       boolean
    isEnabled?:       boolean
    isInternal?:      boolean
    isExpanded?:      boolean
    inFilter?:        boolean
    showLegend?:      boolean | 'waiting'
    showItem?:        boolean
    legends?:         any[] | false | null
    alwaysShowLegend?: boolean
    class?:           string | null
    metadataUrl?:     string | null
    items?:           LayerDisplayOption[]
    '#id'?:           any
    '#type'?:         any
    [key: string]:    unknown
}

// ---------------------------------------------------------------------------
// LayerDisplay — base class
// ---------------------------------------------------------------------------

export class LayerDisplay {
    id:                string
    type:              string | null
    title:             string
    isVisible:         boolean
    isActuallyVisible: boolean | null
    isEnabled:         boolean
    isInternal:        boolean
    inFilter:          boolean
    showLegend:        boolean | 'waiting'
    showItem:          boolean
    legends:           any[] | false | null
    alwaysShowLegend:  boolean
    class:             string | null
    metadataUrl:       string | null
    index?:            number

    constructor( option: LayerDisplayOption, forceVisible?: boolean ) {
        Object.assign( this, {
            id:                makeId( option.type, option.title ),
            type:              null,
            title:             option.id ?? '',
            isVisible:         true,
            isActuallyVisible: null,
            isEnabled:         true,
            isInternal:        false,
            inFilter:          true,
            showLegend:        false,
            showItem:          true,
            legends:           null,
            alwaysShowLegend:  false,
            class:             null,
            metadataUrl:       null,
        }, option )

        if ( forceVisible )
            this.isVisible = true
    }

    getVisible( _viewScale?: number ): boolean {
        return this.isVisible
    }

    getConfig(): LayerDisplayOption {
        return {
            id:        this.id,
            type:      this.type ?? undefined,
            title:     this.title,
            isVisible: this.isVisible,
            isEnabled: this.isEnabled,
            class:     this.class ?? undefined,
        }
    }

    each( _callback?: ( item: LayerDisplay, parents: LayerDisplay[] ) => boolean | void,
          _parents?:  LayerDisplay[] ): void {}

    getLegends( _layerCatalog: LayerCatalog, _viewer?: any, _ctx?: any ): Promise<any[]> {
        return resolved( [] )
    }
}

// ---------------------------------------------------------------------------
// LayerDisplay.layer
// ---------------------------------------------------------------------------

export namespace LayerDisplay {
    export class layer extends LayerDisplay {
        constructor(
            option:       LayerDisplayOption,
            layerCatalog: LayerCatalog,
            forceVisible?: boolean,
        ) {
            if ( option[ '#id' ] ) { super( option ); return }
            if ( !option.id ) throw new Error( 'display layer needs id' )

            // We need some properties to be lazy (read from layerCatalog on
            // first access). Call base ctor first, then overwrite with
            // Object.defineProperty for the lazy ones.
            super( option, forceVisible )

            const self = this

            function defLayerProperty( prop: string, def?: unknown ) {
                let propVal: unknown
                let gotProp = false
                Object.defineProperty( self, prop, {
                    get() {
                        if ( gotProp ) return propVal

                        if ( !layerCatalog[ option.id! ] ) {
                            console.warn( `layer id "${ option.id }" isn't defined` )
                            self.isEnabled = false
                            self.isVisible = false
                            gotProp = true
                            return def
                        }

                        gotProp = true
                        propVal = ( layerCatalog[ option.id! ] as any ).config[ prop ]
                        if ( propVal == null ) propVal = def
                        return propVal
                    },
                    set( val: unknown ) {
                        gotProp  = true
                        propVal  = val
                    },
                    configurable: true,
                    enumerable:   true,
                } )
            }

            if ( !option.title )           defLayerProperty( 'title', option.id )
            if ( !( 'isVisible' in option ) ) defLayerProperty( 'isVisible', true )
            if ( forceVisible )            this.isVisible = true

            defLayerProperty( 'minScale' )
            defLayerProperty( 'maxScale' )

            if ( !( 'class' in option ) )  defLayerProperty( 'class' )
            defLayerProperty( 'legends' )
            defLayerProperty( 'metadataUrl' )
        }

        each(
            callback?: ( item: LayerDisplay, parents: LayerDisplay[] ) => boolean | void,
            parents?:  LayerDisplay[],
        ): void {
            if ( !this.isEnabled ) return
            if ( callback ) callback( this, parents || [] )
        }

        getLegends(
            layerCatalog: LayerCatalog,
            viewer:       any,
            displayContext: LayerDisplayContext,
        ): Promise<any[]> {
            const self = this
            if ( !this.isEnabled ) return resolved( [] )

            return ( layerCatalog[ this.id ] as any ).getLegends( viewer )
                .then( ( lgs: any[] ) =>
                    lgs.map( lg => {
                        lg.isVisible = () => displayContext.isItemVisible( self.id )
                        return lg
                    } )
                )
        }

        getVisible( viewScale?: number ): boolean {
            if ( !viewScale || !this.isVisible ) return this.isVisible
            if ( !this.isEnabled ) return false

            const minScale = ( this as any ).minScale as number | undefined
            const maxScale = ( this as any ).maxScale as number | undefined

            if ( minScale && minScale < viewScale ) return false
            if ( maxScale && maxScale > viewScale ) return false
            return true
        }
    }

    // -------------------------------------------------------------------------
    // LayerDisplay.folder
    // -------------------------------------------------------------------------

    export class folder extends LayerDisplay {
        items:      LayerDisplay[]
        isExpanded: boolean

        constructor(
            option:       LayerDisplayOption,
            layerCatalog: LayerCatalog,
            forceVisible?: boolean,
        ) {
            if ( option[ '#id' ] ) { super( option ); this.items = []; this.isExpanded = false; return }

            if ( !option.id )
                option.id = makeId( option.type, option.title )

            super( Object.assign( { isExpanded: false }, option ), forceVisible )

            this.isExpanded = ( option.isExpanded ?? false ) as boolean
            this.items = ( option.items || [] ).map(
                item => createLayerDisplay( item, layerCatalog, forceVisible )
            )
        }

        each(
            callback?: ( item: LayerDisplay, parents: LayerDisplay[] ) => boolean | void,
            parents?:  LayerDisplay[],
        ): void {
            const p = parents || []
            let doChildren: boolean | void
            if ( callback ) doChildren = callback( this, p )

            const next = [ this as LayerDisplay ].concat( p )
            if ( doChildren !== false )
                this.items.forEach( item => item.each( callback, next ) )
        }

        getLegends( _layerCatalog: LayerCatalog, _viewer?: any ): Promise<any[]> {
            return resolved( [] )
        }

        getConfig(): LayerDisplayOption {
            const cfg = super.getConfig()
            cfg.items = this.items.map( ld => ld.getConfig() )
            return cfg
        }
    }

    // -------------------------------------------------------------------------
    // LayerDisplay.group — always-visible folder
    // -------------------------------------------------------------------------

    export class group extends folder {
        constructor(
            option:       LayerDisplayOption,
            layerCatalog: LayerCatalog,
            _forceVisible?: boolean,
        ) {
            // groups force all children visible
            super( Object.assign( option, { isExpanded: true } ), layerCatalog, true )
        }
    }
}

// ---------------------------------------------------------------------------
// Factory (private)
// ---------------------------------------------------------------------------

export type LayerCatalog = Record<string, any>

function createLayerDisplay(
    option:       LayerDisplayOption,
    layerCatalog: LayerCatalog,
    forceVisible?: boolean,
): LayerDisplay {
    if ( option[ '#type' ] ) return null as any   // caller should filter

    if ( !option.type ) option.type = 'layer'

    const SubType = ( LayerDisplay as any )[ option.type ]
    if ( SubType )
        return new SubType( option, layerCatalog, forceVisible )
    else
        throw new Error( `invalid layer display type "${ option.type }"` )
}

// ---------------------------------------------------------------------------
// LayerDisplayContextEvent
// ---------------------------------------------------------------------------

const LayerDisplayContextEvent = SMKEvent.define( [ 'changedVisibility' ] )

// ---------------------------------------------------------------------------
// LayerDisplayContext
// ---------------------------------------------------------------------------

export interface View {
    scale?: number
    [key: string]: unknown
}

export class LayerDisplayContext {
    root:    LayerDisplay.folder
    itemId:  Record<string, LayerDisplay[]>
    layerIds: string[]
    view?:   View

    constructor( items: LayerDisplayOption[], layerCatalog: LayerCatalog ) {
        const self = this

        // Initialise event dispatcher from mixin
        LayerDisplayContextEvent.prototype.constructor.call( this )

        this.itemId   = {}
        this.layerIds = []

        this.root = new LayerDisplay.folder( {
            id:         'root',
            type:       'folder',
            isExpanded: true,
            isVisible:  true,
            items,
        }, layerCatalog ) as LayerDisplay.folder

        let counter = 1000
        const nextId = () => { counter += 1; return counter }

        this.root.each( ( item, parents ) => {
            if ( item.id in self.itemId ) {
                if ( item.type === 'layer' ) {
                    console.warn( `Layer "${ item.id }" is duplicated in layer display` )
                    item.isEnabled = false
                } else {
                    console.warn( `${ item.type } "${ item.id }" is duplicated in layer display` )
                    const originalId = item.id
                    do {
                        item.id = makeId( originalId, String( nextId() ) )
                    } while ( item.id in self.itemId )
                }
            }

            self.itemId[ item.id ] = [ item ].concat( parents )

            if ( item.type === 'layer' && item.isEnabled ) {
                item.index = self.layerIds.length
                self.layerIds.push( item.id )
            }
        } )

        ;( this as any ).changedVisibility( () => {
            self.root.each( item => {
                item.isActuallyVisible = self.isItemVisible( item.id )
            } )
        } )

        ;( this as any ).changedVisibility()
    }

    // -------------------------------------------------------------------------

    getItem( id: string ): LayerDisplay | undefined {
        if ( !( id in this.itemId ) ) return
        return this.itemId[ id ][ 0 ]
    }

    getLayerIds(): string[] {
        return this.layerIds
    }

    getLayerIndex( id: string ): number | undefined {
        if ( !( id in this.itemId ) ) return
        const item = this.itemId[ id ][ 0 ]
        if ( item.type === 'layer' ) return item.index
    }

    setItemEnabled( id: string, enabled: boolean ): void {
        if ( !( id in this.itemId ) ) return
        const item = this.itemId[ id ][ 0 ]
        if ( item.type === 'layer' ) item.isEnabled = enabled
    }

    setFolderExpanded( id: string, expanded: boolean ): void {
        if ( !( id in this.itemId ) ) return
        const item = this.itemId[ id ][ 0 ] as LayerDisplay.folder
        if ( item.type === 'folder' ) item.isExpanded = expanded
    }

    isItemVisible( id: string ): boolean {
        const scale = this.view?.scale
        if ( !( id in this.itemId ) ) return false
        return this.itemId[ id ].reduce(
            ( accum, ld ) => accum && ld.getVisible( scale ),
            true
        )
    }

    setItemVisible( id: string, visible: boolean, deep?: boolean ): boolean | undefined {
        if ( !( id in this.itemId ) ) return

        const lds = this.itemId[ id ]

        if ( lds[ 0 ].type === 'layer' && !lds[ 0 ].isEnabled ) return false

        if ( visible )
            lds.forEach( ld => { ld.isVisible = true } )
        else
            lds[ 0 ].isVisible = false

        if ( deep ) {
            lds[ 0 ].each( item => {
                item.isVisible = visible
                if ( item.type === 'group' ) return false
            } )
        }

        ;( this as any ).changedVisibility()
        return visible
    }

    setLegendsVisible( visible: boolean, layerCatalog: LayerCatalog, viewer: any ): void {
        const self = this

        this.root.each( item => {
            if ( visible ) {
                if ( item.legends === false ) return
                if ( item.showLegend === 'waiting' ) return
                if ( item.legends ) { item.showLegend = true; return }

                item.showLegend = 'waiting'
                item.getLegends( layerCatalog, viewer, self )
                    .then( ls => {
                        item.legends = ls
                        if ( item.showLegend === 'waiting' ) item.showLegend = true
                    }, () => {
                        item.legends = false
                        item.showLegend = false
                    } )
            } else {
                item.showLegend = false
            }
        } )
    }

    setFilter( regex: RegExp ): void {
        const self = this

        this.root.each( item => {
            item.inFilter = false
            if ( regex.test( item.title ) )
                self.itemId[ item.id ]?.forEach( i => { i.inFilter = true } )
            if ( item.type === 'group' ) return false
        } )
    }

    setView( view: View ): void {
        this.view = view
        ;( this as any ).changedVisibility()
    }

    getConfig(): LayerDisplayOption[] {
        return this.root.items.map( ld => ld.getConfig() )
    }
}

// Wire up prototype chain for LayerDisplayContext
Object.setPrototypeOf( LayerDisplayContext.prototype, LayerDisplayContextEvent.prototype )
LayerDisplayContext.prototype.constructor = LayerDisplayContext as any

// ---------------------------------------------------------------------------
// Backward compat
// ---------------------------------------------------------------------------

if ( typeof window !== 'undefined' && window.SMK ) {
    window.SMK.TYPE.LayerDisplay        = LayerDisplay as any
    window.SMK.TYPE.LayerDisplayContext = LayerDisplayContext as any
}

export default LayerDisplayContext
