/**
 * viewer-maplibre — MapLibre GL JS-based viewer implementation.
 *
 * Provides a viewer that mirrors the public surface of other SMK viewers 
 * so the SMK tools and layers can drive the map through a consistent interface.
 * Includes a 2D / 3D mode toggle (pitch + terrain).
 *
 * Expects window.maplibregl (loaded via <script src="…/maplibre-gl-x.y.z.min.js">).
 * But we may want to change this to a project dependency and import it directly 
 * if that becomes more convenient.
 */

import { Viewer } from '../viewer'
import { SMK } from '../smk-ref'

declare const maplibregl: any
declare const turf:       any
declare const L:          any   // optional — used only to read esri-leaflet basemap URL templates

// ---------------------------------------------------------------------------
// ViewerMapLibre constructor
// ---------------------------------------------------------------------------

export class ViewerMapLibre extends Viewer {
    constructor() { super() }
}

// Register on SMK.TYPE.Viewer.maplibre
const smkRef = SMK
if ( smkRef ) {
    if ( !smkRef.TYPE )         smkRef.TYPE = {}
    if ( !smkRef.TYPE.Viewer )  smkRef.TYPE.Viewer = {}
    smkRef.TYPE.Viewer.maplibre = ViewerMapLibre
}

// Default empty style — basemap layers are added via setBasemap().
const EMPTY_STYLE: any = {
    version: 8,
    sources: {},
    layers:  [],
    glyphs:  'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
}

// Public DEM tileset used when 3D mode is enabled (no API key required).
// Overridable via the viewer config:
//   "viewer": { "type": "maplibre", "dem": { "url": "...", "encoding": "mapbox", "tileSize": 512, "maxzoom": 14, "exaggeration": 1.5 } }
// Note that MapLibre GL JS supports only a single DEM source, so this is a
// global default rather than a per-basemap option.
const DEFAULT_DEM_URL         = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'
const DEFAULT_DEM_ENCODING    = 'terrarium'
const DEFAULT_DEM_TILE_SIZE   = 256
const DEFAULT_DEM_MAX_ZOOM    = 15
const DEFAULT_DEM_EXAGGERATION = 1.2

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

ViewerMapLibre.prototype.initialize = function ( smk: any ) {
    const self = this

    Viewer.prototype.initialize.apply( this, arguments )

    this.deadViewerLayer  = {}
    this.basemapSourceIds = []      // tracks current basemap source ids
    this.basemapLayerIds  = []      // tracks current basemap layer ids
    this.viewerLayers     = {}      // id -> spec
    this.acetate          = {}
    this.mode             = '2d'    // '2d' | '3d'
    this.demSourceId      = null
    this.demConfig        = Object.assign( {
        url:          DEFAULT_DEM_URL,
        encoding:     DEFAULT_DEM_ENCODING,
        tileSize:     DEFAULT_DEM_TILE_SIZE,
        maxzoom:      DEFAULT_DEM_MAX_ZOOM,
        exaggeration: DEFAULT_DEM_EXAGGERATION,
    }, smk.viewer && smk.viewer.dem )

    const el = smk.addToContainer( '<div class="smk-viewer">' )

    // MapLibre needs a sized container.  smk-viewer sets width/height via CSS.
    self.map = new maplibregl.Map( {
        container:           el,
        style:               EMPTY_STYLE,
        attributionControl:  false,
        interactive:         true,
        dragRotate:          false,
        pitchWithRotate:     false,
        touchPitch:          false,
        // v5 supports a globe projection; keep mercator so behaviour matches
        // the leaflet viewer until/unless 3D mode is engaged.
        // may want to consider adding a toggle?
        projection:          'mercator',
        minZoom:             smk.viewer.minZoom || 0,
        maxZoom:             smk.viewer.maxZoom || 22,
        center:              [ 0, 0 ],
        zoom:                2,
    } )

    // Begin with everything off; tool initializers re-enable based on config.
    self.map.scrollZoom.disable()
    self.map.boxZoom.disable()
    self.map.doubleClickZoom.disable()
    self.map.dragPan.disable()
    self.map.keyboard.disable()

    return new Promise<void>( ( resolve ) => {
        self.map.once( 'load', function () {

            // Demote tile-decode/network errors so a single bad raster tile
            // (e.g. an Esri MapServer / WMS returning an HTML error page that
            // can't be decoded as an image) doesn't surface as an uncaught
            // "InvalidStateError: The source image could not be decoded".
            self.map.on( 'error', function ( e: any ) {
                const err  = e?.error
                const msg  = err?.message || String( err || '' )
                const url  = e?.sourceId || e?.source?.id || ''
                if (
                    /could not be decoded/i.test( msg ) ||
                    /Failed to fetch|NetworkError|AbortError/i.test( msg ) ||
                    err?.name === 'InvalidStateError'
                ) {
                    console.debug( 'maplibre tile error suppressed', url, msg )
                    return
                }
                console.warn( 'maplibre:', err || e )
            } )

            self.setView( smk.viewer.location )

            if ( smk.viewer.baseMap ) {
                self.setBasemap( smk.viewer.baseMap )
            }

            self.changedViewDebounced = SMK.UTIL.makeDelayedCall( function () {
                self.changedView()
            }, { delay: 500 } )

            self.map.on( 'movestart', self.changedViewDebounced )
            self.map.on( 'moveend',   self.changedViewDebounced )
            self.map.on( 'zoomstart', self.changedViewDebounced )
            self.map.on( 'zoomend',   self.changedViewDebounced )
            self.changedViewDebounced()

            self.finishedLoading( function () {
                Object.keys( self.deadViewerLayer ).forEach( function ( id: string ) {
                    removeViewerLayer( self, id )
                    delete self.deadViewerLayer[ id ]
                    delete self.visibleLayer[ id ]
                } )
            } )

            self.map.on( 'click', function ( ev: any ) {
                if ( self.clickTimeout ) clearTimeout( self.clickTimeout )
                self.clickTimeout = setTimeout( function () {
                    self.pickedLocation( {
                        map:    { latitude: ev.lngLat.lat, longitude: ev.lngLat.lng },
                        screen: { x: ev.point.x, y: ev.point.y },
                    } )
                }, 300 )
            } )

            self.map.on( 'dblclick', function () {
                if ( self.clickTimeout ) clearTimeout( self.clickTimeout )
            } )

            self.map.on( 'mousemove', function ( ev: any ) {
                self.changedLocation( {
                    map:    { latitude: ev.lngLat.lat, longitude: ev.lngLat.lng },
                    screen: { x: ev.point.x, y: ev.point.y },
                } )
            } )

            self.getVar = function () { return smk.getVar.apply( smk, arguments ) }

            // The 2D / 3D mode toggle is provided as an SMK actionbar tool;
            // see src/smk/viewer-maplibre/tool/mode/tool-mode-maplibre.ts.

            resolve()
        } )
    } )
}

ViewerMapLibre.prototype.destroy = function () {
    if ( this.map ) this.map.remove()
    Viewer.prototype.destroy.call( this )
}

// ---------------------------------------------------------------------------
// initializeBasemaps — register Leaflet factories (so the baseMaps tool can
// build its Leaflet thumbnail mini-maps), then build MapLibre specs ourselves
// in setBasemap() using the stored config.
// ---------------------------------------------------------------------------

ViewerMapLibre.prototype.initializeBasemaps = function (
    defineBaseMap:     ( id: string, config?: any ) => any,
    defineBaseMapType: ( type: string, fn?: Function ) => any,
    viewerCfg?:        any,
) {
    defineBaseMapType( 'tile', function ( cfg: any ) {
        return [ L.tileLayer( cfg.url, Object.assign( { attribution: cfg.attribution }, cfg.option ) ) ]
    } )

    defineBaseMapType( 'esri-basemap', function ( cfg: any ) {
        const opt  = Object.assign( { detectRetina: true }, cfg.option )
        const orig = JSON.parse( JSON.stringify( L.esri.BasemapLayer.TILES[ cfg.key ].options ) )
        const ly   = L.esri.basemapLayer( cfg.key, JSON.parse( JSON.stringify( opt ) ) )
        L.esri.BasemapLayer.TILES[ cfg.key ].options = orig
        return [ ly ]
    } )

    defineBaseMapType( 'esri-tiled-map', function ( cfg: any ) {
        return [ L.esri.tiledMapLayer( Object.assign( { url: cfg.url, maxZoom: 30 }, cfg.option ) ) ]
    } )

    defineBaseMapType( 'esri-vector-basemap', function ( cfg: any ) {
        if ( L.esri?.Vector?.vectorBasemapLayer )
            return [ L.esri.Vector.vectorBasemapLayer( cfg.key, Object.assign( { maxZoom: 30 }, cfg.option ) ) ]
        return []
    } )

    defineBaseMapType( 'esri-vector-tile', function ( cfg: any ) {
        if ( L.esri?.Vector?.vectorTileLayer )
            return [ L.esri.Vector.vectorTileLayer( cfg.url, Object.assign( { maxZoom: 30 }, cfg.option ) ) ]
        return []
    } )

    defineBaseMapType( 'esri-static-basemap-tile', function ( cfg: any ) {
        if ( L.esri?.Static?.staticBasemapTileLayer )
            return [ L.esri.Static.staticBasemapTileLayer( cfg.style, Object.assign( { maxZoom: 30 }, cfg.option ) ) ]
        return []
    } )

    Viewer.prototype.initializeBasemaps.call( this, defineBaseMap, defineBaseMapType, viewerCfg )
}

// ---------------------------------------------------------------------------
// MapLibre style spec builders used by setBasemap()
// ---------------------------------------------------------------------------

export function basemapSpecForConfig( cfg: any ): MapLibreBasemapSpec[] {
    return specForConfig( cfg )
}

function specForConfig( cfg: any ): MapLibreBasemapSpec[] {
    switch ( cfg.type ) {
        case 'tile':
            return [ rasterSpec( cfg.id, [ resolveTileUrl( cfg.url ) ], cfg ) ]

        case 'esri-basemap': {
            const url = lookupEsriBasemapUrl( cfg.key )
            if ( !url ) {
                console.warn( 'maplibre viewer: no URL for esri-basemap key "' + cfg.key + '"' )
                return []
            }
            return [ rasterSpec( cfg.id, [ url ], cfg ) ]
        }

        case 'esri-tiled-map': {
            if ( !cfg.url ) return []
            const tileUrl = cfg.url.replace( /\/$/, '' ) + '/tile/{z}/{y}/{x}'
            return [ rasterSpec( cfg.id, [ tileUrl ], cfg ) ]
        }

        case 'esri-vector-basemap':
        case 'esri-vector-tile':
        case 'esri-static-basemap-tile':
            console.warn( 'maplibre viewer: basemap type "' + cfg.type + '" (' + cfg.id + ') not yet supported' )
            return []

        default:
            console.warn( 'maplibre viewer: unknown basemap type "' + cfg.type + '"' )
            return []
    }
}

interface MapLibreBasemapSpec {
    sourceId: string
    source:   any
    layer:    any
}

function rasterSpec( id: string, tiles: string[], cfg: any ): MapLibreBasemapSpec {
    const opt = cfg.option || {}
    return {
        sourceId: 'smk-bm-' + id,
        source: {
            type:        'raster',
            tiles,
            tileSize:    opt.tileSize || 256,
            attribution: cfg.attribution || opt.attribution || '',
            maxzoom:     opt.maxNativeZoom || opt.maxZoom || 22,
        },
        layer: {
            id:     'smk-bm-' + id,
            type:   'raster',
            source: 'smk-bm-' + id,
        },
    }
}

function resolveTileUrl( url: string ): string {
    // Esri's `{s}.arcgisonline.com` subdomain rotation has been retired —
    // collapse to the canonical `server.arcgisonline.com` host.  Other `{s}`
    // patterns fall back to a single subdomain ("a").
    let out = url.replace( /\{s\}\.arcgisonline\.com/g, 'server.arcgisonline.com' )
    out     = out.replace( /\{s\}/g, 'a' )
    // Force https for Esri basemaps
    out     = out.replace( /^http:\/\//, 'https://' )
    return out
}

function lookupEsriBasemapUrl( key: string ): string | null {
    if ( typeof L === 'undefined' || !L.esri || !L.esri.BasemapLayer ) return null
    const def = L.esri.BasemapLayer.TILES?.[ key ]
    if ( !def?.urlTemplate ) return null
    return resolveTileUrl( def.urlTemplate )
}

// ---------------------------------------------------------------------------
// setBasemap / setView / getView / screenToMap / getScale
// ---------------------------------------------------------------------------

ViewerMapLibre.prototype.setBasemap = function ( basemapId: string ) {
    const self = this

    this.basemapLayerIds.forEach( ( lid: string ) => {
        if ( self.map.getLayer( lid ) ) self.map.removeLayer( lid )
    } )
    this.basemapSourceIds.forEach( ( sid: string ) => {
        if ( self.map.getSource( sid ) ) self.map.removeSource( sid )
    } )
    this.basemapLayerIds  = []
    this.basemapSourceIds = []

    // NOTE: do NOT use this.createBasemapLayer() here — that returns Leaflet
    // layers (registered for the baseMaps tool's thumbnail mini-maps).  We
    // build MapLibre style fragments from the stored config instead.
    const cfg   = this.getBasemapConfig( basemapId )
    const specs = specForConfig( cfg )

    if ( !specs || specs.length === 0 ) {
        console.warn( 'maplibre viewer: no basemap spec produced for "' + basemapId + '"' )
        this.changedBaseMap( { baseMap: basemapId } )
        return
    }

    // Insert basemap layers at the bottom (before the first existing layer).
    const firstId = self.map.getStyle()?.layers?.[ 0 ]?.id
    specs.forEach( ( spec: any ) => {
        if ( !self.map.getSource( spec.sourceId ) ) {
            self.map.addSource( spec.sourceId, spec.source )
        }
        self.map.addLayer( spec.layer, firstId )
        self.basemapSourceIds.push( spec.sourceId )
        self.basemapLayerIds.push( spec.layer.id )
    } )

    this.changedBaseMap( { baseMap: basemapId } )
}

ViewerMapLibre.prototype.setView = function ( opt: any ) {
    if ( !opt ) return

    if ( opt.extent ) {
        const bx = opt.extent
        this.map.fitBounds(
            [ [ bx[ 0 ], bx[ 1 ] ], [ bx[ 2 ], bx[ 3 ] ] ],
            { animate: false, padding: 0 },
        )
        return
    }

    if ( opt.center ) {
        this.map.jumpTo( {
            center: [ opt.center[ 0 ], opt.center[ 1 ] ],
            zoom:   opt.zoom != null ? opt.zoom : this.map.getZoom(),
        } )
    } else if ( opt.zoom != null ) {
        this.map.setZoom( opt.zoom )
    }
}

ViewerMapLibre.prototype.getView = function () {
    if ( !this.map ) return

    const c       = this.map.getCenter()
    const b       = this.map.getBounds()
    const canvas  = this.map.getCanvas()
    const width   = canvas.clientWidth  || canvas.width
    const height  = canvas.clientHeight || canvas.height
    const vert    = height / 2

    let metersPerPixel = 1
    try {
        const ll1 = this.map.unproject( [ 0,   vert ] )
        const ll2 = this.map.unproject( [ 100, vert ] )
        const tu  = ( window as any ).turf
        if ( tu ) {
            metersPerPixel = ( tu.distance(
                tu.point( [ ll1.lng, ll1.lat ] ),
                tu.point( [ ll2.lng, ll2.lat ] ),
                { units: 'meters' }
            ) ) / 100
        }
    } catch { /* ignore */ }

    return {
        center:         { latitude: c.lat, longitude: c.lng },
        zoom:           this.map.getZoom(),
        extent:         [ b.getWest(), b.getSouth(), b.getEast(), b.getNorth() ],
        scale:          ( metersPerPixel * 100 ) / ( this.screenpixelsToMeters || 1 ),
        metersPerPixel,
        screen:         { width, height },
    }
}

ViewerMapLibre.prototype.getScale = function () {
    return this.getView().scale
}

ViewerMapLibre.prototype.screenToMap = function ( screen: any ) {
    const ll = Array.isArray( screen )
        ? this.map.unproject( screen )
        : this.map.unproject( [ screen.x, screen.y ] )
    return [ ll.lng, ll.lat ]
}

// ---------------------------------------------------------------------------
// Layer management
// ---------------------------------------------------------------------------
//
// Layer factories that target the maplibre viewer should produce "spec"
// objects in one of these forms:
//   { sourceId, source, layer }           — single layer
//   { sourceId, source, layers: [ ... ] } — multiple layers on one source
//   { sourceId, source, layers: [...], sources: { id: src, ... } }
//                                         — extra additional sources
//
// addViewerLayer also accepts a bare maplibre layer object as a fallback.
// ---------------------------------------------------------------------------

function specLayers( spec: any ): any[] {
    if ( spec.layers ) return spec.layers
    if ( spec.layer  ) return [ spec.layer ]
    return []
}

function specSources( spec: any ): Array<[ string, any ]> {
    const out: Array<[ string, any ]> = []
    if ( spec.sourceId && spec.source ) out.push( [ spec.sourceId, spec.source ] )
    if ( spec.sources ) {
        Object.keys( spec.sources ).forEach( ( id: string ) => out.push( [ id, spec.sources[ id ] ] ) )
    }
    return out
}

ViewerMapLibre.prototype.addViewerLayer = function ( viewerLayer: any ) {
    if ( !viewerLayer ) return
    const self = this

    const layers  = specLayers( viewerLayer )
    const sources = specSources( viewerLayer )

    if ( layers.length > 0 || sources.length > 0 ) {
        sources.forEach( ( [ sid, src ] ) => {
            if ( !self.map.getSource( sid ) ) self.map.addSource( sid, src )
        } )
        layers.forEach( ( ly: any ) => {
            if ( !self.map.getLayer( ly.id ) ) self.map.addLayer( ly )
        } )
        if ( typeof viewerLayer._smk_onAdd === 'function' ) {
            viewerLayer._smk_cleanup = viewerLayer._smk_onAdd( self.map )
        }
        self.viewerLayers[ viewerLayer._smk_id || layers[ 0 ]?.id || viewerLayer.sourceId ] = viewerLayer
        return
    }

    if ( viewerLayer.id && viewerLayer.type && !self.map.getLayer( viewerLayer.id ) ) {
        self.map.addLayer( viewerLayer )
        self.viewerLayers[ viewerLayer._smk_id || viewerLayer.id ] = viewerLayer
    }
}

ViewerMapLibre.prototype.positionViewerLayer = function ( viewerLayer: any, _zOrder: number ) {
    if ( !viewerLayer ) return
    const layers = specLayers( viewerLayer )
    if ( layers.length > 0 ) {
        // MapLibre uses insertion order for z; move each to top in order.
        layers.forEach( ( ly: any ) => {
            if ( self_hasLayer( this, ly.id ) ) this.map.moveLayer( ly.id )
        } )
        return
    }
    if ( viewerLayer.id && self_hasLayer( this, viewerLayer.id ) ) this.map.moveLayer( viewerLayer.id )
}

function self_hasLayer( self: any, id: string ): boolean {
    return !!( id && self.map.getLayer( id ) )
}

function removeViewerLayer( self: any, id: string ) {
    const vl = self.viewerLayers[ id ]
    if ( !vl ) return

    if ( typeof vl._smk_cleanup === 'function' ) {
        try { vl._smk_cleanup() } catch ( err ) { console.warn( err ) }
        vl._smk_cleanup = null
    }

    specLayers( vl ).forEach( ( ly: any ) => {
        if ( ly.id && self.map.getLayer( ly.id ) ) self.map.removeLayer( ly.id )
    } )
    specSources( vl ).forEach( ( [ sid ]: any ) => {
        if ( sid && self.map.getSource( sid ) ) self.map.removeSource( sid )
    } )

    if ( vl.id && self.map.getLayer( vl.id ) ) self.map.removeLayer( vl.id )

    delete self.viewerLayers[ id ]
}

// ---------------------------------------------------------------------------
// Panel / display context
// ---------------------------------------------------------------------------

ViewerMapLibre.prototype.getPanelPadding = function () {
    const sbp    = this.getSidepanelPosition()
    const canvas = this.map.getCanvas()
    const width  = canvas.clientWidth  || canvas.width
    const height = canvas.clientHeight || canvas.height

    const aboveH = sbp.top
    const belowH = height - sbp.top - sbp.height
    const leftW  = sbp.left
    const rightW = width - sbp.left - sbp.width

    if ( Math.max( aboveH, belowH ) > Math.max( leftW, rightW ) ) {
        return aboveH > belowH
            ? { topLeft: { x: 0, y: 0 },                       bottomRight: { x: 0, y: height - sbp.top } }
            : { topLeft: { x: 0, y: sbp.top + sbp.height },    bottomRight: { x: 0, y: 0 } }
    } else {
        return leftW > rightW
            ? { topLeft: { x: 0, y: 0 },                       bottomRight: { x: width - sbp.left, y: 0 } }
            : { topLeft: { x: sbp.left + sbp.width, y: 0 },    bottomRight: { x: 0, y: 0 } }
    }
}

// ---------------------------------------------------------------------------
// Acetate / temporary features
// ---------------------------------------------------------------------------

ViewerMapLibre.prototype.temporaryFeature = function ( acetate: string, geometry: any, opt: any ) {
    const sourceId = 'smk-acetate-' + acetate
    const layerId  = sourceId

    if ( !this.acetate[ acetate ] ) this.acetate[ acetate ] = { sourceId, layerId }

    if ( !this.map.getSource( sourceId ) ) {
        this.map.addSource( sourceId, { type: 'geojson', data: emptyFC() } )
    }

    if ( !this.map.getLayer( layerId ) ) {
        const geomType = geometry?.type || 'Feature'
        const isPoint  = /Point/.test( geomType ) || /Point/.test( geometry?.geometry?.type || '' )
        const isLine   = /LineString/.test( geomType ) || /LineString/.test( geometry?.geometry?.type || '' )

        const layerSpec: any = isPoint
            ? { id: layerId, type: 'circle', source: sourceId,
                paint: Object.assign( { 'circle-radius': 6, 'circle-color': '#3388ff', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }, opt?.paint ) }
            : isLine
            ? { id: layerId, type: 'line', source: sourceId,
                paint: Object.assign( { 'line-color': '#3388ff', 'line-width': 3 }, opt?.paint ) }
            : { id: layerId, type: 'fill', source: sourceId,
                paint: Object.assign( { 'fill-color': '#3388ff', 'fill-opacity': 0.3, 'fill-outline-color': '#3388ff' }, opt?.paint ) }

        this.map.addLayer( layerSpec )
    }

    const data = geometry
        ? ( geometry.type === 'FeatureCollection' ? geometry
          : geometry.type === 'Feature'           ? { type: 'FeatureCollection', features: [ geometry ] }
          :                                         { type: 'FeatureCollection', features: [ { type: 'Feature', geometry, properties: {} } ] } )
        : emptyFC()

    this.map.getSource( sourceId )?.setData( data )
}

function emptyFC() { return { type: 'FeatureCollection', features: [] } }

ViewerMapLibre.prototype.panToFeature = function ( feature: any, zoomIn: any ) {
    let bbox: number[]
    if ( !feature ) return
    try {
        if ( turf.getType( feature ) === 'Point' ) {
            const c = feature.geometry.coordinates
            bbox = [ c[ 0 ], c[ 1 ], c[ 0 ], c[ 1 ] ]
        } else {
            bbox = turf.bbox( feature )
        }
    } catch { return }

    const padding = this.getPanelPadding()

    let maxZoom: number | undefined
    if ( !zoomIn )              maxZoom = this.map.getZoom()
    else if ( zoomIn !== true ) maxZoom = parseFloat( zoomIn )

    this.map.fitBounds(
        [ [ bbox[ 0 ], bbox[ 1 ] ], [ bbox[ 2 ], bbox[ 3 ] ] ],
        {
            padding: {
                top:    padding.topLeft.y,
                left:   padding.topLeft.x,
                bottom: padding.bottomRight.y,
                right:  padding.bottomRight.x,
            },
            maxZoom,
            animate: true,
        },
    )
}

// ---------------------------------------------------------------------------
// 2D / 3D mode toggle
// ---------------------------------------------------------------------------

ViewerMapLibre.prototype.getMode = function (): '2d' | '3d' {
    return this.mode
}

ViewerMapLibre.prototype.setMode = function ( mode: '2d' | '3d' ) {
    if ( mode === this.mode ) return

    if ( mode === '3d' ) {
        const dem = this.demConfig || {
            url:          DEFAULT_DEM_URL,
            encoding:     DEFAULT_DEM_ENCODING,
            tileSize:     DEFAULT_DEM_TILE_SIZE,
            maxzoom:      DEFAULT_DEM_MAX_ZOOM,
            exaggeration: DEFAULT_DEM_EXAGGERATION,
        }

        if ( !this.demSourceId ) {
            this.demSourceId = 'smk-dem'
            if ( !this.map.getSource( this.demSourceId ) ) {
                this.map.addSource( this.demSourceId, {
                    type:     'raster-dem',
                    tiles:    [ dem.url ],
                    tileSize: dem.tileSize,
                    encoding: dem.encoding,
                    maxzoom:  dem.maxzoom,
                } )
            }
        }
        try {
            this.map.setTerrain( { source: this.demSourceId, exaggeration: dem.exaggeration } )
        } catch ( e ) {
            console.warn( 'maplibre viewer: terrain not supported by this version', e )
        }
        this.map.dragRotate.enable()
        this.map.touchPitch?.enable()
        this.map.easeTo( { pitch: 60, duration: 500 } )
        this.mode = '3d'
    } else {
        try { this.map.setTerrain( null ) } catch { /* ignore */ }
        this.map.easeTo( { pitch: 0, bearing: 0, duration: 500 } )
        this.map.dragRotate.disable()
        this.map.touchPitch?.disable()
        this.mode = '2d'
    }

    if ( typeof this.changedMode === 'function' ) this.changedMode( { mode: this.mode } )
}

ViewerMapLibre.prototype.toggleMode = function () {
    this.setMode( this.mode === '3d' ? '2d' : '3d' )
}

export default ViewerMapLibre
