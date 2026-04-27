/**
 * tool-pan-leaflet — Leaflet initializer for PanTool.
 */

const smkRef = ( window as any ).SMK

smkRef.TYPE.PanTool.addInitializer( function ( this: any, smk: any ) {
    smk.$viewer.map.dragging.enable()
    this.control = false
} )
