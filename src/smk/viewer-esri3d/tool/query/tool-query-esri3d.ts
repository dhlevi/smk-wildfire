/**
 * tool-query-esri3d — Query tool initializer for ESRI 3D viewer.
 * Converted from viewer-esri3d/tool/query/tool-query-esri3d.js.
 */

import '../../../tool/query/tool-query-results'
import { SMK } from '../../../smk-ref'

const smkRef = SMK

// Patches QueryResultsTool (not QueryTool — that name never existed; Leaflet
// equivalent uses QueryResultsTool.addInitializer)
smkRef.TYPE.QueryResultsTool.prototype.styleFeature = function ( this: any, override: any ) {
    return Object.assign( {
        strokeColor:   'black',
        strokeWidth:   5,
        strokeOpacity: 0.9,
        fillColor:     'white',
        fillOpacity:   0.5,
    }, this.style, override )
}
