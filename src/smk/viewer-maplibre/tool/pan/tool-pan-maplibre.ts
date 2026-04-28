/**
 * MapLibre initializer for PanTool.
 */

import '../../../tool/pan/tool-pan'

const smkRef = ( window as any ).SMK

smkRef.TYPE.PanTool.addInitializer( function ( this: any, smk: any ) {
    if ( !smk.$viewer.map?.dragPan ) return    // not a MapLibre viewer, so ignore

    smk.$viewer.map.dragPan.enable()
    smk.$viewer.map.keyboard.enable()
    this.control = false
} )
