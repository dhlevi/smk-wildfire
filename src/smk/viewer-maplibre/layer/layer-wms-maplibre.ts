/**
 * layer-wms-maplibre — MapLibre WMS layer adapter.
 *
 * MapLibre has no native WMS layer; we use a `raster` source whose tile URL
 * is a WMS GetMap request that includes `{bbox-epsg-3857}` — MapLibre will
 * substitute that with the EPSG:3857 envelope of each requested tile.
 */

import { WmsLayer } from '../../layer/layer-types'
import { Layer }    from '../../layer/layer'

export class WmsMapLibreLayer extends WmsLayer {}

;( Layer as any )[ 'wms' ][ 'maplibre' ] = WmsMapLibreLayer

;( WmsMapLibreLayer as any ).create = function ( layers: any[], _zIndex: number ) {
    return resolveSLD( layers[ 0 ].config.sld ).then( function ( sldBody ) {
        const cfg0 = layers[ 0 ].config

        const layerNames = layers.map( ( c: any ) => c.config.layerName ).reverse().join( ',' )
        const styleNames = layers.map( ( c: any ) => c.config.styleName ).reverse().join( ',' )
        const version    = cfg0.version || '1.1.1'
        const transparent = cfg0.transparent == null ? true : !!cfg0.transparent

        // WMS 1.3.0 uses CRS=, 1.1.x uses SRS=
        const crsParam = ( /^1\.3/.test( version ) ? 'crs' : 'srs' ) + '=EPSG%3A3857'

        const params: string[] = [
            'service=WMS',
            'request=GetMap',
            'version='     + encodeURIComponent( version ),
            'layers='      + encodeURIComponent( layerNames ),
            crsParam,
            'bbox={bbox-epsg-3857}',
            'width=256',
            'height=256',
            'format=image%2Fpng',
            'transparent=' + ( transparent ? 'true' : 'false' ),
        ]

        if ( sldBody ) {
            params.push( 'sld_body=' + encodeURIComponent( sldBody ) )
        } else if ( styleNames ) {
            params.push( 'styles=' + encodeURIComponent( styleNames ) )
        }

        // Optional CQL filter
        const where = layers.map( ( c: any ) => c.config.where || 'include' ).reverse().join( ';' )
        if ( where && where !== 'include' ) {
            params.push( 'cql_filter=' + encodeURIComponent( where ) )
        }

        const sep    = cfg0.serviceUrl.indexOf( '?' ) >= 0 ? '&' : '?'
        const tileUrl = cfg0.serviceUrl + sep + params.join( '&' )

        const id = '_smk_wms_' + cfg0.id

        const opacity = cfg0.opacity != null ? cfg0.opacity : 1

        return {
            sourceId: id,
            source: {
                type:        'raster',
                tiles:       [ tileUrl ],
                tileSize:    256,
                attribution: cfg0.attribution || '',
            },
            layer: {
                id,
                type:   'raster',
                source: id,
                paint:  { 'raster-opacity': opacity },
            },
        }
    } )
}

function resolveSLD( sld: string | undefined ): Promise<string | undefined> {
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

export default WmsMapLibreLayer
