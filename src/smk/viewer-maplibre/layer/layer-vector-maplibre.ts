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

    // ------------------------------------------------------------------
    // Clustering — used to prevent point overlap at low zooms.
    //
    // cfg.cluster may be:
    //   - true                      → enable with sensible defaults
    //   - { radius, maxZoom, ... }  → forwarded to the GeoJSON source
    //                                 (radius/maxZoom/minPoints are MapLibre
    //                                 source options); style overrides:
    //                                 color, textColor, textSize, steps
    //                                 (e.g. [ [10,'#f1f075'], [50,'#f28cb1'] ])
    //
    // Only Point/MultiPoint inputs cluster; polygons/lines pass through.
    // ------------------------------------------------------------------
    const clusterCfg: any = ( cfg.cluster === true )
        ? {}
        : ( cfg.cluster && typeof cfg.cluster === 'object' ? cfg.cluster : null )

    const clusterId        = id + '_cluster'
    const clusterCountId   = id + '_cluster_count'
    const unclusteredId    = id + '_unclustered'

    const sourceObj: any = { type: 'geojson', data: EMPTY }
    if ( clusterCfg ) {
        sourceObj.cluster        = true
        sourceObj.clusterRadius  = clusterCfg.radius   != null ? clusterCfg.radius   : 50
        sourceObj.clusterMaxZoom = clusterCfg.maxZoom  != null ? clusterCfg.maxZoom  : 14
        if ( clusterCfg.minPoints != null ) sourceObj.clusterMinPoints = clusterCfg.minPoints
    }

    const spec: any = {
        sourceId: id,
        source:   sourceObj,
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
        ],
    }

    if ( clusterCfg ) {
        // Cluster bubbles — sized & coloured by point_count via 'step' expression.
        const steps: any[] = Array.isArray( clusterCfg.steps ) && clusterCfg.steps.length
            ? clusterCfg.steps
            : [ [ 10, '#f1f075' ], [ 50, '#f28cb1' ] ]
        const baseColor = clusterCfg.color || fillColor

        // Build step expressions: [ 'step', ['get','point_count'], baseValue, threshold, value, ... ]
        const colorExpr: any[] = [ 'step', [ 'get', 'point_count' ], baseColor ]
        const radiusExpr: any[] = [ 'step', [ 'get', 'point_count' ], radius * 3 ]
        steps.forEach( ( s: any, i: number ) => {
            const threshold = Array.isArray( s ) ? s[ 0 ] : s.threshold
            const col       = Array.isArray( s ) ? s[ 1 ] : s.color
            colorExpr.push( threshold, col )
            radiusExpr.push( threshold, radius * ( 4 + i * 1.5 ) )
        } )

        spec.layers.push( {
            id:     clusterId,
            type:   'circle',
            source: id,
            filter: [ 'has', 'point_count' ],
            paint: {
                'circle-color':        colorExpr,
                'circle-radius':       radiusExpr,
                'circle-opacity':      ( clusterCfg.opacity != null ? clusterCfg.opacity : 0.85 ) * opacity,
                'circle-stroke-color': strokeColor,
                'circle-stroke-width': 1,
            },
        } )

        spec.layers.push( {
            id:     clusterCountId,
            type:   'symbol',
            source: id,
            filter: [ 'has', 'point_count' ],
            layout: {
                'text-field':         [ 'get', 'point_count_abbreviated' ],
                'text-font':          clusterCfg.font || [ 'Open Sans Regular', 'Arial Unicode MS Regular' ],
                'text-size':          clusterCfg.textSize != null ? clusterCfg.textSize : 12,
                'text-allow-overlap': true,
            },
            paint: {
                'text-color': clusterCfg.textColor || '#222',
            },
        } )

        spec.layers.push( {
            id:     unclusteredId,
            type:   'circle',
            source: id,
            filter: [ '!', [ 'has', 'point_count' ] ],
            paint: {
                'circle-radius':       radius,
                'circle-color':        fillColor,
                'circle-opacity':      fillOpacity || strokeOpacity,
                'circle-stroke-color': strokeColor,
                'circle-stroke-width': Math.max( 1, strokeWidth - 1 ),
            },
        } )

        // Click a cluster → zoom to its expansion zoom.
        spec._smk_onAdd = function ( map: any ) {
            function onClick( e: any ) {
                const features = map.queryRenderedFeatures( e.point, { layers: [ clusterId ] } )
                const f = features && features[ 0 ]
                if ( !f ) return
                const src = map.getSource( id )
                if ( !src || !src.getClusterExpansionZoom ) return
                src.getClusterExpansionZoom( f.properties.cluster_id ).then( ( zoom: number ) => {
                    map.easeTo( { center: f.geometry.coordinates, zoom } )
                } ).catch( () => { /* ignore */ } )
            }
            map.on( 'click', clusterId, onClick )
            map.on( 'mouseenter', clusterId, () => { map.getCanvas().style.cursor = 'pointer' } )
            map.on( 'mouseleave', clusterId, () => { map.getCanvas().style.cursor = '' } )
            return function () {
                map.off( 'click', clusterId, onClick )
            }
        }
    } else {
        spec.layers.push( {
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
        } )
    }

    // ------------------------------------------------------------------
    // Heatmap — alternative way to handle dense/overlapping point data.
    //
    // cfg.heatmap may be:
    //   - true                 → enable with sensible defaults
    //   - { ... }              → overrides:
    //       weight     : number | maplibre expression       (default 1)
    //       weightField: string                              (use a feature
    //                                                          property as weight)
    //       intensity  : number | [zoom→value] stops         (default 1→3)
    //       radius     : number | [zoom→value] stops         (default 8→30)
    //       opacity    : number | [zoom→value] stops         (default 1, fades
    //                                                          out at maxZoom)
    //       colorRamp  : array of [t, color] pairs (t in 0..1) — palette for
    //                    heatmap-density. Default is the MapLibre example ramp.
    //       maxZoom    : number — above this, heatmap fades and points show.
    //       minZoom    : number — heatmap appears at this zoom and below.
    //       showPoints : boolean — also render the underlying points above
    //                     `maxZoom` (default true).
    //
    // Heatmap and cluster are independent; cluster always wins for the
    // unclustered points layer (since the source is clustered).
    // ------------------------------------------------------------------
    const heatCfg: any = ( cfg.heatmap === true )
        ? {}
        : ( cfg.heatmap && typeof cfg.heatmap === 'object' ? cfg.heatmap : null )

    if ( heatCfg ) {
        const heatId   = id + '_heat'
        const heatMin  = heatCfg.minZoom != null ? heatCfg.minZoom : 0
        const heatMax  = heatCfg.maxZoom != null ? heatCfg.maxZoom : 15

        const weightExpr: any = heatCfg.weight != null
            ? heatCfg.weight
            : ( heatCfg.weightField
                ? [ 'coalesce', [ 'to-number', [ 'get', heatCfg.weightField ] ], 0 ]
                : 1 )

        const ramp: any[] = Array.isArray( heatCfg.colorRamp ) && heatCfg.colorRamp.length
            ? heatCfg.colorRamp
            : [
                [ 0,    'rgba(33,102,172,0)' ],
                [ 0.2,  'rgb(103,169,207)' ],
                [ 0.4,  'rgb(209,229,240)' ],
                [ 0.6,  'rgb(253,219,199)' ],
                [ 0.8,  'rgb(239,138,98)' ],
                [ 1,    'rgb(178,24,43)' ],
            ]
        const colorExpr: any[] = [ 'interpolate', [ 'linear' ], [ 'heatmap-density' ] ]
        ramp.forEach( ( s: any ) => {
            const t = Array.isArray( s ) ? s[ 0 ] : s.t
            const c = Array.isArray( s ) ? s[ 1 ] : s.color
            colorExpr.push( t, c )
        } )

        function zoomStops( v: any, lo: any, hi: any ) {
            if ( v == null ) return [ 'interpolate', [ 'linear' ], [ 'zoom' ], heatMin, lo, heatMax, hi ]
            if ( Array.isArray( v ) ) {
                const out: any[] = [ 'interpolate', [ 'linear' ], [ 'zoom' ] ]
                v.forEach( ( s: any ) => { out.push( s[ 0 ], s[ 1 ] ) } )
                return out
            }
            return v
        }

        spec.layers.push( {
            id:     heatId,
            type:   'heatmap',
            source: id,
            filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'Point', 'MultiPoint' ] ] ],
            maxzoom: heatMax + ( heatCfg.showPoints === false ? 24 : 1 ),
            minzoom: heatMin,
            paint: {
                'heatmap-weight':    weightExpr,
                'heatmap-intensity': zoomStops( heatCfg.intensity, 1, 3 ),
                'heatmap-radius':    zoomStops( heatCfg.radius,    8, 30 ),
                'heatmap-color':     colorExpr,
                'heatmap-opacity':   heatCfg.opacity != null
                    ? heatCfg.opacity
                    : [ 'interpolate', [ 'linear' ], [ 'zoom' ], heatMax - 1, opacity, heatMax + 1, 0 ],
            },
        } )
    }

    if ( labelTemplate ) {
        const placement = labelCfg.placement === 'line' || labelCfg.placement === 'line-center'
            ? labelCfg.placement
            : 'point'

        const symbolLayer: any = {
            id:     labelId,
            type:   'symbol',
            source: id,
            // When clustering, hide labels on the cluster aggregate features.
            ...( clusterCfg ? { filter: [ '!', [ 'has', 'point_count' ] ] } : {} ),
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
    // added to the map. We always stash the latest data on `spec.source.data`
    // so that if the layer is hidden (source removed) and later re-shown,
    // `addViewerLayer` recreates the source pre-populated — no waiting for
    // the next provider tick to repaint.
    // ------------------------------------------------------------------

    const layerCfg: any = layers[ 0 ]

    layerCfg.loadLayer = function ( data: any ) {
        const labelled = applyLabels( data ) || EMPTY
        spec.source.data = labelled
        layerCfg.loadCache = labelled
        const src = self.map && self.map.getSource && self.map.getSource( id )
        if ( src ) src.setData( labelled )
    }

    layerCfg.clearLayer = function () {
        spec.source.data = EMPTY
        layerCfg.loadCache = null
        const src = self.map && self.map.getSource && self.map.getSource( id )
        if ( src ) src.setData( EMPTY )
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
