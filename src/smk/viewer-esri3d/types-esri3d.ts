/**
 * types-esri3d — Load ArcGIS JS API 4.x modules into SMK.TYPE.Esri3d.
 * Converted from types-esri3d.js (include.module -> ES module).
 *
 * This module relies on Dojo's AMD `require()` injected by the ArcGIS JS API.
 */

declare const require: ( modules: string[], callback: ( ...args: any[] ) => void ) => void

const smkRef = ( window as any ).SMK

const objs = [
    'esri/config',
    'esri/request',
    'esri/Map',
    'esri/views/SceneView',
    'esri/views/ui/3d/DefaultUI3D',
    'esri/views/ui/UI',
    'esri/core/watchUtils',
    'esri/Camera',
    'esri/widgets/NavigationToggle',
    'esri/widgets/NavigationToggle/NavigationToggleViewModel',
    'esri/widgets/Compass',
    'esri/widgets/Compass/CompassViewModel',
    'esri/widgets/Zoom',
    'esri/widgets/Zoom/ZoomViewModel',
    'esri/widgets/DirectLineMeasurement3D',
    'esri/widgets/AreaMeasurement3D',
    'esri/layers/MapImageLayer',
    'esri/layers/WMSLayer',
    'esri/layers/BaseDynamicLayer',
    'esri/layers/GraphicsLayer',
    'esri/renderers/ClassBreaksRenderer',
    'esri/Graphic',
    'esri/Color',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/TextSymbol',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    'esri/geometry/Polygon',
    'esri/geometry/Extent',
    'esri/geometry/SpatialReference',
    'esri/geometry/geometryEngine',
    'esri/geometry/support/webMercatorUtils',
    'fcl/FlareClusterLayer_v4',
]

export const Esri3dReady: Promise<any> = new Promise( function ( res, rej ) {
    smkRef.TYPE.Esri3d = {}

    // Dojo AMD require is only available when ArcGIS JS API 4.x is loaded.
    if ( typeof require !== 'function' ) {
        console.warn( 'SMK: types-esri3d: Dojo require not available — ESRI 3D viewer disabled' )
        return res( smkRef.TYPE.Esri3d )
    }

    require( objs, function ( ...args: any[] ) {
        objs.forEach( function ( o, i ) {
            const parts      = o.replace( 'esri/', '' ).split( '/' )
            let   container  = smkRef.TYPE.Esri3d

            for ( let j = 0; j < parts.length - 1; j++ ) {
                if ( !( parts[ j ] in container ) ) container[ parts[ j ] ] = {}
                container = container[ parts[ j ] ]
            }

            container[ parts[ parts.length - 1 ] ] = args[ i ]
        } )

        res( smkRef.TYPE.Esri3d )
    } )
} )

export default Esri3dReady
