/**
 * layer-esri-dynamic-leaflet — Leaflet ESRI dynamic map layer.
 * Converted from layer-esri-dynamic-leaflet.js.
 */

declare const L: any

const smkRef = ( window as any ).SMK

export function EsriDynamicLeafletLayer( this: any ) {
    return Reflect.construct( smkRef.TYPE.Layer[ 'esri-dynamic' ], Array.from( arguments ), EsriDynamicLeafletLayer )
}
Object.setPrototypeOf( EsriDynamicLeafletLayer.prototype, smkRef.TYPE.Layer[ 'esri-dynamic' ].prototype )

smkRef.TYPE.Layer[ 'esri-dynamic' ][ 'leaflet' ] = EsriDynamicLeafletLayer

// ---------------------------------------------------------------------------

;( smkRef.TYPE.Layer[ 'esri-dynamic' ][ 'leaflet' ] as any ).create = function ( layers: any[], zIndex: number ) {
    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )

    const serviceUrl  = layers[ 0 ].config.serviceUrl
    const dynamicLayers = layers[ 0 ].config.dynamicLayers
        ? layers[ 0 ].config.dynamicLayers.map( ( dl: string ) => JSON.parse( dl ) )
        : undefined
    const opacity = layers[ 0 ].config.opacity

    let minZoom: number | undefined
    if ( layers[ 0 ].config.minScale )
        minZoom = this.getZoomBracketForScale( layers[ 0 ].config.minScale )[ 1 ]

    let maxZoom: number | undefined
    if ( layers[ 0 ].config.maxScale )
        maxZoom = this.getZoomBracketForScale( layers[ 0 ].config.maxScale )[ 1 ]

    let layer: any
    if ( dynamicLayers ) {
        layer = L.esri.dynamicMapLayer( { url: serviceUrl, opacity, dynamicLayers, maxZoom, minZoom } )
    } else {
        layer = L.esri.featureLayer( { url: serviceUrl, where: layers[ 0 ].config.where } )
    }

    layer.on( 'load', () => {
        if ( layer._currentImage ) layer._currentImage.setZIndex( zIndex )
        layers[ 0 ].loading = false
    } )
    layer.on( 'loading', () => { layers[ 0 ].loading = true } )

    return layer
}

export default EsriDynamicLeafletLayer
