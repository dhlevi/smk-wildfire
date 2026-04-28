/**
 * layer-esri-feature-maplibre — MapLibre Esri feature layer adapter.
 *
 * Fetches features from the Esri REST query endpoint as GeoJSON and
 * renders them as MapLibre fill / line / circle layers off a single
 * GeoJSON source.  This is a simple "load once" implementation; viewport
 * refetching is not yet implemented.
 */

import { EsriFeatureLayer } from '../../layer/layer-types'
import { Layer }            from '../../layer/layer'

export class EsriFeatureMapLibreLayer extends EsriFeatureLayer {}

;( Layer as any )[ 'esri-feature' ][ 'maplibre' ] = EsriFeatureMapLibreLayer

;( EsriFeatureMapLibreLayer as any ).create = function ( layers: any[], _zIndex: number ) {
    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )
    const cfg = layers[ 0 ].config

    const base    = ( cfg.serviceUrl || '' ).replace( /\/$/, '' )
    const where   = encodeURIComponent( cfg.where || '1=1' )
    const queryUrl = base + '/query?where=' + where + '&outFields=*&outSR=4326&f=geojson'

    const id      = '_smk_esri_ft_' + cfg.id
    const opacity = cfg.opacity != null ? cfg.opacity : 1

    return fetch( queryUrl )
        .then( r => r.ok ? r.json() : Promise.reject( new Error( 'esri-feature query failed: ' + r.status ) ) )
        .then( ( geojson: any ) => {
            const fillId   = id + '_fill'
            const lineId   = id + '_line'
            const circleId = id + '_circle'

            return {
                sourceId: id,
                source:   { type: 'geojson', data: geojson || { type: 'FeatureCollection', features: [] } },
                layers: [
                    {
                        id:     fillId,
                        type:   'fill',
                        source: id,
                        filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'Polygon', 'MultiPolygon' ] ] ],
                        paint:  { 'fill-color': '#3388ff', 'fill-opacity': 0.3 * opacity, 'fill-outline-color': '#3388ff' },
                    },
                    {
                        id:     lineId,
                        type:   'line',
                        source: id,
                        filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon' ] ] ],
                        paint:  { 'line-color': '#3388ff', 'line-width': 2, 'line-opacity': opacity },
                    },
                    {
                        id:     circleId,
                        type:   'circle',
                        source: id,
                        filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'Point', 'MultiPoint' ] ] ],
                        paint:  {
                            'circle-radius':       5,
                            'circle-color':        '#3388ff',
                            'circle-opacity':      opacity,
                            'circle-stroke-color': '#ffffff',
                            'circle-stroke-width': 1,
                        },
                    },
                ],
            }
        } )
        .catch( ( e ) => {
            console.warn( 'esri-feature maplibre layer "' + cfg.id + '" failed:', e )
            // Return an empty source so addViewerLayer is a no-op
            return {
                sourceId: id,
                source:   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
                layers:   [],
            }
        } )
}

export default EsriFeatureMapLibreLayer
