/**
 * layer-cluster-esri3d — Cluster layer for ESRI 3D viewer.
 * Converted from viewer-esri3d/layer/layer-cluster-esri3d.js.
 */

declare const $: any

import { ClusterLayer } from '../../layer/layer-types'

declare const $: any

const smkRef = ( window as any ).SMK

class ClusterEsri3dLayer extends ClusterLayer {}

smkRef.TYPE.Layer[ 'cluster' ][ 'esri3d' ] = ClusterEsri3dLayer

ClusterEsri3dLayer.prototype.getFeaturesInArea = function ( _area: any, _view: any, _option: any ) {}

;( ClusterEsri3dLayer as any ).create = function ( this: any, layers: any[], _zIndex: number ) {
    const self = this
    const E    = smkRef.TYPE.Esri3d

    if ( layers.length !== 1 ) throw new Error( 'only 1 config allowed' )

    return smkRef.UTIL.resolved()
        .then( function () {
            const renderer = new E.renderers.ClassBreaksRenderer()
            renderer.field = 'clusterCount'

            const symbol = new E.symbols.SimpleMarkerSymbol( {
                size:    22,
                color:   '#fabf4f',
                style:   'square',
                outline: { width: 0 },
            } )
            renderer.addClassBreakInfo( 0, Infinity, symbol )

            const flareRenderer = new E.renderers.ClassBreaksRenderer()
            flareRenderer.field = 'clusterCount'

            const flareSymbol = new E.symbols.SimpleMarkerSymbol( {
                size:    11,
                color:   '#fabf4f',
                style:   'square',
                outline: { width: 0, color: '#fabf4f' },
            } )
            flareRenderer.addClassBreakInfo( 0, Infinity, flareSymbol )

            const layer = new E.fcl.FlareClusterLayer_v4.FlareClusterLayer( {
                clusterToScale:         10,
                clusterRenderer:        renderer,
                textSymbol: new E.symbols.TextSymbol( {
                    color:     'white',
                    haloColor: 'black',
                    haloSize:  1,
                    font:      { size: 13 },
                } ),
                flareTextSymbol: new E.symbols.TextSymbol( {
                    color: 'black',
                    font:  { size: 10 },
                } ),
                flareRenderer,
                spatialReference:        { wkid: 4326 },
                displayFlares:           false,
                displaySubTypeFlares:    false,
                subTypeFlareProperty:    'STAGE_OF_CONTROL_DESC',
                singleFlareTooltipProperty: 'INCIDENT_NUMBER_LABEL',
                maxSingleFlareCount:     8,
                clusterRatio:            75,
                symbolPropertyName:      'symbols',
            } )

            self.eachLayer( function ( _id: string, ly: any ) {
                if ( ly.config.clusterId === layers[ 0 ].config.id ) {
                    ly.finishedLoading( function () {
                        layer.filterData( ( ft: any ) => ft.layerId !== ly.id )
                        layer.addData( ly.getData() )
                    } )

                    if ( ly.getData ) {
                        layer.filterData( ( ft: any ) => ft.layerId !== ly.id )
                        layer.addData( ly.getData() )
                    }
                }
            } )

            return layer
        } )
}

export default ClusterEsri3dLayer
