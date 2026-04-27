/**
 * layer-vector-esri3d — Vector (GeoJSON) layer for ESRI 3D viewer.
 * Converted from viewer-esri3d/layer/layer-vector-esri3d.js.
 */

import { VectorLayer } from '../../layer/layer-types'

declare const turf: any
declare const $: any

const smkRef = ( window as any ).SMK

class VectorEsri3dLayer extends VectorLayer {}

smkRef.TYPE.Layer[ 'vector' ][ 'esri3d' ] = VectorEsri3dLayer

VectorEsri3dLayer.prototype.getFeaturesInArea = function ( area: any, _view: any, option: any ) {
    if ( !option.layer ) return []

    const features: any[] = []
    option.layer.graphics.forEach( function ( gr: any ) {
        const gm = gr.attributes._geojsonGeometry
        const ft = {
            type:       'Feature',
            properties: Object.assign( {}, gr.attributes ),
            geometry:   gm,
        }
        delete ft.properties._geojsonGeometry

        switch ( gm.type ) {
        case 'Polygon':
            if ( turf.intersect( ft, area ) ) features.push( ft )
            break
        case 'MultiPolygon': {
            const intersect = gm.coordinates.reduce( ( acc: boolean, poly: any ) =>
                acc || !!turf.intersect( turf.polygon( poly ), area ), false )
            if ( intersect ) features.push( ft )
            break
        }
        case 'LineString':
            if ( turf.booleanCrosses( area, ft ) ) features.push( ft )
            break
        case 'MultiLineString': {
            const close1 = turf.segmentReduce( ft, ( acc: boolean, seg: any ) =>
                acc || turf.booleanCrosses( area, seg ), false )
            if ( close1 ) features.push( ft )
            break
        }
        case 'Point':
        case 'MultiPoint': {
            const close2 = turf.coordReduce( ft, ( acc: boolean, coord: any ) =>
                acc || turf.booleanPointInPolygon( coord, area ), false )
            if ( close2 ) features.push( ft )
            break
        }
        default:
            console.warn( 'skip', gm.type )
        }
    } )

    return features
}

VectorEsri3dLayer.prototype.canAddToMap = function () {
    return this.config.isOnMap !== false
}

;( VectorEsri3dLayer as any ).create = function ( this: any, layers: any[], _zIndex: number ) {
    const self = this
    const E    = smkRef.TYPE.Esri3d

    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )

    const symbols = ( [] as any[] ).concat( layers[ 0 ].config.style ).reduce( ( acc: any[], st: any ) =>
        acc.concat( smkRef.UTIL.smkStyleToEsriSymbol( st, self ) ), [] )

    let layerData: any[] = []

    return smkRef.UTIL.resolved()
        .then( function () {
            if ( !layers[ 0 ].config.projection )
                return ( data: any ) => data

            return smkRef.UTIL.getProjection( layers[ 0 ].config.projection )
                .then( ( projection: any ) => ( data: any ) => smkRef.UTIL.reprojectGeoJSON( data, projection ) )
        } )
        .then( function ( reproject: ( d: any ) => any ) {
            const layer = new E.layers.GraphicsLayer()

            layers[ 0 ].loadLayer = function ( data: any ) {
                layers[ 0 ].loading = true
                try {
                    const gs = smkRef.UTIL.geoJsonToEsriGraphics( reproject( data ) )
                    layerData = layerData.concat( gs )
                    layer.addMany( smkRef.UTIL.mapSymbolsToGraphics( gs, symbols ) )
                } finally {
                    layers[ 0 ].loading = false
                }
            }

            if ( layers[ 0 ].loadCache ) {
                layers[ 0 ].loadLayer( layers[ 0 ].loadCache )
                layers[ 0 ].loadCache = null
            }

            layers[ 0 ].clearLayer = function () {
                layer.removeAll()
                layerData = []
            }

            layers[ 0 ].getData = function () {
                return layerData.map( ( g: any ) =>
                    Object.assign( {
                        x:        g.geometry.x,
                        y:        g.geometry.y,
                        symbols:  smkRef.UTIL.symbolsForGraphic( g, symbols ),
                        layerId:  layers[ 0 ].id,
                    }, g.attributes ) )
            }

            if ( layers[ 0 ].config.isInternal ) return layer

            const url = self.resolveAttachmentUrl( layers[ 0 ].config.dataUrl, layers[ 0 ].config.id, 'json' )

            return smkRef.UTIL.makePromise( function ( res: any, rej: any ) {
                $.get( url, null, null, 'json' ).then( res, function ( xhr: any, _status: any, err: any ) {
                    rej( 'Failed requesting ' + url + ': ' + xhr.status + ',' + err )
                } )
            } )
            .then( function ( data: any ) {
                layers[ 0 ].loadLayer( data )
                return layer
            } )
        } )
}

export default VectorEsri3dLayer
