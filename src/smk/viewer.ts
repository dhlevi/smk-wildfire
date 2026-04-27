/**
 * SMK Base Viewer class
 * Converted from viewer.js to TypeScript ES module.
 *
 * Depends (converted): event.ts, util.ts, layer/layer.ts
 * Depends (not yet converted — accessed as SMK.TYPE.* globals):
 *   feature-set, query, layer-display, base-maps, turf
 *   TODO: convert each and replace the global references below.
 *
 * jQuery usages removed:
 *   - $.extend(Viewer.prototype, …)  - Object.setPrototypeOf
 *   - $(window).resize(…)            - window.addEventListener('resize', …)
 *   - $('#heightRef').height()       - el.getBoundingClientRect()
 *
 * Backward compat: SMK.TYPE.Viewer is assigned at the bottom so unconverted
 * modules that reference SMK.TYPE.Viewer still work.
 */

import { SMKEvent }      from './event'
import {
    resolved,
    makePromise,
    waitAll,
    makeDelayedCall,
    circlePoints,
    getMetersPerUnit,
    findNearestSite,
    makeMutex,
} from './util'
import type { Layer }    from './layer/layer'

// ---------------------------------------------------------------------------
// ViewerEvent — typed event subclass for all viewer instances
// ---------------------------------------------------------------------------

const ViewerEvent = SMKEvent.define( [
    'changedView',
    'changedBaseMap',
    'startedLoading',
    'finishedLoading',
    'pickedLocation',
    'changedLocation',
    'changedPopup',
    'changedLayerVisibility',
    'changedDevice',
] )

// ---------------------------------------------------------------------------
// Viewer — base class extended by viewer-leaflet and viewer-esri3d
// ---------------------------------------------------------------------------

export class Viewer {
    // Loading state (accessor — fires startedLoading / finishedLoading events)
    loading: boolean   // defined via Object.defineProperty

    // Set by initialize()
    lmfId!:      string
    type!:       string
    serviceUrl?: string
    resolveUrl!: ( url: string ) => string
    clusterOption?: any

    // Feature sets — types not yet migrated, stored as any
    identified!: any
    selected!:   any
    searched!:   any
    queried:     Record<string, any> = {}

    // Layer tracking
    layerIds:         string[]            = []
    layerId:          Record<string, any> = {}
    visibleLayer:     Record<string, any> = {}
    offMapLayer:      Record<string, any> = {}
    layerIdPromise:   Record<string, any> = {}
    deadViewerLayer:  Record<string, any> = {}

    // Base map registries
    basemap:     Record<string, any> = {}
    basemapType: Record<string, any> = {}

    // Display context
    displayContext: Record<string, any> = { layers: null }
    displayContextInitialized!: Promise<void>
    initializeDisplayContext!: () => void
    defaultLayerDisplay?: any[]

    // Pick handlers indexed by priority
    pickHandlers: ( (( fn: any ) => any)[] )[] = []

    // Query registry
    query: Record<string, any> = {}

    // Refresh state
    refreshLayersTimer?:   ReturnType<typeof setTimeout>
    refreshLayersPromise?: Promise<void>
    refreshLayersResolve?: () => void
    refreshLayersReject?:  ( e: Error ) => void

    // Loading promise pair
    layersLoading!: Promise<void>

    // Identify mutex
    acquireIdentifyMutex!: () => ReturnType<ReturnType<typeof makeMutex>>

    // Pixel density helper (initialised once per class)
    screenpixelsToMeters!: number

    // Location caching
    currentLocationPromise?:   Promise<any>
    currentLocationTimestamp?: number

    getSidepanelPosition!: () => any

    constructor() {
        const self = this

        // Initialise the event dispatcher from ViewerEvent mixin
        ViewerEvent.prototype.constructor.call( this )

        let loading = false
        Object.defineProperty( this, 'loading', {
            get() { return loading },
            set( v: any ) {
                if ( !!v === loading ) return
                loading = !!v
                if ( v )
                    ( self as any ).startedLoading()
                else
                    ( self as any ).finishedLoading()
            },
        } )
    }

    // -------------------------------------------------------------------------
    // Zoom scale lookup table (populated on Viewer.prototype after class body)
    // -------------------------------------------------------------------------

    zoomScale!: number[]

    // -------------------------------------------------------------------------
    // Base class methods
    // -------------------------------------------------------------------------

    destroy(): void {
        ViewerEvent.prototype.destroy.call( this )
    }

    initialize( smk: any ): void {
        const self = this

        this.lmfId      = smk.lmfId
        this.type       = smk.viewer.type
        this.serviceUrl = smk.$option[ 'service-url' ]
        this.resolveUrl = ( url: string ) => smk.resolveAssetUrl( url )
        this.clusterOption = smk.viewer.clusterOption

        const FeatureSet = ( window as any ).SMK?.TYPE?.FeatureSet  // set by feature-set.ts
        this.identified = FeatureSet ? new FeatureSet() : {}
        this.selected   = FeatureSet ? new FeatureSet() : {}
        this.searched   = FeatureSet ? new FeatureSet() : {}

        function defineBaseMap( id: string, def?: any ) {
            const lowerId = id.toLowerCase()
            if ( !def ) return self.basemap[ lowerId ]
            const config  = smk.viewer.baseMapConfig?.find( ( b: any ) => b.id.toLowerCase() === lowerId )
            const option  = Object.assign( {}, def.option, config?.option )
            self.basemap[ lowerId ] = Object.assign( { id: lowerId }, def, config, { option } )
        }

        function defineBaseMapType( id: string, fn?: any ) {
            const lowerId = id.toLowerCase()
            if ( !fn ) return self.basemapType[ lowerId ]
            self.basemapType[ lowerId ] = fn
        }

        this.initializeBasemaps( defineBaseMap, defineBaseMapType )

        this.displayContextInitialized = makePromise<void>( ( res, rej ) => {
            self.initializeDisplayContext = () => {
                try {
                    smk.viewer.displayContext?.forEach( ( dc: any ) => {
                        if ( smk.hasToolType( dc.id ) ) {
                            self.setDisplayContextItems( dc.id, dc.items )
                        }
                    } )
                    if ( !self.isDisplayContext( 'layers' ) ) {
                        self.setDisplayContextItems( 'layers', self.defaultLayerDisplay )
                    }
                    res()
                } catch ( e: any ) {
                    rej( e )
                }
            }
        } )

        this.pickHandlers = []
        this.query        = {}

        this.screenpixelsToMeters = this.pixelsToMillimeters( 100 ) / 1000

        if ( Array.isArray( smk.layers ) ) {
            const items = smk.layers.map( ( layerConfig: any ) => {
                const ld = self.addLayer( layerConfig )

                // TODO: replace SMK.TYPE.Query.* with an import once query.ts is converted
                const QueryTypes = ( window as any ).SMK?.TYPE?.Query  // set by query/query.ts
                if ( layerConfig.queries && QueryTypes ) {
                    layerConfig.queries.forEach( ( q: any ) => {
                        const query = new QueryTypes[ layerConfig.type ]( ld.id, q )
                        self.query[ query.id ] = query
                        self.queried[ query.id ] = FeatureSet ? new FeatureSet() : {}
                    } )
                }

                return ld
            } )

            this.defaultLayerDisplay = items
        }

        // Chained pick handler logic
        ;( this as any ).pickedLocation( ( ev: any ) => {
            let chain = resolved()
            return self.pickHandlers.reduceRight( ( ch, hs ) => {
                if ( !hs || hs.length === 0 ) return ch
                return ch.then( ( handled: any ) => {
                    if ( handled ) return true
                    return Promise.all( hs.map( h =>
                        resolved().then( () => h.call( self, ev ) )
                    ) ).then( handleds => handleds.some( h => h ) )
                } )
            }, chain ).catch( ( e: any ) => { console.warn( e ) } )
        } )

        // Resize - changedDevice
        window.addEventListener( 'resize', makeDelayedCall( () => {
            const dev = smk.detectDevice?.()
            if ( dev ) ( self as any ).changedDevice( dev )
        }, { delay: 500 } ) )

        // place query tool integration
        if ( smk.$tool?.[ 'query-place' ] && FeatureSet ) {
            self.queried.place = new FeatureSet()
            const QueryTypes = ( window as any ).SMK?.TYPE?.Query
            if ( QueryTypes ) {
                self.query.place = new QueryTypes.place( 'place' )
            }
            self.layerIds.push( 'place' )
            self.layerId[ 'place' ] = {
                id:     'place',
                config: { title: '', popupTemplate: '@feature-place' },
            }
        }

        this.getSidepanelPosition = () => smk.getSidepanelPosition()

        ;( this as any ).changedLayerVisibility( () => { self.refreshLayers() } )

        this.layersLoading = resolved<void>()
        let whenFinishedLoading: [ () => void, ( e: Error ) => void ] | null = null

        ;( this as any ).startedLoading( () => {
            if ( whenFinishedLoading ) {
                whenFinishedLoading[ 1 ]( new Error( 'startedLoading called before finishedLoading' ) )
                whenFinishedLoading = null
            }
            self.layersLoading = makePromise<void>( ( res, rej ) => {
                whenFinishedLoading = [ res, rej ]
            } )
        } )

        ;( this as any ).finishedLoading( () => {
            if ( whenFinishedLoading ) {
                whenFinishedLoading[ 0 ]()
                whenFinishedLoading = null
            }
        } )

        this.acquireIdentifyMutex = makeMutex( 'identify' )
    }

    waitFinishedLoading(): Promise<void> {
        return this.layersLoading
    }

    // -------------------------------------------------------------------------
    // Zoom scale
    // -------------------------------------------------------------------------

    getZoomBracketForScale( scale: number ): [ number, number ] | undefined {
        if ( scale > this.zoomScale[ 1 ] )  return [ 0, 1 ]
        if ( scale < this.zoomScale[ 19 ] ) return [ 19, 20 ]
        for ( let z = 2; z < 20; z += 1 )
            if ( scale > this.zoomScale[ z ] ) return [ z - 1, z ]
    }

    // -------------------------------------------------------------------------
    // Base map support
    // -------------------------------------------------------------------------

    initializeBasemaps( defineBaseMap: Function, defineBaseMapType: Function ): void {
        // TODO: replace inc['base-maps'] with a direct import once base-maps.ts is converted
        const baseMapsSetup = ( window as any ).SMK?._baseMaps
        if ( baseMapsSetup ) baseMapsSetup( defineBaseMap, defineBaseMapType )

        if ( window.SMK?.HANDLER?.has( 'viewer', 'defineBaseMap' ) )
            window.SMK.HANDLER.get( 'viewer', 'defineBaseMap' )!( defineBaseMap )

        if ( window.SMK?.HANDLER?.has( 'viewer', 'defineBaseMapType' ) )
            window.SMK.HANDLER.get( 'viewer', 'defineBaseMapType' )!( defineBaseMapType )
    }

    getBasemapIds(): string[] {
        return Object.keys( this.basemap )
    }

    getBasemapConfig( basemapId: string ): any {
        const lowerId = basemapId.toLowerCase()
        const config  = this.basemap[ lowerId ]
        if ( !config ) throw new Error( 'no base map defined for ' + lowerId )
        return config
    }

    createBasemapLayer( basemapId: string ): any {
        const config = this.getBasemapConfig( basemapId )
        const create = this.basemapType[ config.type ]
        if ( !create ) throw new Error( `base map ${ config.id } has unknown type ${ config.type }` )

        try {
            if ( config.deprecated )
                console.warn( `base map ${ config.id } is deprecated` )
            return create( config )
        } catch ( e ) {
            throw new Error( `creating base map ${ config.id } failed: ${ e }` )
        }
    }

    // -------------------------------------------------------------------------
    // Layer refresh / visibility
    // -------------------------------------------------------------------------

    refreshLayers( delay?: number ): Promise<void> {
        const self = this

        if ( this.refreshLayersTimer ) {
            clearTimeout( this.refreshLayersTimer )
            this.refreshLayersTimer = undefined
        } else if ( this.refreshLayersPromise ) {
            return this.refreshLayersPromise
        }

        if ( !this.refreshLayersPromise ) {
            this.refreshLayersPromise = makePromise<void>( ( res, rej ) => {
                self.refreshLayersResolve = res
                self.refreshLayersReject  = rej
            } )
        }

        this.refreshLayersTimer = setTimeout( () => {
            self.refreshLayersTimer = undefined
            self.updateLayersVisible()
                .then( () => {
                    if ( !self.loading ) return self.refreshLayersResolve!()
                    return self.waitFinishedLoading()
                } )
                .then( () => self.refreshLayersResolve!() )
                .catch( ( e: Error ) => self.refreshLayersReject!( e ) )
                .finally( () => {
                    self.refreshLayersPromise  = undefined
                    self.refreshLayersResolve  = undefined
                    self.refreshLayersReject   = undefined
                } )
        }, delay || 200 )

        return this.refreshLayersPromise
    }

    addLayer( layerConfig: any ): { id: string } {
        const self = this
        const ly   = makeLayer( layerConfig )
        registerLayer( ly )
        return { id: ly.id }

        function makeLayer( config: any ): any {
            try {
                const LayerType = window.SMK?.TYPE?.Layer
                if ( !LayerType || !LayerType[ config.type ] )
                    throw new Error( `layer type "${ config.type }" not defined` )
                if ( !LayerType[ config.type ][ self.type ] )
                    throw new Error( `layer type "${ config.type }" not defined for viewer "${ self.type }"` )
                return new LayerType[ config.type ][ self.type ]( config )
            } catch ( e: any ) {
                e.message += `, when creating layer id "${ config.id }"`
                throw e
            }
        }

        function registerLayer( ly: any ) {
            self.layerIds.push( ly.id )
            self.layerId[ ly.id ] = ly
            ly.startedLoading( () => { self.loading = true } )
            ly.finishedLoading( () => { self.loading = self.anyLayersLoading() } )
        }
    }

    getLayerConfig(): any[] {
        return this.layerIds.map( id => this.layerId[ id ].getConfig( this.visibleLayer[ id ] ) )
    }

    eachLayer( callback: ( id: string, layer: any, visible: any ) => void ): void {
        this.layerIds.forEach( id => {
            try { callback( id, this.layerId[ id ], this.visibleLayer[ id ] ) }
            catch ( e ) { console.warn( e ) }
        } )
    }

    initializeLayers( _smk?: any ): void {
    }

    // -------------------------------------------------------------------------
    // Display context
    // -------------------------------------------------------------------------

    isDisplayContext( context: string ): boolean {
        return !!this.displayContext[ context ]
    }

    setDisplayContextItems( context: string, items?: any[] ): void {
        const self = this
        if ( this.isDisplayContext( context ) ) {
            console.warn( `displayContext ${ context } is already defined` )
            return
        }

        const LayerDisplayContext = ( window as any ).SMK?.TYPE?.LayerDisplayContext  // set by layer-display.ts
        const dc = this.displayContext[ context ] = LayerDisplayContext
            ? new LayerDisplayContext( items || [], this.layerId )
            : { changedVisibility: () => {}, setView: () => {}, root: null }

        dc.changedVisibility( () => { ( self as any ).changedLayerVisibility() } )
        ;( this as any ).changedView( () => { dc.setView( self.getView() ) } )
    }

    eachDisplayContext( cb: ( dc: any, context: string ) => void ): void {
        Object.keys( this.displayContext ).forEach( k => cb.call( this, this.displayContext[ k ], k ) )
    }

    getDisplayContexts(): any[] {
        const dcs: any[] = []
        const vw = this.getView()
        this.eachDisplayContext( ( dc ) => {
            dc.setView( vw )
            dcs.push( dc.root )
        } )
        return dcs
    }

    getDisplayContextConfig(): any[] {
        const config: any[] = []
        this.eachDisplayContext( ( dc, c ) => config.push( { id: c, items: dc.getConfig() } ) )
        return config
    }

    isDisplayContextItemVisible( layerId: string ): boolean | null {
        let vis: boolean | null = null
        this.eachDisplayContext( dc => { vis = vis || dc.isItemVisible( layerId ) } )
        return vis
    }

    getDisplayContextItem( layerId: string ): any {
        let item: any = null
        this.eachDisplayContext( dc => { item = item || dc.getItem( layerId ) } )
        return item
    }

    getDisplayContextLayerIds(): string[] {
        let ids: string[] = []
        this.eachDisplayContext( dc => { ids = ids.concat( dc.getLayerIds() ) } )
        return ids
    }

    setDisplayContextItemEnabled( layerId: string, enabled: boolean ): void {
        this.eachDisplayContext( dc => dc.setItemEnabled( layerId, enabled ) )
    }

    setDisplayContextLegendsVisible( vis: boolean ): void {
        this.eachDisplayContext( dc => dc.setLegendsVisible( vis, this.layerId, this ) )
    }

    setDisplayContextFolderExpanded( layerId: string, expanded: boolean ): void {
        this.eachDisplayContext( dc => dc.setFolderExpanded( layerId, expanded ) )
    }

    // -------------------------------------------------------------------------
    // Pick handling
    // -------------------------------------------------------------------------

    handlePick( priority: number, handler: Function ): void {
        if ( !this.pickHandlers[ priority ] ) this.pickHandlers[ priority ] = []
        this.pickHandlers[ priority ].push( handler as any )
    }

    // -------------------------------------------------------------------------
    // Layer visibility update
    // -------------------------------------------------------------------------

    updateLayersVisible(): Promise<any[]> {
        const self = this

        const pending: Record<string, boolean> = {}
        this.getDisplayContextLayerIds().forEach( id => { pending[ id ] = true } )
        Object.keys( this.visibleLayer ).forEach( id => { pending[ id ] = true } )

        const visibleLayers: any[][] = []
        let merged: any[] | undefined

        this.getDisplayContextLayerIds().forEach( id => {
            if ( !self.isDisplayContextItemVisible( id ) ) return

            const ly = self.layerId[ id ]
            if ( !ly ) {
                if ( ly !== false ) console.warn( `layer "${ id }" not defined` )
                self.layerId[ id ] = false
                return
            }
            if ( ( ly as Layer ).config?.isDisplayed === false ) return

            if ( !merged ) { merged = [ ly ]; return }

            if ( merged[ 0 ].canMergeWith( ly ) ) {
                merged.push( ly )
                return
            }

            visibleLayers.push( merged )
            merged = [ ly ]
        } )
        if ( merged ) visibleLayers.push( merged )

        const promises: Promise<any>[] = []
        const maxZOrder = visibleLayers.length - 1

        visibleLayers.forEach( ( lys, i ) => {
            const cid = lys.map( ly => ly.id ).join( '##' )
            delete pending[ cid ]

            if ( self.visibleLayer[ cid ] ) {
                self.positionViewerLayer( self.visibleLayer[ cid ], maxZOrder - i )
                return
            }

            const p = self.createViewerLayer( cid, lys, maxZOrder - i )
                .then( ly => {
                    if ( lys.length > 1 || lys[ 0 ].canAddToMap() ) {
                        self.addViewerLayer( ly )
                        self.positionViewerLayer( ly, maxZOrder - i )
                        self.visibleLayer[ cid ] = ly
                    } else {
                        self.offMapLayer[ cid ] = ly
                    }
                    return ly
                } )
                .catch( ( e: any ) => {
                    console.warn( `Failed to create layer ${ cid }:`, e )
                    lys.forEach( ( ly: any ) => self.setDisplayContextItemEnabled( ly.id, false ) )
                } )

            promises.push( p )
        } )

        Object.assign( this.deadViewerLayer, pending )

        if ( promises.length === 0 ) {
            if ( this.loading ) this.loading = false
            else ( this as any ).finishedLoading()
        }

        return waitAll( promises )
    }

    // Overridden by concrete viewer (leaflet / esri3d)
    addViewerLayer( _viewerLayer: any ): void {}
    positionViewerLayer( _viewerLayer: any, _zOrder: number ): void {}

    createViewerLayer( id: string, layers: any[], zIndex: number ): Promise<any> {
        const self = this

        if ( layers.length === 0 ) return Promise.reject( new Error( 'no layers' ) )

        const type = layers[ 0 ].config.type
        if ( !layers.every( l => l.config.type === type ) )
            return Promise.reject( new Error( "types don't match" ) )

        if ( this.layerIdPromise[ id ] ) return this.layerIdPromise[ id ]

        const LayerType = window.SMK?.TYPE?.Layer
        if ( !LayerType?.[ type ]?.[ self.type ]?.create )
            return Promise.reject( new Error( `can't create viewer layer of type "${ type }"` ) )

        return ( this.layerIdPromise[ id ] = resolved()
            .then( () => LayerType[ type ][ self.type ].create.call( self, layers, zIndex ) )
            .then( ( ly: any ) => this.afterCreateViewerLayer( id, type, layers, ly ) )
        )
    }

    afterCreateViewerLayer( id: string, type: string, _layers: any[], viewerLayer: any ): any {
        viewerLayer._smk_type = type
        viewerLayer._smk_id   = id
        return viewerLayer
    }

    // -------------------------------------------------------------------------
    // View / geometry — overridden by concrete viewers
    // -------------------------------------------------------------------------

    getView( _location?: any ): any {
        throw new Error( 'not implemented' )
    }

    circleInMap( screenCenter: { x: number; y: number }, pixelRadius: number, sides: number ): any {
        // TODO: replace turf global with import once turf is bundled explicitly
        const turf = ( window as any ).turf
        if ( !turf ) throw new Error( 'turf is not loaded' )

        return turf.polygon( [
            circlePoints( screenCenter, pixelRadius, sides )
                .map( ( p: any ) => this.screenToMap( p ) )
        ] )
    }

    screenToMap( _screenPt: any ): any {
        throw new Error( 'not implemented' )
    }

    // -------------------------------------------------------------------------
    // Identify
    // -------------------------------------------------------------------------

    identifyFeatures( location: any, area: any ): Promise<any> {
        const self  = this
        const view  = this.getView()


        this.identified.clear?.()

        const lock = this.acquireIdentifyMutex()

        if ( !location || !area ) return resolved()

        function IdentifyDiscardedError(): Error {
            const e: any = new Error( 'Identify results discarded' )
            e.discarded = true
            return e
        }

        const promises: Promise<any>[] = []

        this.layerIds.forEach( id => {
            const ly = self.layerId[ id ]
            if ( !self.isDisplayContextItemVisible( id ) ) return
            if ( ly.config.isQueryable === false ) return
            if ( !ly.inScaleRange( view ) ) return

            const option = {
                layer: self.visibleLayer[ id ] || self.offMapLayer[ id ]
            }
            const p = ly.getFeaturesInArea?.( area, view, option )
            if ( !p ) return

            promises.push(
                resolved()
                    .then( () => {
                        if ( !lock.held() ) throw IdentifyDiscardedError()
                        return p
                    } )
                    .then( ( features: any[] ) => {
                        if ( !lock.held() ) throw IdentifyDiscardedError()
                        features.forEach( ( f, i ) => {
                            if ( ly.config.titleAttribute ) {
                                const m = ly.config.titleAttribute.match( /^(.+?)(:[/](.+)[/])?$/ )
                                if ( m ) {
                                    f.title = m[ 2 ]
                                        ? ( () => { try { return f.properties[ m[ 1 ] ].match( new RegExp( m[ 3 ] ) )[ 1 ] } catch { return undefined } } )()
                                        : f.properties[ m[ 1 ] ]
                                }
                            }
                            if ( !f.title ) f.title = `Feature #${ i + 1 }`
                        } )
                        return features
                    } )
                    .then( ( features: any[] ) => {
                        if ( !lock.held() ) throw IdentifyDiscardedError()
                        features.forEach( f => { f._identifyPoint = location.map } )
                        self.identified.add?.( id, features )
                    } )
                    .catch( ( err: any ) => {
                        console.debug( id, 'identify fail:', err.message )
                        if ( err.discarded ) throw err
                    } )
            )
        } )

        return waitAll( promises )
            .finally( () => {
                if ( !lock.held() ) throw IdentifyDiscardedError()
            } )
    }

    anyLayersLoading(): boolean {
        return this.layerIds.some( id => this.layerId[ id ].loading )
    }

    // -------------------------------------------------------------------------
    // Attachment URL resolution
    // -------------------------------------------------------------------------

    resolveAttachmentUrl( url: string | null | undefined, id?: string, type?: string, required?: boolean ): string | undefined {
        if ( url?.startsWith( '@' ) ) { id = url.substr( 1 ); url = null }
        if ( url ) return url
        if ( !id ) {
            if ( required !== false ) throw new Error( 'attachment without URL or Id' )
            return
        }
        if ( !this.serviceUrl )
            return this.resolveUrl( 'attachments/' + id + ( type ? '.' + type : '' ) )
        return `${ this.serviceUrl }/MapConfigurations/${ this.lmfId }/Attachments/${ id }`
    }

    // -------------------------------------------------------------------------
    // Pixel density helper (created once; uses a temporary DOM element)
    // -------------------------------------------------------------------------

    pixelsToMillimeters( pixels: number ): number {
        const el = document.createElement( 'div' )
        el.style.cssText = 'height:1mm; display:none'
        document.body.appendChild( el )
        const pixPerMm = el.getBoundingClientRect().height || 1
        document.body.removeChild( el )
        return pixels / pixPerMm
    }

    // -------------------------------------------------------------------------
    // Distance conversion helpers
    // -------------------------------------------------------------------------

    distanceToMeters( distance: number, distanceUnit: string, location?: any ): number {
        if ( distanceUnit === 'px' ) return distance * this.getView( location ).metersPerPixel
        return distance * getMetersPerUnit( distanceUnit )
    }

    distanceFromMeters( distanceMeters: number, distanceUnit: string, location?: any ): number {
        if ( distanceUnit === 'px' ) return distanceMeters / this.getView( location ).metersPerPixel
        return distanceMeters / getMetersPerUnit( distanceUnit )
    }

    // -------------------------------------------------------------------------
    // Geolocation
    // -------------------------------------------------------------------------

    getCurrentLocation( option?: {
        timeout?:   number
        maxAge?:    number
        cacheKey?:  string
    } ): Promise<any> {
        const self = this

        const opts = Object.assign( {
            timeout:  10 * 1000,
            maxAge:   10 * 60 * 1000,
            cacheKey: 'smk-location',
        }, option )

        if (
            this.currentLocationPromise &&
            ( !this.currentLocationTimestamp ||
              this.currentLocationTimestamp > Date.now() - opts.maxAge )
        ) return this.currentLocationPromise

        this.currentLocationTimestamp = undefined
        return ( this.currentLocationPromise = makePromise<GeolocationPosition>( ( res, rej ) => {
            navigator.geolocation.getCurrentPosition( res, rej, {
                timeout:            opts.timeout,
                enableHighAccuracy: true,
            } )
            setTimeout( () => rej( new Error( 'timeout' ) ), opts.timeout )
        } )
        .then( pos => {
            self.currentLocationTimestamp = Date.now()
            window.localStorage.setItem(
                opts.cacheKey,
                JSON.stringify( { latitude: pos.coords.latitude, longitude: pos.coords.longitude } )
            )
            return pos.coords
        } )
        .catch( ( err: any ) => {
            try {
                const coords = JSON.parse( window.localStorage.getItem( opts.cacheKey ) || '' )
                if ( coords?.latitude ) {
                    console.warn( 'using cached location', coords )
                    return coords
                }
            } catch {}
            self.currentLocationPromise = undefined
            return Promise.reject( err )
        } )
        .then( ( loc: any ) =>
            findNearestSite( loc ).then( site => Object.assign( site, { current: true } ) )
        ) )
    }
}

// Wire up the prototype chain so Viewer instances inherit the event methods
Object.setPrototypeOf( Viewer.prototype, ViewerEvent.prototype )
Viewer.prototype.constructor = Viewer as any

// Populate zoom scale table (post class body — same values as original).
// Class field `zoomScale: number[] = []` is an own-property per instance, so
// we need to set the prototype array directly and the instance initialiser is
// removed (see class body — the field declaration is left for typing only).
Viewer.prototype.zoomScale = []
;( () => {
    const scales = [
        undefined,                  // index 0 unused
        173451547.7127784,          // 1
        89690013.7670628,           // 2
        45203253.08071528,          // 3
        22617698.02495323,          // 4
        11314385.218894083,         // 5
        5659653.605577067,          // 6
        2829913.245708334,          // 7
        1414856.836779603,          // 8
        707429.7690058348,          // 9
        353715.05331990693,         // 10
        176857.5477505768,          // 11
        88428.77649887519,          // 12
        44214.496444883276,         // 13
        22107.221783884223,         // 14
        11053.61708610345,          // 15
        5526.806585855153,          // 16
        2763.4019883053297,         // 17
        1381.6944712225031,         // 18
        690.8367988270104,          // 19
    ]
    scales.forEach( ( s, i ) => { if ( s !== undefined ) Viewer.prototype.zoomScale[ i ] = s } )
} )()

// ---------------------------------------------------------------------------
// Backward compat: assign to window.SMK.TYPE.Viewer
// ---------------------------------------------------------------------------

if ( typeof window !== 'undefined' && window.SMK ) {
    window.SMK.TYPE.Viewer = Viewer as any
}

export default Viewer
