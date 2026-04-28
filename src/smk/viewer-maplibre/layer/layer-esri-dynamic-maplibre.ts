/**
 * layer-esri-dynamic-maplibre — MapLibre Esri dynamic (export) map adapter.
 * Renders the ExportMap REST endpoint as a MapLibre raster source.  Each
 * tile request is a separate ExportMap call sized to the tile envelope.
 */

import { EsriDynamicLayer } from '../../layer/layer-types'
import { Layer }            from '../../layer/layer'

export class EsriDynamicMapLibreLayer extends EsriDynamicLayer {}

;( Layer as any )[ 'esri-dynamic' ][ 'maplibre' ] = EsriDynamicMapLibreLayer

;( EsriDynamicMapLibreLayer as any ).create = function ( layers: any[], _zIndex: number ) {
    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )
    const cfg = layers[ 0 ].config

    const base = ( cfg.serviceUrl || '' ).replace( /\/$/, '' )

    const params: string[] = [
        'bbox={bbox-epsg-3857}',
        'bboxSR=3857',
        'imageSR=3857',
        'size=256,256',
        'format=png32',
        'transparent=true',
        'f=image',
    ]

    if ( cfg.dynamicLayers ) {
        const dl = cfg.dynamicLayers.map( ( s: string ) => JSON.parse( s ) )
        params.push( 'dynamicLayers=' + encodeURIComponent( JSON.stringify( dl ) ) )
    }

    const tileUrl = base + '/export?' + params.join( '&' )
    const id      = '_smk_esri_dyn_' + cfg.id
    const opacity = cfg.opacity != null ? cfg.opacity : 1

    return Promise.resolve( {
        sourceId: id,
        source: {
            type:        'raster',
            tiles:       [ tileUrl ],
            tileSize:    256,
            attribution: cfg.attribution || '',
        },
        layer: {
            id,
            type:   'raster',
            source: id,
            paint:  { 'raster-opacity': opacity },
        },
    } )
}

export default EsriDynamicMapLibreLayer
