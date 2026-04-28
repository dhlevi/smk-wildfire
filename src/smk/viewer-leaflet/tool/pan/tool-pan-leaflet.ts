/**
 * tool-pan-leaflet — Leaflet initializer for PanTool.
 */

import '../../../tool/pan/tool-pan'

const smkRef = ( window as any ).SMK

smkRef.TYPE.PanTool.addInitializer( function ( this: any, smk: any ) {
    if ( smk.$viewer.type !== 'leaflet' ) return

    if ( !smk.$viewer.map?.dragging ) return   // not a Leaflet viewer

    smk.$viewer.map.dragging.enable()
    this.control = false
} )
