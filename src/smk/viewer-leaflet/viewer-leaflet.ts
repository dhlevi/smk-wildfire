/**
 * viewer-leaflet — Leaflet-based map viewer.
 * Converted from viewer-leaflet/viewer-leaflet.js (include.module -> ES module).
 */

import { Viewer } from '../viewer'
import { defineBaseMaps } from '../base-maps'

declare const L:    any
declare const turf: any

// ---------------------------------------------------------------------------
// ViewerLeaflet constructor
// ---------------------------------------------------------------------------

export class ViewerLeaflet extends Viewer {
    constructor() { super() }
}

// All instance methods are still attached via prototype assignment below so
// the rest of the file doesn't need to change.

// Register on SMK.TYPE.Viewer.leaflet
const smkRef = ( window as any ).SMK
if ( smkRef ) {
    if ( !smkRef.TYPE )         smkRef.TYPE = {}
    if ( !smkRef.TYPE.Viewer )  smkRef.TYPE.Viewer = {}
    smkRef.TYPE.Viewer.leaflet = ViewerLeaflet
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

ViewerLeaflet.prototype.initialize = function ( smk: any ) {
    const self = this

    Viewer.prototype.initialize.apply( this, arguments )

    this.deadViewerLayer = {}

    const el = smk.addToContainer( '<div class="smk-viewer">' )

    self.map = L.map( el, {
        dragging:        false,
        zoomControl:     false,
        boxZoom:         false,
        doubleClickZoom: false,
        zoomSnap:        smk.viewer.zoomSnap,
        minZoom:         smk.viewer.minZoom,
    } )

    self.map.scrollWheelZoom.disable()

    this.setView( smk.viewer.location )

    if ( smk.viewer.baseMap ) {
        self.setBasemap( smk.viewer.baseMap )
    }

    this.changedViewDebounced = ( window as any ).SMK.UTIL.makeDelayedCall( function () {
        self.changedView()
    }, { delay: 1000 } )

    self.map.on( 'zoomstart', this.changedViewDebounced )
    self.map.on( 'movestart', this.changedViewDebounced )
    self.map.on( 'zoomend',   this.changedViewDebounced )
    self.map.on( 'moveend',   this.changedViewDebounced )
    this.changedViewDebounced()

    self.finishedLoading( function () {
        self.map.eachLayer( function ( ly: any ) {
            if ( !ly._smk_id ) return

            if ( self.deadViewerLayer[ ly._smk_id ] ) {
                self.map.removeLayer( ly )
                delete self.visibleLayer[ ly._smk_id ]
            }
        } )

        Object.keys( self.deadViewerLayer ).forEach( function ( id: string ) {
            delete self.deadViewerLayer[ id ]
            delete self.visibleLayer[ id ]
        } )
    } )

    self.map.on( 'click', function ( ev: any ) {
        if ( self.clickTimeout ) clearTimeout( self.clickTimeout )
        self.clickTimeout = setTimeout( function () {
            self.pickedLocation( {
                map:    { latitude: ev.latlng.lat, longitude: ev.latlng.lng },
                screen: ev.containerPoint,
            } )
        }, 300 )
    } )

    self.map.on( 'dblclick', function () {
        if ( self.clickTimeout ) clearTimeout( self.clickTimeout )
    } )

    self.map.on( 'mousemove', function ( ev: any ) {
        self.changedLocation( {
            map:    { latitude: ev.latlng.lat, longitude: ev.latlng.lng },
            screen: ev.containerPoint,
        } )
    } )

    self.getVar = function () { return smk.getVar.apply( smk, arguments ) }
}

ViewerLeaflet.prototype.destroy = function () {
    this.map.remove()
    Viewer.prototype.destroy.call( this )
}

// ---------------------------------------------------------------------------
// initializeBasemaps
// ---------------------------------------------------------------------------

ViewerLeaflet.prototype.initializeBasemaps = function (
    defineBaseMap:     ( id: string, config?: any ) => any,
    defineBaseMapType: ( type: string, fn?: Function ) => any,
) {
    defineBaseMapType( 'esri-basemap', function ( cfg: any ) {
        const opt  = Object.assign( { detectRetina: true }, cfg.option )
        const orig = clone( L.esri.BasemapLayer.TILES[ cfg.key ].options )
        const ly   = L.esri.basemapLayer( cfg.key, clone( opt || {} ) )
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

    Viewer.prototype.initializeBasemaps.call( this, defineBaseMap, defineBaseMapType )
}

// ---------------------------------------------------------------------------
// setBasemap / setView / getView / screenToMap
// ---------------------------------------------------------------------------

ViewerLeaflet.prototype.setBasemap = function ( basemapId: string ) {
    const self = this

    if ( this.currentBasemap ) {
        this.currentBasemap.forEach( ( ly: any ) => self.map.removeLayer( ly ) )
    }

    this.currentBasemap = this.createBasemapLayer( basemapId )
    this.map.addLayer( this.currentBasemap[ 0 ] )

    if ( this.currentBasemap[ 0 ].bringToBack )
        this.currentBasemap[ 0 ].bringToBack()

    for ( let i = 1; i < this.currentBasemap.length; i += 1 )
        this.map.addLayer( this.currentBasemap[ i ] )

    this.changedBaseMap( { baseMap: basemapId } )
}

ViewerLeaflet.prototype.setView = function ( opt: any ) {
    if ( opt.extent ) {
        const bx = opt.extent
        this.map.fitBounds( [ [ bx[ 1 ], bx[ 0 ] ], [ bx[ 3 ], bx[ 2 ] ] ], {
            animate:            false,
            duration:           0,
            paddingTopLeft:     bx[ 4 ],
            paddingBottomRight: bx[ 5 ],
        } )
    }

    if ( opt.zoom )
        this.map.setZoom( opt.zoom, { animate: false } )

    if ( opt.center )
        this.map.panTo( [ opt.center[ 1 ], opt.center[ 0 ] ], { animate: false } )
}

ViewerLeaflet.prototype.getScale = function () {
    const size = this.map.getSize()
    const vert = size.y / 2
    const mapDist = this.map.distance(
        this.map.containerPointToLatLng( [ 0,   vert ] ),
        this.map.containerPointToLatLng( [ 100, vert ] ),
    )
    return mapDist / this.screenpixelsToMeters
}

ViewerLeaflet.prototype.getView = function () {
    const b    = this.map.getBounds()
    const size = this.map.getSize()
    const c    = this.map.getCenter()
    const vert = size.y / 2
    const mapDist = this.map.distance(
        this.map.containerPointToLatLng( [ 0,   vert ] ),
        this.map.containerPointToLatLng( [ 100, vert ] ),
    )

    return {
        center:         { latitude: c.lat, longitude: c.lng },
        zoom:           this.map.getZoom(),
        extent:         [ b.getWest(), b.getSouth(), b.getEast(), b.getNorth() ],
        scale:          mapDist / this.screenpixelsToMeters,
        metersPerPixel: mapDist / 100,
        screen:         { width: size.x, height: size.y },
    }
}

ViewerLeaflet.prototype.screenToMap = function ( screen: any ) {
    const ll = Array.isArray( screen )
        ? this.map.containerPointToLatLng( screen )
        : this.map.containerPointToLatLng( [ screen.x, screen.y ] )
    return [ ll.lng, ll.lat ]
}

// ---------------------------------------------------------------------------
// Layer management
// ---------------------------------------------------------------------------

ViewerLeaflet.prototype.addViewerLayer = function ( viewerLayer: any ) {
    this.map.addLayer( viewerLayer )
}

ViewerLeaflet.prototype.positionViewerLayer = function ( viewerLayer: any, zOrder: number ) {
    viewerLayer.setZIndex( zOrder )
}

// ---------------------------------------------------------------------------
// Panel / display context
// ---------------------------------------------------------------------------

ViewerLeaflet.prototype.getPanelPadding = function () {
    const sbp  = this.getSidepanelPosition()
    const size = this.map.getSize()

    const aboveH = sbp.top
    const belowH = size.y - sbp.top - sbp.height
    const leftW  = sbp.left
    const rightW = size.x - sbp.left - sbp.width

    if ( Math.max( aboveH, belowH ) > Math.max( leftW, rightW ) ) {
        return aboveH > belowH
            ? { topLeft: L.point( 0, 0 ),            bottomRight: L.point( 0, size.y - sbp.top ) }
            : { topLeft: L.point( 0, sbp.top + sbp.height ), bottomRight: L.point( 0, 0 ) }
    } else {
        return leftW > rightW
            ? { topLeft: L.point( 0, 0 ),                   bottomRight: L.point( size.x - sbp.left, 0 ) }
            : { topLeft: L.point( sbp.left + sbp.width, 0 ), bottomRight: L.point( 0, 0 ) }
    }
}

ViewerLeaflet.prototype.temporaryFeature = function ( acetate: string, geometry: any, opt: any ) {
    if ( !this.acetate )          this.acetate = {}
    if ( !this.acetate[ acetate ] ) this.acetate[ acetate ] = L.layerGroup().addTo( this.map )

    this.acetate[ acetate ].clearLayers()

    if ( geometry ) {
        this.acetate[ acetate ].addLayer( L.geoJSON( geometry, opt ) )
    }
}

ViewerLeaflet.prototype.panToFeature = function ( feature: any, zoomIn: any ) {
    let bounds: any
    switch ( turf.getType( feature ) ) {
    case 'Point': {
        const ll = L.latLng( feature.geometry.coordinates[ 1 ], feature.geometry.coordinates[ 0 ] )
        bounds   = L.latLngBounds( [ ll, ll ] )
        break
    }
    default: {
        const bbox = turf.bbox( feature )
        bounds = L.latLngBounds( [ bbox[ 1 ], bbox[ 0 ] ], [ bbox[ 3 ], bbox[ 2 ] ] )
    }
    }

    if ( !bounds ) return

    const padding = this.getPanelPadding()

    let maxZoom: number | undefined
    if ( !zoomIn )             maxZoom = this.map.getZoom()
    else if ( zoomIn !== true ) maxZoom = parseFloat( zoomIn )

    this.map.fitBounds( bounds, {
        paddingTopLeft:     padding.topLeft,
        paddingBottomRight: padding.bottomRight,
        maxZoom,
        animate: true,
    } )
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function clone( obj: any ) {
    return JSON.parse( JSON.stringify( obj ) )
}

export default ViewerLeaflet
