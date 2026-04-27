/**
 * layer-wms-leaflet — Leaflet WMS layer implementation.
 * Converted from layer-wms-leaflet.js.
 */

declare const L: any

import '../../../lib/leaflet/NonTiledLayer-src.js'

const smkRef = ( window as any ).SMK

export function WmsLeafletLayer( this: any ) {
    return Reflect.construct( smkRef.TYPE.Layer[ 'wms' ], Array.from( arguments ), WmsLeafletLayer )
}
Object.setPrototypeOf( WmsLeafletLayer.prototype, smkRef.TYPE.Layer[ 'wms' ].prototype )

smkRef.TYPE.Layer[ 'wms' ][ 'leaflet' ] = WmsLeafletLayer

// ---------------------------------------------------------------------------

;( smkRef.TYPE.Layer[ 'wms' ][ 'leaflet' ] as any ).create = function ( layers: any[], zIndex: number ) {
    const serviceUrl  = layers[ 0 ].config.serviceUrl
    const layerNames  = layers.map( ( c: any ) => c.config.layerName ).reverse().join( ',' )
    const styleNames  = layers.map( ( c: any ) => c.config.styleName ).reverse().join( ',' )
    const version     = layers[ 0 ].config.version || '1.1.1'
    const attribution = layers[ 0 ].config.attribution
    const opacity     = layers[ 0 ].config.opacity
    const transparent = layers[ 0 ].config.transparent
    const where       = layers.map( ( c: any ) => c.config.where || 'include' ).reverse().join( ';' )
    const header      = layers[ 0 ].config.header

    return resolveSLD( this, layers[ 0 ].config.sld ).then( function ( sld: string | undefined ) {
        let layer: any

        if ( header && Object.keys( header ).length > 0 ) {
            layer = L.nonTiledLayer.wmsFetch( serviceUrl, {
                layers:      layerNames,
                styles:      styleNames,
                version,
                attribution,
                opacity,
                format:      'image/png',
                transparent: transparent == null ? true : !!transparent,
                zIndex,
                cql_filter:  where,
                wmsHeaders:  header,
            } )
        } else {
            layer = L.nonTiledLayer.wms( serviceUrl, {
                layers:      layerNames,
                styles:      styleNames,
                version,
                attribution,
                opacity,
                format:      'image/png',
                transparent: transparent == null ? true : !!transparent,
                zIndex,
                cql_filter:  where,
            } )
        }

        if ( sld ) {
            layer.wmsParams.sld_body = sld
            delete layer.wmsParams.styles
        }

        layer.on( 'load',    () => layers.forEach( ( ly: any ) => { ly.loading = false } ) )
        layer.on( 'loading', () => layers.forEach( ( ly: any ) => { ly.loading = true  } ) )

        return layer
    } )
}

function resolveSLD( _viewer: any, sld: string | undefined ): Promise<string | undefined> {
    if ( !sld ) return Promise.resolve( undefined )

    if ( sld.startsWith( '@' ) ) {
        const url = sld.substr( 1 )
        return fetch( url )
            .then( r => {
                if ( r.status !== 200 ) throw new Error( 'fetching ' + url + ': ' + r.statusText )
                return r.text()
            } )
            .then( text => text.replace( /\s+/g, ' ' ).replace( /[>] [<]/g, '><' ) )
            .catch( err => { console.warn( err ); return undefined } )
    }

    return Promise.resolve( sld )
}

export default WmsLeafletLayer
