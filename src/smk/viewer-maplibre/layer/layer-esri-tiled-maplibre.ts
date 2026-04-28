/**
 * layer-esri-tiled-maplibre — MapLibre Esri tiled map layer adapter.
 * Renders an ArcGIS MapServer tile cache as a MapLibre raster source.
 */

import { EsriTiledLayer } from '../../layer/layer-types'
import { Layer }          from '../../layer/layer'

export class EsriTiledMapLibreLayer extends EsriTiledLayer {}

;( Layer as any )[ 'esri-tiled' ][ 'maplibre' ] = EsriTiledMapLibreLayer

;( EsriTiledMapLibreLayer as any ).create = function ( layers: any[], _zIndex: number ) {
    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )
    const cfg = layers[ 0 ].config

    const base    = ( cfg.serviceUrl || '' ).replace( /\/$/, '' )
    const tileUrl = base + '/tile/{z}/{y}/{x}'
    const id      = '_smk_esri_tiled_' + cfg.id
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

export default EsriTiledMapLibreLayer
