/**
 * layer-esri-feature-leaflet — Leaflet ESRI feature layer.
 * Converted from layer-esri-feature-leaflet.js.
 */

declare const L: any

import { EsriFeatureLayer } from '../../layer/layer-types'
import { Layer }            from '../../layer/layer'

export class EsriFeatureLeafletLayer extends EsriFeatureLayer {}

;( Layer as any )[ 'esri-feature' ][ 'leaflet' ] = EsriFeatureLeafletLayer

// ---------------------------------------------------------------------------

;( EsriFeatureLeafletLayer as any ).create = function ( layers: any[], zIndex: number ) {
    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )

    const cfg: any = { url: layers[ 0 ].config.serviceUrl }

    if ( layers[ 0 ].config.scaleMin )
        cfg.minZoom = this.getZoomBracketForScale( layers[ 0 ].config.scaleMin )[ 1 ]

    if ( layers[ 0 ].config.scaleMax )
        cfg.maxZoom = this.getZoomBracketForScale( layers[ 0 ].config.scaleMax )[ 1 ]

    if ( layers[ 0 ].config.where )
        cfg.where = layers[ 0 ].config.where

    if ( layers[ 0 ].config.drawingInfo ) {
        cfg.drawingInfo = layers[ 0 ].config.drawingInfo
        if ( cfg.drawingInfo.renderer?.symbol?.url )
            cfg.drawingInfo.renderer.symbol.url = ( new URL(
                cfg.drawingInfo.renderer.symbol.url, document.location as any
            ) ).toString()
    }

    const layer = L.esri.featureLayer( cfg )

    if ( layers[ 0 ].legendCacheResolve ) {
        layer.legend( function ( err: any, leg: any ) {
            layers[ 0 ].legendCacheResolve( err ? null : leg.layers[ 0 ].legend )
            layers[ 0 ].legendCacheResolve = null
        } )
    }

    layer.on( 'load', () => {
        if ( layer._currentImage ) layer._currentImage.setZIndex( zIndex )
        layers[ 0 ].loading = false
    } )
    layer.on( 'loading', () => { layers[ 0 ].loading = true } )

    return layer
}

export default EsriFeatureLeafletLayer
