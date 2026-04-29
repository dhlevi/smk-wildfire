/**
 * viewer-esri3d — ArcGIS JS API 4.x / SceneView-based map viewer.
 * Converted from viewer-esri3d/viewer-esri3d.js.
 */

import { Viewer } from '../viewer'
import { Esri3dReady } from './types-esri3d'
import { SMK } from '../smk-ref'

declare const turf: any
declare const L: any

const smkRef = SMK

// ---------------------------------------------------------------------------

export class ViewerEsri3d extends Viewer {
    constructor() { super() }
}

Object.assign( ViewerEsri3d.prototype, Viewer.prototype )

if ( !smkRef.TYPE.Viewer ) smkRef.TYPE.Viewer = {}
smkRef.TYPE.Viewer[ 'esri3d' ] = ViewerEsri3d

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

ViewerEsri3d.prototype.initialize = function ( smk: any ) {
    const self = this

    Viewer.prototype.initialize.apply( this, arguments )

    return Esri3dReady.then( function ( E: any ) {

    const el = smk.addToContainer( '<div class="smk-viewer">' )

    self.map = new E.Map( {
        basemap: ( self.basemap[ smk.viewer.baseMap ] || {} ).esri3d || 'topo',
        ground:  'world-elevation',
    } )

    self.view = new E.views.SceneView( {
        container: el,
        map:       self.map,
        ui: new E.views.ui[ '3d' ].DefaultUI3D( {
            components: [ 'attribution' ],
            padding:    { top: 5, left: 5, right: 5, bottom: 5 },
        } ),
    } )

    self.setView( smk.viewer.location )

    // Disable panning
    self.panHandler = {
        drag:    self.view.on( 'drag',     ( evt: any ) => evt.stopPropagation() ),
        keyDown: self.view.on( 'key-down', ( evt: any ) => { if ( /Arrow/.test( evt.key ) ) evt.stopPropagation() } ),
    }

    // Disable zooming
    self.zoomHandler = {
        keyDown:      self.view.on( 'key-down',    ( evt: any ) => { if ( /^([+-_=]|Shift)$/.test( evt.key ) ) evt.stopPropagation() } ),
        mouseWheel:   self.view.on( 'mouse-wheel', ( evt: any ) => evt.stopPropagation() ),
        doubleClick1: self.view.on( 'double-click',              ( evt: any ) => evt.stopPropagation() ),
        doubleClick2: self.view.on( 'double-click', [ 'Control' ], ( evt: any ) => evt.stopPropagation() ),
        drag1:        self.view.on( 'drag', [ 'Shift' ],           ( evt: any ) => evt.stopPropagation() ),
        drag2:        self.view.on( 'drag', [ 'Shift', 'Control' ], ( evt: any ) => evt.stopPropagation() ),
    }

    E.core.watchUtils.whenTrue(  self.view, 'stationary', function () { self.changedView( { operation: 'move', after: 'end'   } ) } )
    E.core.watchUtils.whenFalse( self.view, 'stationary', function () { self.changedView( { operation: 'move', after: 'start' } ) } )
    self.changedView( {} )

    self.finishedLoading( function () {
        self.map.layers.forEach( function ( ly: any ) {
            if ( !ly || !ly._smk_id ) return
            if ( self.deadViewerLayer[ ly._smk_id ] ) {
                self.map.layers.remove( ly )
                delete self.visibleLayer[ ly._smk_id ]
            }
        } )
        Object.keys( self.deadViewerLayer ).forEach( function ( id: string ) {
            delete self.deadViewerLayer[ id ]
            delete self.visibleLayer[ id ]
        } )
    } )

    self.view.on( 'click', function ( ev: any ) {
        self.pickedLocation( { map: ev.mapPoint, screen: { x: ev.x, y: ev.y } } )
    } )

    self.view.on( 'pointer-move', function ( ev: any ) {
        self.changedLocation( { map: self.view.toMap( ev ), screen: { x: ev.x, y: ev.y } } )
    } )

    E.core.watchUtils.watch( self.view.popup, 'visible', function () { self.changedPopup() } )

    } )
}

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

ViewerEsri3d.prototype.screenToGroundDistance = function ( pt1: any, pt2: any ) {
    const ll1 = this.screenToMap( pt1 )
    if ( !ll1 ) return
    const ll2 = this.screenToMap( pt2 )
    if ( !ll2 ) return
    return turf.distance( ll1, ll2 ) * 1000
}

ViewerEsri3d.prototype.getView = function ( location?: any ) {
    if ( !this.view.center ) return

    const E  = smkRef.TYPE.Esri3d
    const ex = E.geometry.support.webMercatorUtils.webMercatorToGeographic( this.view.extent )
    const w  = this.view.width
    const h  = this.view.height
    let scale: number, metersPerPixel: number

    if ( location ) {
        const s   = location.screen
        const d   = this.screenToGroundDistance( [ s.x - 50, s.y ], [ s.x + 50, s.y ] )
        scale          = d / this.screenpixelsToMeters
        metersPerPixel = d / 100
    } else {
        const tl = this.screenToGroundDistance( [ 0, 0 ],     [ 100, 0 ] )
        const tr = this.screenToGroundDistance( [ w, 0 ],     [ w - 100, 0 ] )
        const bl = this.screenToGroundDistance( [ 0, h ],     [ 100, h ] )
        const br = this.screenToGroundDistance( [ w, h ],     [ w - 100, h ] )
        const c  = this.screenToGroundDistance( [ w / 2 - 50, h / 2 ], [ w / 2 + 50, h / 2 ] )

        let mapDist: number | undefined
        if ( tl && tr && bl && br && c ) {
            const t    = Math.max( tr, tl ) / Math.min( tr, tl ) * 100 - 100
            const b    = Math.max( br, bl ) / Math.min( br, bl ) * 100 - 100
            const l    = Math.max( tl, bl ) / Math.min( tl, bl ) * 100 - 100
            const r    = Math.max( tr, br ) / Math.min( tr, br ) * 100 - 100
            const tlc  = Math.max( tl, c )  / Math.min( tl, c )  * 100 - 100
            const trc  = Math.max( tr, c )  / Math.min( tr, c )  * 100 - 100
            const blc  = Math.max( bl, c )  / Math.min( bl, c )  * 100 - 100
            const brc  = Math.max( br, c )  / Math.min( br, c )  * 100 - 100
            const fudge      = Math.pow( 2000 / Math.min( 2000, c ), 1.1 )
            const maxChange  = Math.max( t, b, l, r, tlc, trc, blc, brc ) / fudge
            if ( maxChange < 6 ) mapDist = c
        }

        if ( mapDist ) {
            scale          = mapDist / this.screenpixelsToMeters
            metersPerPixel = mapDist / 100
        } else {
            scale          = this.view.scale
            metersPerPixel = ( scale * this.screenpixelsToMeters ) / 100
        }
    }

    return {
        center:         this.view.center,
        zoom:           this.view.zoom,
        extent:         [ ex.xmin, ex.ymin, ex.xmax, ex.ymax ],
        screen:         { width: w, height: h },
        scale,
        metersPerPixel,
    }
}

ViewerEsri3d.prototype.screenToMap = function ( screen: any ) {
    const ll = Array.isArray( screen )
        ? this.view.toMap( { x: screen[ 0 ], y: screen[ 1 ] } )
        : this.view.toMap( screen )
    if ( !ll ) return
    return [ ll.longitude, ll.latitude ]
}

// ---------------------------------------------------------------------------
// initializeBasemaps
// ---------------------------------------------------------------------------
// 1. Wraps defineBaseMap to inject the ArcGIS basemap string alias (esri3d)
//    for the deprecated basemaps so setBasemap() can use them.
// 2. Registers Leaflet-based type factories so tool-baseMaps can render
//    Leaflet thumbnail mini-maps regardless of which viewer is active.

const esri3dAliases: Record<string, string> = {
    // Legacy deprecated basemaps
    'topographic':          'topo',
    'streets':              'streets',
    'imagery':              'satellite',
    'oceans':               'oceans',
    'nationalgeographic':   'national-geographic',
    'shadedrelief':         'terrain',
    'darkgray':             'dark-gray',
    'gray':                 'gray',
    // Current basemaps — mapped to closest ArcGIS 3D named basemap
    'bc-roads':             'streets',
    'bc-roads-raster':      'streets',
    'topography':           'topo',
    'topography-vector':    'topo',
    'topography-hillshade': 'terrain',
    'streets-esri-v2':      'streets',
}

ViewerEsri3d.prototype.initializeBasemaps = function (
    defineBaseMap:     ( id: string, config?: any ) => any,
    defineBaseMapType: ( type: string, fn?: Function ) => any,
) {
    // Wrap defineBaseMap to inject esri3d alias into deprecated basemap configs
    function wrappedDefineBaseMap( id: string, def?: any ) {
        if ( !def ) return defineBaseMap( id )
        const alias = esri3dAliases[ id.toLowerCase() ]
        return defineBaseMap( id, alias ? Object.assign( {}, def, { esri3d: alias } ) : def )
    }

    // Register Leaflet basemap type factories so the baseMaps tool can render
    // Leaflet thumbnail maps for each entry in the basemap switcher panel.
    defineBaseMapType( 'esri-basemap', function ( cfg: any ) {
        const opt  = Object.assign( { detectRetina: true }, cfg.option )
        const orig = JSON.parse( JSON.stringify( L.esri.BasemapLayer.TILES[ cfg.key ].options ) )
        const ly   = L.esri.basemapLayer( cfg.key, JSON.parse( JSON.stringify( opt || {} ) ) )
        L.esri.BasemapLayer.TILES[ cfg.key ].options = orig
        return [ ly ]
    } )

    defineBaseMapType( 'tile', function ( cfg: any ) {
        return [ L.tileLayer( cfg.url, Object.assign( { attribution: cfg.attribution }, cfg.option ) ) ]
    } )

    defineBaseMapType( 'esri-vector-tile', function ( cfg: any ) {
        return [ L.esri.Vector.vectorTileLayer( cfg.url, Object.assign( { maxZoom: 30 }, cfg.option ) ) ]
    } )

    defineBaseMapType( 'esri-vector-basemap', function ( cfg: any ) {
        return [ L.esri.Vector.vectorBasemapLayer( cfg.key, Object.assign( { maxZoom: 30 }, cfg.option ) ) ]
    } )

    defineBaseMapType( 'esri-tiled-map', function ( cfg: any ) {
        return [ L.esri.tiledMapLayer( Object.assign( { url: cfg.url, maxZoom: 30 }, cfg.option ) ) ]
    } )

    defineBaseMapType( 'esri-static-basemap-tile', function ( cfg: any ) {
        return [ L.esri.Static.staticBasemapTileLayer( cfg.style, Object.assign( { maxZoom: 30 }, cfg.option ) ) ]
    } )

    Viewer.prototype.initializeBasemaps.call( this, wrappedDefineBaseMap, defineBaseMapType )
}

// ---------------------------------------------------------------------------
// setBasemap
// ---------------------------------------------------------------------------

ViewerEsri3d.prototype.setBasemap = function ( basemapId: string ) {
    const cfg = this.basemap[ basemapId ]
    if ( cfg?.esri3d ) this.map.basemap = cfg.esri3d
    this.changedBaseMap( { baseMap: basemapId } )
}

ViewerEsri3d.prototype.addViewerLayer       = function ( viewerLayer: any )               { this.map.add( viewerLayer ) }
ViewerEsri3d.prototype.positionViewerLayer  = function ( viewerLayer: any, zOrder: number ) { this.map.reorder( viewerLayer, zOrder ) }

ViewerEsri3d.prototype.showPopup = function ( contentEl: any, location: any, option: any ) {
    if ( location == null ) location = this.popupLocation
    if ( location == null ) return
    this.popupLocation              = location
    this.view.popup.actions         = []
    this.view.popup.dockOptions     = { buttonEnabled: false }
    this.view.popup.open( Object.assign( {
        content:  contentEl,
        location: { type: 'point', latitude: location.latitude, longitude: location.longitude },
    }, option ) )
}

ViewerEsri3d.prototype.hidePopup      = function () { this.view.popup.close()   }
ViewerEsri3d.prototype.isPopupVisible = function () { return this.view.popup.visible }

ViewerEsri3d.prototype.panToFeature = function ( feature: any, zoomIn: any ) {
    const E = smkRef.TYPE.Esri3d
    let geometry: any

    switch ( turf.getType( feature ) ) {
    case 'Point':
        geometry = new E.geometry.Point( {
            latitude:  feature.geometry.coordinates[ 1 ],
            longitude: feature.geometry.coordinates[ 0 ],
        } )
        break
    default: {
        const bbox = turf.bbox( feature )
        geometry = new E.geometry.Extent( { xmin: bbox[0], xmax: bbox[2], ymin: bbox[1], ymax: bbox[3] } )
    }
    }

    if ( !geometry ) return

    let maxZoom: number | undefined
    if ( !zoomIn )              maxZoom = this.view.zoom
    else if ( zoomIn !== true ) maxZoom = parseFloat( zoomIn )

    return this.view.goTo( { target: geometry, zoom: maxZoom } )
}

ViewerEsri3d.prototype.setView = function ( opt: any ) {
    const E = smkRef.TYPE.Esri3d

    if ( opt.extent ) {
        const bx = opt.extent
        this.view.extent = new E.geometry.Extent( { xmin: bx[0], ymin: bx[1], xmax: bx[2], ymax: bx[3] } )
    }
    if ( opt.zoom )   this.view.zoom   = opt.zoom
    if ( opt.center ) {
        this.view.center = new E.geometry.Point( { x: opt.center[0], y: opt.center[1] } )
    }
    if ( opt.camera ) this.view.camera = new E.Camera( opt.camera )
}

export default ViewerEsri3d
