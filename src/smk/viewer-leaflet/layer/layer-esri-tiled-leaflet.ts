/**
 * layer-esri-tiled-leaflet — Leaflet ESRI tiled map layer.
 * Converted from layer-esri-tiled-leaflet.js.
 */

declare const L: any

const smkRef = ( window as any ).SMK

export function EsriTiledLeafletLayer( this: any ): void {
    smkRef.TYPE.Layer[ 'esri-tiled' ].prototype.constructor.apply( this, arguments )
}
Object.assign( EsriTiledLeafletLayer.prototype, smkRef.TYPE.Layer[ 'esri-tiled' ].prototype )

smkRef.TYPE.Layer[ 'esri-tiled' ][ 'leaflet' ] = EsriTiledLeafletLayer

// ---------------------------------------------------------------------------

;( smkRef.TYPE.Layer[ 'esri-tiled' ][ 'leaflet' ] as any ).create = function ( layers: any[], zIndex: number ) {
    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )

    const serviceUrl = layers[ 0 ].config.serviceUrl

    let minZoom: number | undefined
    if ( layers[ 0 ].config.minScale )
        minZoom = this.getZoomBracketForScale( layers[ 0 ].config.minScale )[ 1 ]

    let maxZoom: number | undefined
    if ( layers[ 0 ].config.maxScale )
        maxZoom = this.getZoomBracketForScale( layers[ 0 ].config.maxScale )[ 1 ]

    const layer = L.esri.tiledMapLayer( { url: serviceUrl, minZoom, maxZoom } )

    layer.on( 'load', () => {
        if ( layer._currentImage ) layer._currentImage.setZIndex( zIndex )
        layers[ 0 ].loading = false
    } )
    layer.on( 'loading', () => { layers[ 0 ].loading = true } )

    return layer
}

export default EsriTiledLeafletLayer
