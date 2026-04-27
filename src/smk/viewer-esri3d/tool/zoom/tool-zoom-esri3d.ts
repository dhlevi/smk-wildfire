/**
 * tool-zoom-esri3d — Zoom tool initializer for ESRI 3D viewer.
 * Converted from viewer-esri3d/tool/zoom/tool-zoom-esri3d.js.
 */

import '../../../tool/zoom/tool-zoom'

const smkRef = ( window as any ).SMK

smkRef.TYPE.ZoomTool.addInitializer( function ( this: any, smk: any ) {
    if ( !smk.$viewer.view ) return   // not an esri3d viewer

    const self = this

    if ( this.mouseWheel )   smk.$viewer.zoomHandler.mouseWheel.remove()
    if ( this.doubleClick ) { smk.$viewer.zoomHandler.doubleClick1.remove(); smk.$viewer.zoomHandler.doubleClick2.remove() }
    if ( this.box )         { smk.$viewer.zoomHandler.drag1.remove();        smk.$viewer.zoomHandler.drag2.remove() }

    if ( this.control ) {
        smk.$viewer.zoomHandler.keyDown.remove()

        const zoomModel = new smkRef.TYPE.Esri3d.widgets.Zoom.ZoomViewModel( {
            view: smk.$viewer.view,
        } )

        smk.on( this.id, {
            'trigger-zoom-in':  () => zoomModel.zoomIn(),
            'trigger-zoom-out': () => zoomModel.zoomOut(),
        } )
    }
} )
