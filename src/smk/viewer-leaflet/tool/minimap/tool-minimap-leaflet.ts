/**
 * tool-minimap-leaflet — Leaflet initializer for MinimapTool.
 * Converted from viewer-leaflet/tool/minimap/tool-minimap-leaflet.js.
 */

import '../../../tool/minimap/tool-minimap'
import './lib/Control.MiniMap-3.6.1.min.css'
import './lib/Control.MiniMap-3.6.1.min.js'

declare const L:    any
declare const $:    any

const smkRef = ( window as any ).SMK

smkRef.TYPE.MinimapTool.addInitializer( function ( this: any, smk: any ) {
    if ( smk.$device === 'mobile' ) return

    smk.addToStatus( $( '<div class="smk-spacer">' ).height( 170 ).get( 0 ) )

    const ly = smk.$viewer.createBasemapLayer( this.baseMap || 'Topographic' )

    ;( new L.Control.MiniMap( ly[ 0 ], Object.assign( { toggleDisplay: true }, this.option ) ) )
        .addTo( smk.$viewer.map )
} )
