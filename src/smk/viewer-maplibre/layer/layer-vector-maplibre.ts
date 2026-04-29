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

declare const turf: any

export class VectorMapLibreLayer extends VectorLayer {}

;( Layer as any )[ 'vector' ][ 'maplibre' ] = VectorMapLibreLayer

// ---------------------------------------------------------------------------
// Identify support — mirrors the Leaflet vector adapter.
//
// `option.layer` is the spec object produced by .create() above; we stash the
// GeoJSON FeatureCollection on `spec.source.data`, so we can iterate features
// directly (no need to ask MapLibre for tile-clipped fragments).
// ---------------------------------------------------------------------------

;( VectorMapLibreLayer.prototype as any ).getFeaturesInArea = function (
    area: any, _view: any, option: any,
): any[] {
    const spec = option && option.layer
    const data = spec && spec.source && spec.source.data
    if ( !data || !Array.isArray( data.features ) ) return []

    const features: any[] = []

    data.features.forEach( ( ft: any ) => {
        if ( !ft || !ft.geometry ) return
        try {
            switch ( ft.geometry.type ) {
            case 'Polygon':
                if ( turf.intersect( ft, area ) ) features.push( ft )
                break
            case 'MultiPolygon':
                if ( ft.geometry.coordinates.reduce( ( a: boolean, poly: any ) =>
                    a || !!turf.intersect( turf.polygon( poly ), area ), false ) )
                    features.push( ft )
                break
            case 'LineString':
                if ( turf.booleanCrosses( area, ft ) || turf.booleanContains( area, ft ) )
                    features.push( ft )
                break
            case 'MultiLineString': {
                const hit = turf.segmentReduce( ft, ( a: boolean, seg: any ) =>
                    a || turf.booleanCrosses( area, seg ) || turf.booleanContains( area, seg ), false )
                if ( hit ) features.push( ft )
                break
            }
            case 'Point':
            case 'MultiPoint': {
                const inside = turf.coordReduce( ft, ( a: boolean, c: any ) =>
                    a || turf.booleanPointInPolygon( c, area ), false )
                if ( inside ) features.push( ft )
                break
            }
            default:
                console.warn( 'identify: skip', ft.geometry.type )
            }
        } catch ( e ) {
            console.warn( 'identify feature failed:', e, ft )
        }
    } )

    return features
}

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
    const labelId  = id + '_label'

    const opacity = cfg.opacity != null ? cfg.opacity : 1

    // ------------------------------------------------------------------
    // Label config
    //
    // Accepted shapes on cfg.label:
    //   - string                  → attribute name (used as both field and template)
    //   - { field: 'NAME' }       → attribute name only
    //   - { format: '{NAME} ...' } → template; '{attr}' tokens are replaced
    //                               with the feature's property values
    //   - object may also carry: color, size, haloColor, haloWidth, font,
    //     placement ('point'|'line'|'line-center'),
    //     minZoom, maxZoom, allowOverlap, offset (px [x,y])
    //
    // Labels are computed onto a synthetic `_smk_label` property on each
    // feature, so the symbol layer just reads `['get', '_smk_label']`.
    // ------------------------------------------------------------------

    const labelCfg: any = ( typeof cfg.label === 'string' )
        ? { field: cfg.label }
        : ( cfg.label && typeof cfg.label === 'object' ? cfg.label : null )

    const labelTemplate: string | null = labelCfg
        ? ( labelCfg.format || ( labelCfg.field ? '{' + labelCfg.field + '}' : null ) )
        : null

    function formatLabel( props: any ): string {
        if ( !labelTemplate || !props ) return ''
        return labelTemplate.replace( /\{([^{}]+)\}/g, ( _m, key ) => {
            const v = props[ key ]
            return v == null ? '' : String( v )
        } )
    }

    function applyLabels( data: any ): any {
        if ( !labelTemplate || !data || !Array.isArray( data.features ) ) return data
        data.features.forEach( ( ft: any ) => {
            if ( !ft ) return
            if ( !ft.properties ) ft.properties = {}
            ft.properties._smk_label = formatLabel( ft.properties )
        } )
        return data
    }

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

    if ( labelTemplate ) {
        const placement = labelCfg.placement === 'line' || labelCfg.placement === 'line-center'
            ? labelCfg.placement
            : 'point'

        const symbolLayer: any = {
            id:     labelId,
            type:   'symbol',
            source: id,
            minzoom: labelCfg.minZoom != null ? labelCfg.minZoom : 0,
            maxzoom: labelCfg.maxZoom != null ? labelCfg.maxZoom : 24,
            layout: {
                'text-field':         [ 'get', '_smk_label' ],
                'text-font':          labelCfg.font || [ 'Open Sans Regular', 'Arial Unicode MS Regular' ],
                'text-size':          labelCfg.size  != null ? labelCfg.size  : 12,
                'text-allow-overlap': !!labelCfg.allowOverlap,
                'text-ignore-placement': !!labelCfg.allowOverlap,
                'text-anchor':        labelCfg.anchor || 'center',
                'text-offset':        labelCfg.offset || [ 0, 0 ],
                'symbol-placement':   placement,
            },
            paint: {
                'text-color':      labelCfg.color     || '#222',
                'text-halo-color': labelCfg.haloColor || '#fff',
                'text-halo-width': labelCfg.haloWidth != null ? labelCfg.haloWidth : 1.5,
                'text-opacity':    ( labelCfg.opacity != null ? labelCfg.opacity : 1 ) * opacity,
            },
        }
        ;( spec.layers as any[] ).push( symbolLayer )
    }

    // ------------------------------------------------------------------
    // Wire up dynamic load/clear (used by ToolInternalLayers etc.).
    // The handlers must work both before and after the source has been
    // added to the map — `loadCache` buffers calls that arrive early.
    // ------------------------------------------------------------------

    const layerCfg: any = layers[ 0 ]

    layerCfg.loadLayer = function ( data: any ) {
        const labelled = applyLabels( data )
        const src = self.map && self.map.getSource && self.map.getSource( id )
        if ( src ) {
            src.setData( labelled || EMPTY )
        } else {
            layerCfg.loadCache = labelled
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
        const labelled = applyLabels( data )
        if ( labelled ) ( spec.source as any ).data = labelled
        // If addViewerLayer has already run, push to the live source too.
        const src = self.map && self.map.getSource && self.map.getSource( id )
        if ( src && labelled ) src.setData( labelled )
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
