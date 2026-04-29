/**
 * tool-zoom-leaflet — Leaflet initializer for ZoomTool.
 */

import '../../../tool/zoom/tool-zoom'
import { SMK } from '../../../smk-ref'

const smkRef = SMK

smkRef.TYPE.ZoomTool.addInitializer( function ( this: any, smk: any ) {
    if ( smk.$viewer.type !== 'leaflet' ) return

    if ( !smk.$viewer.map?.scrollWheelZoom ) return   // not a Leaflet viewer

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
