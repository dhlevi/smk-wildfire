/**
 * layer-vector-maplibre — MapLibre vector (GeoJSON) layer adapter.
 *
 * Loads GeoJSON from `dataUrl` (or the inline `data:` URL produced by the
 * `isInternal` flow) and renders it as MapLibre fill / line / circle layers
 * off a single GeoJSON source.
 *
 * Supports dynamic data updates via `loadLayer` / `clearLayer` hooks attached
 * to the `Layer` instance — used by `tool-internal-layers` to drive feature
 * highlights, search results, drawn markup, etc.
 *
 * Style key compatibility: accepts both Leaflet-flavoured names
 * (`color`, `weight`, `opacity`, `fillColor`, `fillOpacity`, `radius`) and
 * the SMK-internal "style" config names (`strokeColor`, `strokeWidth`,
 * `strokeOpacity`).
 */

import { VectorLayer } from '../../layer/layer-types'
import { Layer }       from '../../layer/layer'
import { getProjection, reprojectGeoJSON, makePromise } from '../../util'

export class VectorMapLibreLayer extends VectorLayer {}

;( Layer as any )[ 'vector' ][ 'maplibre' ] = VectorMapLibreLayer

const EMPTY = { type: 'FeatureCollection' as const, features: [] }

;( VectorMapLibreLayer as any ).create = function ( layers: any[], _zIndex: number ) {
    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )
    const self  = this                   // viewer
    const cfg   = layers[ 0 ].config
    const style = ( [] as any[] ).concat( cfg.style || [] )[ 0 ] || {}

    const id       = '_smk_vec_' + cfg.id
    const fillId   = id + '_fill'
    const lineId   = id + '_line'
    const circleId = id + '_circle'

    const opacity = cfg.opacity != null ? cfg.opacity : 1

    const strokeColor   = style.strokeColor   || style.color     || '#3388ff'
    const strokeWidth   = style.strokeWidth   || style.weight    || 2
    const strokeOpacity = ( style.strokeOpacity != null ? style.strokeOpacity
                          : style.opacity     != null ? style.opacity
                          : 1 ) * opacity
    const fillColor     = style.fillColor     || strokeColor
    const fillOpacity   = ( style.fillOpacity != null ? style.fillOpacity : 0.3 ) * opacity
    const radius        = style.radius || 5

    const spec = {
        sourceId: id,
        source:   { type: 'geojson', data: EMPTY },
        layers: [
            {
                id:     fillId,
                type:   'fill',
                source: id,
                filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'Polygon', 'MultiPolygon' ] ] ],
                paint:  {
                    'fill-color':         fillColor,
                    'fill-opacity':       fillOpacity,
                    'fill-outline-color': strokeColor,
                },
            },
            {
                id:     lineId,
                type:   'line',
                source: id,
                filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon' ] ] ],
                paint: {
                    'line-color':   strokeColor,
                    'line-width':   strokeWidth,
                    'line-opacity': strokeOpacity,
                },
            },
            {
                id:     circleId,
                type:   'circle',
                source: id,
                filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'Point', 'MultiPoint' ] ] ],
                paint: {
                    'circle-radius':       radius,
                    'circle-color':        fillColor,
                    'circle-opacity':      fillOpacity || strokeOpacity,
                    'circle-stroke-color': strokeColor,
                    'circle-stroke-width': Math.max( 1, strokeWidth - 1 ),
                },
            },
        ],
    }

    // ------------------------------------------------------------------
    // Wire up dynamic load/clear (used by ToolInternalLayers etc.).
    // The handlers must work both before and after the source has been
    // added to the map — `loadCache` buffers calls that arrive early.
    // ------------------------------------------------------------------

    const layerCfg: any = layers[ 0 ]

    layerCfg.loadLayer = function ( data: any ) {
        const src = self.map && self.map.getSource && self.map.getSource( id )
        if ( src ) {
            src.setData( data || EMPTY )
        } else {
            layerCfg.loadCache = data
        }
    }

    layerCfg.clearLayer = function () {
        const src = self.map && self.map.getSource && self.map.getSource( id )
        if ( src ) src.setData( EMPTY )
        layerCfg.loadCache = null
    }

    // ------------------------------------------------------------------
    // Initial data load
    // ------------------------------------------------------------------

    function setInitial( data: any ) {
        if ( data ) ( spec.source as any ).data = data
        // If addViewerLayer has already run, push to the live source too.
        const src = self.map && self.map.getSource && self.map.getSource( id )
        if ( src && data ) src.setData( data )
        return spec
    }

    function flushCache() {
        if ( layerCfg.loadCache ) {
            const cached = layerCfg.loadCache
            layerCfg.loadCache = null
            layerCfg.loadLayer( cached )
        }
        return spec
    }

    const projectPromise: Promise<( pt: number[] ) => number[]> = cfg.projection
        ? getProjection( cfg.projection )
        : Promise.resolve( ( pt: number[] ) => pt )

    return projectPromise.then( function ( reproject ) {
        function project( data: any ) {
            return cfg.projection && data ? reprojectGeoJSON( data, reproject ) : data
        }

        // Internal layer: no remote data, source starts empty
        if ( cfg.isInternal ) return flushCache()

        const url = cfg.dataUrl
            ? self.resolveAttachmentUrl( cfg.dataUrl, cfg.id, 'json' )
            : null

        if ( !url ) return flushCache()

        if ( url.startsWith( 'data:' ) ) {
            try {
                const json = JSON.parse( decodeURIComponent( url.replace( /^data:application\/json,/, '' ) ) )
                return setInitial( project( json ) )
            } catch ( e ) {
                console.warn( 'vector maplibre layer "' + cfg.id + '" inline parse failed:', e )
                return flushCache()
            }
        }

        return fetch( url )
            .then( ( r: Response ) => {
                if ( !r.ok ) throw new Error( 'Failed requesting ' + url + ': ' + r.status )
                return r.json()
            } )
        .then( ( data: any ) => setInitial( project( data ) ) )
        .catch( ( e: any ) => {
            console.warn( 'vector maplibre layer "' + cfg.id + '" load failed:', e )
            return flushCache()
        } )
    } )
}

export default VectorMapLibreLayer
