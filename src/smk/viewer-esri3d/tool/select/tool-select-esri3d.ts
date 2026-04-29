/**
 * tool-select-esri3d — Select tool initializer for ESRI 3D viewer.
 * Converted from viewer-esri3d/tool/select/tool-select-esri3d.js.
 */

import '../../../tool/select/tool-select-list'
import { SMK } from '../../../smk-ref'

const smkRef = SMK

// Patches SelectListTool (not SelectTool — that name never existed; Leaflet
// equivalent uses SelectListTool.addInitializer)
smkRef.TYPE.SelectListTool.prototype.styleFeature = function ( this: any, override: any ) {
    return Object.assign( {
        strokeColor:   'blue',
        strokeWidth:   5,
        strokeOpacity: 0.9,
        fillColor:     'white',
        fillOpacity:   0.0,
    }, this.style, override )
}
