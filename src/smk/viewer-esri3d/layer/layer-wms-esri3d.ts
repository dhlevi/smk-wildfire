/**
 * layer-wms-esri3d — WMS layer for ESRI 3D viewer.
 * Converted from viewer-esri3d/layer/layer-wms-esri3d.js.
 */

import { WmsLayer } from '../../layer/layer-types'
import { SMK } from '../../smk-ref'

const smkRef = SMK

class WmsEsri3dLayer extends WmsLayer {}

smkRef.TYPE.Layer[ 'wms' ][ 'esri3d' ] = WmsEsri3dLayer

;( WmsEsri3dLayer as any ).create = function ( layers: any[], _zIndex: number ) {
    const E = smkRef.TYPE.Esri3d

    const serviceUrl = layers[ 0 ].config.serviceUrl
    const opacity    = layers[ 0 ].config.opacity
    const where      = layers.map( ( c: any ) => c.config.where || 'include' ).join( ';' )

    const WMSLayerSubclass = E.layers.BaseDynamicLayer.createSubclass( {
        properties: {
            serviceUrl:  null,
            layerNames:  [],
            styleNames:  [],
            cqlFilter:   null,
        },

        getImageUrl( extent: any, width: number, height: number ) {
            const epsg = extent.spatialReference.isWebMercator ? 3857 : extent.spatialReference.wkid
            const param: Record<string, any> = {
                service:     'WMS',
                request:     'GetMap',
                version:     '1.1.1',
                layers:      ( this as any ).layerNames.join( ',' ),
                styles:      ( this as any ).styleNames.join( ',' ),
                format:      'image/png',
                transparent: 'true',
                srs:         'EPSG:' + epsg,
                width,
                height,
                bbox:        [ extent.xmin, extent.ymin, extent.xmax, extent.ymax ].join( ',' ),
            }

            if ( ( this as any ).cqlFilter ) param.cql_filter = ( this as any ).cqlFilter

            return ( this as any ).serviceUrl + '?' + Object.keys( param ).map( p => p + '=' + encodeURIComponent( param[ p ] ) ).join( '&' )
        },
    } )

    const layer = new WMSLayerSubclass( {
        serviceUrl,
        layerNames: layers.map( ( c: any ) => c.config.layerName ),
        styleNames: layers.map( ( c: any ) => c.config.styleName ),
        opacity,
        cqlFilter:  where,
    } )

    layer.on( 'layerview-create', function ( ev: any ) {
        E.core.watchUtils.watch( ev.layerView, 'updating', function ( val: any ) {
            layers.forEach( ( ly: any ) => { ly.loading = val } )
        } )
    } )

    return layer
}

export default WmsEsri3dLayer
