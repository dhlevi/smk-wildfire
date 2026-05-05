/**
 * SMK Concrete Layer Types
 * Converted from layer/layer-*.js to TypeScript ES module.
 *
 * Depends (converted): layer/layer.ts, util.ts
 *
 * Defines six concrete layer type classes and registers them on the
 * Layer constructor so that runtime dispatch via Layer[type] works:
 *
 *   Layer['vector']        — VectorLayer
 *   Layer['wms']           — WmsLayer
 *   Layer['esri-dynamic']  — EsriDynamicLayer
 *   Layer['esri-feature']  — EsriFeatureLayer
 *   Layer['esri-tiled']    — EsriTiledLayer
 *   Layer['cluster']       — ClusterLayer
 *
 * External deps still accessed via window globals (not yet converted):
 *   window.Terraformer — used by ESRI layer types for geometry conversion
 */

import { Layer }                                    from './layer'
import { makePromise, resolved, getProjection, reprojectGeoJSON, featureTitle } from '../util'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** POST with form-encoded body, returns parsed JSON. */
function fetchPost( url: string, data: Record<string, unknown> ): Promise<any> {
    const body = new URLSearchParams(
        Object.entries( data ).map( ( [ k, v ] ) => [ k, String( v ) ] )
    )
    return fetch( url, { method: 'POST', body } )
        .then( r => {
            if ( !r.ok ) throw new Error( `Request failed ${ r.status }` )
            return r.json()
        } )
}

/** GET with query string, returns parsed JSON. */
function fetchGet( url: string, data: Record<string, unknown> ): Promise<any> {
    const qs = new URLSearchParams(
        Object.entries( data ).map( ( [ k, v ] ) => [ k, String( v ) ] )
    ).toString()
    return fetch( `${ url }?${ qs }` )
        .then( r => {
            if ( !r.ok ) throw new Error( `Request failed ${ r.status }` )
            return r.json()
        } )
}

/**
 * Load an image and resolve when it is ready.
 * Returns a Promise<HTMLImageElement>.
 */
function loadImage( src: string ): Promise<HTMLImageElement> {
    return new Promise( ( res, rej ) => {
        const img = new Image()
        img.onload  = () => res( img )
        img.onerror = () => rej( new Error( `Unable to load: ${ src }` ) )
        img.src = src
        if ( img.complete && img.naturalWidth ) res( img )
    } )
}

/**
 * Parse a CSS color string into an rgba() string.
 * Uses a temporary hidden element to let the browser do the parsing.
 * Result is memoised.
 */
const _colorMemo: Record<string, string> = {}
function cssColorAsRGBA( color: string, opacity?: number ): string {
    let rgb = _colorMemo[ color ]
    if ( !rgb ) {
        const div = document.createElement( 'div' )
        div.style.display         = 'none'
        div.style.backgroundColor = color
        document.body.appendChild( div )
        _colorMemo[ color ] = rgb = window.getComputedStyle( div ).backgroundColor
        document.body.removeChild( div )
    }

    // rgb(r, g, b) - rgba(r, g, b, opacity)
    const m = rgb.match( /\d+/g )
    if ( !m || m.length < 3 ) throw new Error( `can't parse: ${ rgb }` )
    return `rgba( ${ m[ 0 ] },${ m[ 1 ] },${ m[ 2 ] },${ opacity ?? 1 } )`
}

/** Map ESRI feature result to GeoJSON feature. */
function esriResultToFeature( r: any ): any {
    const Terraformer = ( window as any ).Terraformer
    const f: any = { type: 'Feature' }

    if ( r.displayFieldName )
        f.title = r.attributes[ r.displayFieldName ]

    // Terraformer returns class instances (e.g. Terraformer.Point); strip
    // prototypes so the geometry is plain GeoJSON safe for structured-clone
    // (used by MapLibre when transferring data to its worker).
    const geom = Terraformer.ArcGIS.parse( r.geometry )
    f.geometry = { type: geom.type, coordinates: geom.coordinates }

    if ( f.geometry.type === 'MultiPoint' && f.geometry.coordinates.length === 1 ) {
        f.geometry.type        = 'Point'
        f.geometry.coordinates = f.geometry.coordinates[ 0 ]
    }

    f.properties = r.attributes
    return f
}

// ---------------------------------------------------------------------------
// VectorLayer
// ---------------------------------------------------------------------------

class VectorLayer extends Layer {
    initLegends( viewer: any, width?: number, height?: number ): Promise<any[]> {
        const self = this

        if ( width  == null ) width  = 20
        if ( height == null ) height = 20

        const legend = ( this.config as any ).legend || {}
        const style  = ( this.config as any ).style  || {}
        const styles: any[] = [].concat( style )

        const mult = ( !!legend.point ? 1 : 0 )
                   + ( !!legend.line  ? 1 : 0 )
                   + ( !!legend.fill  ? 1 : 0 )

        const cv  = document.createElement( 'canvas' )
        cv.width  = width * mult
        cv.height = height
        const ctx = cv.getContext( '2d' )!

        let chain: Promise<number> = resolved( 0 )

        if ( legend.point ) {
            chain = chain.then( offset => {
                if ( styles[ 0 ].markerUrl ) {
                    const src = viewer.resolveAttachmentUrl( styles[ 0 ].markerUrl, null, 'png' )
                    return loadImage( src ).then( img => {
                        let r = img.width / img.height
                        if ( r > 1 ) r = 1 / r
                        ctx.drawImage( img, offset, 0, height! * r, height! )
                        return offset + width!
                    } ).catch( () => offset + width! )
                }

                ctx.beginPath()
                ctx.arc( offset + width! / 2, height! / 2, styles[ 0 ].strokeWidth / 2, 0, 2 * Math.PI )
                ctx.lineWidth   = 2
                ctx.strokeStyle = cssColorAsRGBA( styles[ 0 ].strokeColor, styles[ 0 ].strokeOpacity )
                ctx.fillStyle   = cssColorAsRGBA( styles[ 0 ].fillColor,   styles[ 0 ].fillOpacity )
                ctx.fill()
                ctx.stroke()
                return offset + width!
            } )
        }

        if ( legend.line ) {
            chain = chain.then( offset => {
                styles.forEach( st => {
                    ctx.lineWidth   = st.strokeWidth
                    ctx.strokeStyle = cssColorAsRGBA( st.strokeColor, st.strokeOpacity )
                    ctx.lineCap     = st.strokeCap as CanvasLineCap
                    if ( st.strokeDashes ) {
                        ctx.setLineDash( st.strokeDashes.split( ',' ) )
                        const dashOffset = parseFloat( st.strokeDashOffset )
                        if ( dashOffset ) ctx.lineDashOffset = dashOffset
                    }
                    const hw = st.strokeWidth / 2
                    ctx.moveTo( offset, height! / 2 )
                    ctx.quadraticCurveTo( offset + width! - hw, 0, offset + width! - hw, height! )
                    ctx.stroke()
                } )
                return offset + width!
            } )
        }

        if ( legend.fill ) {
            chain = chain.then( offset => {
                styles.forEach( st => {
                    ctx.fillStyle = cssColorAsRGBA( st.fillColor, st.fillOpacity )
                    ctx.fillRect( 0, 0, width!, height! )
                } )
                return offset + width!
            } )
        }

        return chain.then( () => ( [ {
            url:    cv.toDataURL( 'image/png' ),
            title:  legend.title || ( self.config as any ).title,
            width,
            height,
        } ] ) )
    }

    load( data: any ): void {
        if ( !data ) return
        if ( ( this as any ).loadLayer )
            return ( this as any ).loadLayer( data )
        ;( this as any ).loadCache = data
    }

    clear(): void {
        if ( ( this as any ).clearLayer )
            return ( this as any ).clearLayer()
    }
}

// ---------------------------------------------------------------------------
// WmsLayer
// ---------------------------------------------------------------------------

class WmsLayer extends Layer {
    canMergeWith( other: Layer ): boolean {
        const a = this.config  as any
        const b = other.config as any
        if ( !a.canMerge || !b.canMerge ) return false
        if ( a.type       !== b.type       ) return false
        if ( a.serviceUrl !== b.serviceUrl ) return false
        if ( a.opacity    !== b.opacity    ) return false
        return true
    }

    initLegends(): Promise<any[]> {
        const self = this
        const cfg  = this.config as any

        const url  = cfg.serviceUrl + '?' + new URLSearchParams( {
            SERVICE:     'WMS',
            VERSION:     '1.1.1',
            REQUEST:     'getlegendgraphic',
            FORMAT:      'image/png',
            TRANSPARENT: 'true',
            LAYER:       cfg.layerName,
            STYLE:       cfg.styleName || '',
        } ).toString()

        return loadImage( url ).then( img => ( [ Object.assign( {
            url,
            width:  img.naturalWidth,
            height: img.naturalHeight,
        }, cfg.legend ) ] ) )
    }

    getFeaturesAtPoint( location: any, view: any, option: any ): Promise<any[]> {
        const cfg     = this.config as any
        const version = '1.1.1'

        const params: Record<string, unknown> = {
            service:       'WMS',
            version,
            request:       'GetFeatureInfo',
            bbox:          view.extent.join( ',' ),
            feature_count: 20,
            height:        view.screen.height,
            width:         view.screen.width,
            info_format:   'application/json',
            layers:        cfg.layerName,
            query_layers:  cfg.layerName,
            styles:        cfg.styleName || '',
            buffer:        option.tolerance,
            srs:           'EPSG:4326',
            x:             Math.round( location.screen.x ),
            y:             Math.round( location.screen.y ),
        }

        return fetchGet( cfg.serviceUrl, params )
            .then( ( geojson: any ) => {
                if ( !geojson?.features?.length ) throw new Error( 'no features' )

                if ( !geojson.crs ) return geojson.features

                const crsName = geojson.crs?.properties?.name
                if ( !crsName )
                    throw new Error( `unable to determine CRS from: ${ JSON.stringify( geojson.crs ) }` )

                return getProjection( crsName )
                    .then( projection => reprojectGeoJSON( geojson, projection ) )
                    .then( ( reprojected: any ) => reprojected.features )
            } )
    }

    getFeaturesInArea( area: any, _view: any, _option: any ): Promise<any[]> {
        const self = this
        const cfg  = this.config as any

        const extraFilter = cfg.where ? ' AND ' + cfg.where : ''

        const polygon = 'SRID=4326;POLYGON ((' +
            area.geometry.coordinates[ 0 ]
                .map( ( c: number[] ) => c.join( ' ' ) ).join( ',' ) +
            '))'

        const data = {
            service:      'WFS',
            version:      '1.1.0',
            request:      'GetFeature',
            srsName:      'EPSG:4326',
            typename:     cfg.layerName,
            outputformat: 'application/json',
            cql_filter:   `INTERSECTS(${ cfg.geometryAttribute || 'GEOMETRY' },${ polygon })${ extraFilter }`,
        }

        return fetchGet( cfg.serviceUrl, data )
            .then( ( d: any ) => {
                if ( !d?.features?.length ) throw new Error( 'no features' )
                return d.features.map( ( f: any, i: number ) => {
                    f.title = featureTitle( cfg, f, `Feature #${ i + 1 }` )
                    return f
                } )
            } )
    }
}

// ---------------------------------------------------------------------------
// EsriDynamicLayer
// ---------------------------------------------------------------------------

class EsriDynamicLayer extends Layer {
    initLegends(): Promise<any[]> {
        const cfg          = this.config as any
        const serviceUrl   = cfg.serviceUrl + '/legend'
        const dynamicLayers = '[' + cfg.dynamicLayers.join( ',' ) + ']'

        return fetchPost( serviceUrl, { f: 'json', dynamicLayers } )
            .then( ( data: any ) => {
                const layer = data.layers[ 0 ]
                return layer.legend.map( ( obj: any ) => ( {
                    url:   'data:image/png;base64,' + obj.imageData,
                    title: obj.label,
                } ) )
            } )
    }

    getFeaturesInArea( area: any, view: any, _option: any ): Promise<any[]> {
        const Terraformer  = ( window as any ).Terraformer
        const cfg          = this.config as any
        const serviceUrl   = cfg.serviceUrl + '/identify'
        const dynamicLayers = '[' + cfg.dynamicLayers.join( ',' ) + ']'
        const esriFeature  = Terraformer.ArcGIS.convert( area )

        const data = {
            f:              'json',
            dynamicLayers,
            sr:             4326,
            tolerance:      0,
            mapExtent:      view.extent.join( ',' ),
            imageDisplay:   [ view.screen.width, view.screen.height, 96 ].join( ',' ),
            returnGeometry: true,
            returnZ:        false,
            returnM:        false,
            geometryType:   'esriGeometryPolygon',
            geometry:       JSON.stringify( esriFeature.geometry ),
        }

        return fetchPost( serviceUrl, data )
            .then( ( d: any ) => {
                if ( !d?.results?.length ) throw new Error( 'no features' )
                return d.results.map( esriResultToFeature )
            } )
    }
}

// ---------------------------------------------------------------------------
// EsriFeatureLayer
// ---------------------------------------------------------------------------

class EsriFeatureLayer extends Layer {
    legendCache:        Promise<any>
    legendCacheResolve: ( value: any ) => void

    constructor( config: any ) {
        super( config )

        const self = this
        this.legendCacheResolve = () => {}   // default no-op; overwritten below
        this.legendCache = new Promise( res => { self.legendCacheResolve = res } )
    }

    initLegends(): Promise<any[]> {
        return this.legendCache.then( ( legends: any[] | undefined ) => {
            if ( !legends ) return []
            return legends.map( ( lg: any ) => ( {
                url:    'data:image/png;base64,' + lg.imageData,
                title:  lg.label,
                height: lg.height,
                width:  lg.width,
            } ) )
        } )
    }

    getFeaturesInArea( area: any, view: any, _option: any ): Promise<any[]> {
        const Terraformer = ( window as any ).Terraformer
        const cfg         = this.config as any
        const serviceUrl  = cfg.serviceUrl + '/query'
        const esriFeature = Terraformer.ArcGIS.convert( area )

        const data: Record<string, unknown> = {
            f:              'json',
            inSR:           4326,
            outSR:          4326,
            tolerance:      0,
            mapExtent:      view.extent.join( ',' ),
            imageDisplay:   [ view.screen.width, view.screen.height, 96 ].join( ',' ),
            returnGeometry: true,
            returnZ:        false,
            returnM:        false,
            geometryType:   'esriGeometryPolygon',
            geometry:       JSON.stringify( esriFeature.geometry ),
            outFields:      '*',
        }

        if ( cfg.where ) data.where = cfg.where

        return fetchPost( serviceUrl, data )
            .then( ( d: any ) => {
                if ( !d?.features?.length ) throw new Error( 'no features' )
                return d.features.map( esriResultToFeature )
            } )
    }
}

// ---------------------------------------------------------------------------
// EsriTiledLayer
// ---------------------------------------------------------------------------

class EsriTiledLayer extends Layer {
    initLegends(): Promise<any[]> {
        const cfg        = this.config as any
        const serviceUrl = cfg.serviceUrl + '/legend'

        return fetchPost( serviceUrl, { f: 'json' } )
            .then( ( data: any ) => {
                const layer = data.layers[ 0 ]
                return layer.legend.map( ( obj: any ) => ( {
                    url:   'data:image/png;base64,' + obj.imageData,
                    title: obj.label,
                } ) )
            } )
    }

    getFeaturesInArea( area: any, view: any, _option: any ): Promise<any[]> {
        const Terraformer = ( window as any ).Terraformer
        const cfg         = this.config as any
        const serviceUrl  = cfg.serviceUrl + '/identify'
        const esriFeature = Terraformer.ArcGIS.convert( area )

        const data = {
            f:              'json',
            sr:             4326,
            tolerance:      0,
            mapExtent:      view.extent.join( ',' ),
            imageDisplay:   [ view.screen.width, view.screen.height, 96 ].join( ',' ),
            returnGeometry: true,
            returnZ:        false,
            returnM:        false,
            geometryType:   'esriGeometryPolygon',
            geometry:       JSON.stringify( esriFeature.geometry ),
        }

        return fetchPost( serviceUrl, data )
            .then( ( d: any ) => {
                if ( !d?.results?.length ) throw new Error( 'no features' )
                return d.results.map( esriResultToFeature )
            } )
    }
}

// ---------------------------------------------------------------------------
// ClusterLayer
// ---------------------------------------------------------------------------

class ClusterLayer extends Layer {
    constructor( config: any ) {
        super( config )
        ;( this.config as any ).isQueryable = false
    }
}

// ---------------------------------------------------------------------------
// Register on Layer constructor (replaces SMK.TYPE.Layer['vector'] etc.)
// ---------------------------------------------------------------------------

;( Layer as any )[ 'vector' ]        = VectorLayer
;( Layer as any )[ 'wms' ]           = WmsLayer
;( Layer as any )[ 'esri-dynamic' ]  = EsriDynamicLayer
;( Layer as any )[ 'esri-feature' ]  = EsriFeatureLayer
;( Layer as any )[ 'esri-tiled' ]    = EsriTiledLayer
;( Layer as any )[ 'cluster' ]       = ClusterLayer

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
    VectorLayer,
    WmsLayer,
    EsriDynamicLayer,
    EsriFeatureLayer,
    EsriTiledLayer,
    ClusterLayer,
}
