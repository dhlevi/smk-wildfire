/**
 * layer-esri-dynamic-esri3d — ESRI Dynamic (MapImageLayer) for ESRI 3D viewer.
 * Converted from viewer-esri3d/layer/layer-esri-dynamic-esri3d.js.
 */

import { EsriDynamicLayer } from '../../layer/layer-types'

const smkRef = ( window as any ).SMK

class EsriDynamicEsri3dLayer extends EsriDynamicLayer {}

smkRef.TYPE.Layer[ 'esri-dynamic' ][ 'esri3d' ] = EsriDynamicEsri3dLayer

;( EsriDynamicEsri3dLayer as any ).create = function ( layers: any[], _zIndex: number ) {
    const E = smkRef.TYPE.Esri3d

    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )

    const serviceUrl    = layers[ 0 ].config.serviceUrl
    const dynamicLayers = layers[ 0 ].config.dynamicLayers.map( ( dl: string ) => JSON.parse( dl ) )
    const opacity       = layers[ 0 ].config.opacity

    const host = serviceUrl.replace( /^(\w+:)?[/][/]/, '' ).replace( /[/].*$/, '' )
    if ( E.config.request.corsEnabledServers.indexOf( host ) === -1 )
        E.config.request.corsEnabledServers.push( host )

    const DynamicMapLayer = E.layers.BaseDynamicLayer.createSubclass( {
        properties: {
            serviceUrl:    null,
            dynamicLayers: null,
        },

        getImageUrl( extent: any, width: number, height: number ) {
            const epsg = extent.spatialReference.isWebMercator ? 3857 : extent.spatialReference.wkid
            const param: Record<string, any> = {
                bbox:          [ extent.xmin, extent.ymin, extent.xmax, extent.ymax ].join( ',' ),
                size:          width + ',' + height,
                dpi:           96,
                format:        'png24',
                transparent:   true,
                bboxSR:        epsg,
                imageSR:       epsg,
                dynamicLayers: JSON.stringify( ( this as any ).dynamicLayers ),
                f:             'json',
            }

            const url = ( this as any ).serviceUrl + '/export?' + Object.keys( param ).map( p => p + '=' + encodeURIComponent( param[ p ] ) ).join( '&' )

            return E.request( url ).then( ( res: any ) => res.data.href )
        },
    } )

    const layer = DynamicMapLayer( {
        serviceUrl:     serviceUrl,
        dynamicLayers,
        opacity,
    } )

    layer.on( 'layerview-create', function ( ev: any ) {
        E.core.watchUtils.watch( ev.layerView, 'updating', function ( val: any ) {
            layers.forEach( ( ly: any ) => { ly.loading = val } )
        } )
    } )

    return layer
}

export default EsriDynamicEsri3dLayer
