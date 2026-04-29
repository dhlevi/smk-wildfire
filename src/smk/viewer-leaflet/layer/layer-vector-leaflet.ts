/**
 * layer-vector-leaflet — Leaflet-specific vector layer implementation.
 * Converted from layer-vector-leaflet.js (include.module -> ES module).
 */

declare const L:    any
declare const turf: any

import { VectorLayer }                          from '../../layer/layer-types'
import { Layer }                                from '../../layer/layer'
import { resolved, getProjection, makePromise } from '../../util'

export class VectorLeafletLayer extends VectorLayer {}

;( Layer as any )[ 'vector' ][ 'leaflet' ] = VectorLeafletLayer

// ---------------------------------------------------------------------------

VectorLeafletLayer.prototype.getFeaturesInArea = function ( area: any, _view: any, option: any ) {
    if ( !option.layer ) return

    const features: any[] = []

    option.layer.eachLayer( function ( ly: any ) {
        const ft = ly.toGeoJSON()

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
            if ( turf.booleanCrosses( area, ft ) ) features.push( ft )
            break
        case 'MultiLineString': {
            const cross = turf.segmentReduce( ft, ( a: boolean, seg: any ) =>
                a || turf.booleanCrosses( area, seg ), false )
            if ( cross ) features.push( ft )
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
            console.warn( 'skip', ft.geometry.type )
        }
    } )

    return features
}

VectorLeafletLayer.prototype.getFeaturesAtPoint = function ( location: any, view: any, option: any ) {
    if ( !option.layer ) return

    const features: any[] = []
    const test = [ location.map.longitude, location.map.latitude ]
    const toleranceKm = option.tolerance * view.metersPerPixel / 1000

    option.layer.eachLayer( function ( ly: any ) {
        const ft = ly.toGeoJSON()

        switch ( ft.geometry.type ) {
        case 'Polygon':
        case 'MultiPolygon':
            if ( turf.booleanPointInPolygon( test, ft ) ) features.push( ft )
            break
        case 'LineString':
        case 'MultiLineString': {
            const close = turf.segmentReduce( ft, ( a: boolean, seg: any ) =>
                a || turf.pointToLineDistance( test, seg ) < toleranceKm, false )
            if ( close ) features.push( ft )
            break
        }
        case 'Point':
        case 'MultiPoint': {
            const close = turf.coordReduce( ft, ( a: boolean, c: any ) =>
                a || turf.distance( c, test ) < toleranceKm, false )
            if ( close ) features.push( ft )
            break
        }
        default:
            console.warn( 'skip', ft.geometry.type )
        }
    } )

    return features
}

VectorLeafletLayer.prototype.getConfig = function ( leafLayer: any ) {
    const cfg = JSON.parse( JSON.stringify(
        VectorLayer.prototype.getConfig.call( this )
    ) )

    if ( cfg.isInternal && leafLayer ) {
        const geojson = leafLayer.toGeoJSON()
        if ( geojson ) {
            cfg.dataUrl    = 'data:application/json,' + JSON.stringify( geojson )
            cfg.isInternal = false
        }
    }

    return cfg
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

;( VectorLeafletLayer as any ).create = function ( layers: any[], zIndex: number ) {
    const self = this

    if ( layers.length !== 1 )                                                  throw new Error( 'only 1 config allowed' )
    if ( ( layers[ 0 ].useClustering + layers[ 0 ].useHeatmap + layers[ 0 ].useRaw ) > 1 )
        throw new Error( 'raw or heatmap or clustering' )

    const styles = [].concat( layers[ 0 ].config.style )

    // ------------------------------------------------------------------
    // Label config — same schema as the MapLibre vector adapter.
    //   "label": "NAME"                              shorthand
    //   "label": { "field": "NAME" }
    //   "label": { "format": "{NAME} ({STATUS})", color, size, ... }
    // Renders as a permanent Leaflet tooltip per feature.
    // ------------------------------------------------------------------

    const labelCfg: any = ( typeof layers[ 0 ].config.label === 'string' )
        ? { field: layers[ 0 ].config.label }
        : ( layers[ 0 ].config.label && typeof layers[ 0 ].config.label === 'object'
              ? layers[ 0 ].config.label
              : null )

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

    function bindFeatureLabel( feature: any, leafLayer: any ) {
        if ( !labelTemplate || !leafLayer || !leafLayer.bindTooltip ) return
        const text = formatLabel( feature && feature.properties )
        if ( !text ) return

        const opts: any = {
            permanent:   true,
            direction:   labelCfg.direction   || 'center',
            className:   labelCfg.className   || 'smk-vector-label',
            offset:      labelCfg.offset      || [ 0, 0 ],
            opacity:     labelCfg.opacity     != null ? labelCfg.opacity : 1,
            sticky:      !!labelCfg.sticky,
            interactive: false,
        }

        // Inline style override so "color" / "size" / "haloColor" work
        // without requiring users to write CSS.
        const style: string[] = []
        if ( labelCfg.color )     style.push( 'color: ' + labelCfg.color )
        if ( labelCfg.size )      style.push( 'font-size: ' + labelCfg.size + 'px' )
        if ( labelCfg.haloColor ) {
            const hw = labelCfg.haloWidth != null ? labelCfg.haloWidth : 1.5
            const sh = `0 0 ${ hw }px ${ labelCfg.haloColor }, 0 0 ${ hw }px ${ labelCfg.haloColor }, 0 0 ${ hw }px ${ labelCfg.haloColor }`
            style.push( 'text-shadow: ' + sh )
        }

        const html = style.length
            ? '<span style="' + style.join( ';' ) + '">' + escapeHtml( text ) + '</span>'
            : escapeHtml( text )

        leafLayer.bindTooltip( html, opts )
    }

    return resolved()
        .then( function () {
            if ( !layers[ 0 ].config.projection )
                return L.GeoJSON.coordsToLatLng

            return getProjection( layers[ 0 ].config.projection )
                .then( function ( projection: Function ) {
                    return function ( pt: any ) {
                        const projected = projection( pt )
                        return L.latLng( projected[ 1 ], projected[ 0 ] )
                    }
                } )
        } )
        .then( function ( projectCoord: Function ) {
            const layer = new L.geoJson( null, {
                coordsToLatLng: projectCoord,
                pointToLayer: function ( geojson: any, latlng: any ) {
                    return markerForStyle( self, latlng, styles[ 0 ], layers[ 0 ].config )
                        .on( 'moveend', function ( ev: any ) {
                            const ll = ev.target.getLatLng()
                            layers[ 0 ].changedFeature( {
                                newPt:   { latitude: ll.lat, longitude: ll.lng },
                                geojson,
                            } )
                        } )
                },
                onEachFeature: function ( feature: any, layer: any ) {
                    if ( layer.setStyle )
                        layer.setStyle( convertStyle( feature.style, feature.geometry.type ) )
                    bindFeatureLabel( feature, layer )
                },
                renderer:    L.svg(),
                interactive: false,
            } )

            if ( layers[ 0 ].config.tooltip ) {
                layer.bindTooltip(
                    layers[ 0 ].config.tooltip.title,
                    Object.assign( { permanent: true }, layers[ 0 ].config.tooltip.option )
                )
            }

            layer.on( {
                add: function () {
                    if ( layer.options.renderer._container )
                        layer.options.renderer._container.style.zIndex = zIndex
                },
            } )

            if ( !layers[ 0 ].config.CRS )
                layers[ 0 ].config.CRS = 'EPSG4326'

            layers[ 0 ].loadLayer = function ( data: any ) {
                turf.featureEach( data, function ( ft: any ) {
                    styles.forEach( function ( st: any, i: number ) {
                        if ( i > 0 ) ft = turf.clone( ft )
                        ft.style = st
                        layer.addData( ft )
                    } )
                } )
            }

            if ( layers[ 0 ].loadCache ) {
                layers[ 0 ].loadLayer( layers[ 0 ].loadCache )
                layers[ 0 ].loadCache = null
            }

            layers[ 0 ].clearLayer = function () {
                layer.clearLayers()
            }

            if ( layers[ 0 ].config.isInternal ) return layer

            const url = self.resolveAttachmentUrl( layers[ 0 ].config.dataUrl, layers[ 0 ].config.id, 'json' )

            return fetch( url )
                .then( function ( r: Response ) {
                    if ( !r.ok ) throw new Error( 'Failed requesting ' + url + ': ' + r.status )
                    return r.json()
                } )
            .then( function ( data: any ) {
                console.log( 'loaded', url )

                const feats: any[] = []
                turf.featureEach( data, function ( ft: any ) {
                    styles.forEach( function ( st: any, i: number ) {
                        if ( i > 0 ) ft = turf.clone( ft )
                        ft.style = st
                        feats.push( ft )
                    } )
                } )

                layer.addData( turf.featureCollection( feats ) )
                return layer
            } )
            .then( function ( layer: any ) {
                if ( !layers[ 0 ].config.useClustering ) return layer

                const cluster = L.markerClusterGroup( clusterOptions( layers[ 0 ].config, self ) )
                cluster.addLayers( [ layer ] )
                return cluster
            } )
            .then( function ( layer: any ) {
                if ( !layers[ 0 ].config.useHeatmap ) return layer

                const points: any[] = []
                layer.eachLayer( function ( ly: any ) {
                    const centroid = turf.centroid( ly.feature.geometry )
                    points.push( [ centroid.geometry.coordinates[ 1 ], centroid.geometry.coordinates[ 0 ], 100 ] )
                } )

                return L.heatLayer( points, { radius: 25 } )
            } )
        } )
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function convertStyle( styleConfig: any, type: string ) {
    if ( !styleConfig ) return {}

    if ( type === 'Point' || type === 'MultiPoint' ) {
        return {
            radius:      styleConfig.strokeWidth / 2,
            color:       styleConfig.strokeColor,
            weight:      2,
            opacity:     styleConfig.strokeOpacity,
            fillColor:   styleConfig.fillColor,
            fillOpacity: styleConfig.fillOpacity,
            stroke:      styleConfig.stroke !== false,
            fill:        styleConfig.fill,
        }
    } else {
        return {
            stroke:      styleConfig.stroke !== false,
            color:       styleConfig.strokeColor,
            weight:      styleConfig.strokeWidth || 0,
            opacity:     styleConfig.strokeOpacity,
            lineCap:     styleConfig.strokeCap,
            lineJoin:    styleConfig.strokeJoin,
            dashArray:   styleConfig.strokeDashes,
            dashOffset:  styleConfig.strokeDashOffset,
            fill:        styleConfig.fill,
            fillColor:   styleConfig.fillColor,
            fillOpacity: styleConfig.fillOpacity,
        }
    }
}

function escapeHtml( s: string ): string {
    return String( s )
        .replace( /&/g, '&amp;' )
        .replace( /</g, '&lt;' )
        .replace( />/g, '&gt;' )
        .replace( /"/g, '&quot;' )
        .replace( /'/g, '&#39;' )
}

function markerForStyle( viewer: any, latlng: any, styleConfig: any, layerConfig: any ) {
    if ( styleConfig && styleConfig.markerUrl ) {
        return L.marker( latlng, {
            icon: L.icon( {
                iconUrl:     viewer.resolveAttachmentUrl( styleConfig.markerUrl, null, 'png' ),
                shadowUrl:   viewer.resolveAttachmentUrl( styleConfig.shadowUrl, null, 'png', false ),
                iconSize:    styleConfig.markerSize,
                iconAnchor:  styleConfig.markerOffset,
                popupAnchor: styleConfig.popupOffset,
                shadowSize:  styleConfig.shadowSize,
            } ),
            interactive: !!layerConfig.isDraggable,
            draggable:   !!layerConfig.isDraggable,
        } )
    } else {
        return L.circleMarker( latlng, { interactive: false } )
    }
}

function clusterOptions( layerConfig: any, viewer: any ) {
    const opt: any = viewer.clusterOption || {}

    if ( layerConfig.clusterStyle ) {
        opt.iconCreateFunction = function ( cluster: any ) {
            const wrap = document.createElement( 'div' )
            const img  = document.createElement( 'img' )
            img.src    = viewer.resolveAttachmentUrl( layerConfig.clusterStyle.markerUrl, null, 'png' )
            wrap.appendChild( img )
            const span = document.createElement( 'span' )
            span.textContent = String( cluster.getChildCount() )
            wrap.appendChild( span )
            const html = wrap.innerHTML

            return L.divIcon( {
                className: 'smk-cluster-icon',
                html,
                iconSize:   layerConfig.clusterStyle.markerSize,
                iconAnchor: layerConfig.clusterStyle.markerOffset,
            } )
        }
    }

    return opt
}

export default VectorLeafletLayer
