/**
 * tool-zoom-leaflet — Leaflet initializer for ZoomTool.
 */

const smkRef = ( window as any ).SMK

smkRef.TYPE.ZoomTool.addInitializer( function ( this: any, smk: any ) {
    if ( this.mouseWheel )   smk.$viewer.map.scrollWheelZoom.enable()
    if ( this.doubleClick )  smk.$viewer.map.doubleClickZoom.enable()
    if ( this.box )          smk.$viewer.map.boxZoom.enable()

    if ( this.control ) {
        smk.on( this.id, {
            'trigger-zoom-in':  function () { smk.$viewer.map.zoomIn()  },
            'trigger-zoom-out': function () { smk.$viewer.map.zoomOut() },
        } )
    }
} )
