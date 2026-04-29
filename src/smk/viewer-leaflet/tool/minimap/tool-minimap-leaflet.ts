/**
 * tool-minimap-leaflet — Leaflet initializer for MinimapTool.
 * Converted from viewer-leaflet/tool/minimap/tool-minimap-leaflet.js.
 */

import '../../../tool/minimap/tool-minimap'
import './lib/Control.MiniMap-3.6.1.min.css'
import './lib/Control.MiniMap-3.6.1.min.js'

declare const L: any

const smkRef = ( window as any ).SMK

smkRef.TYPE.MinimapTool.addInitializer( function ( this: any, smk: any ) {
    if ( smk.$viewer.type !== 'leaflet' ) return

    if ( smk.$device === 'mobile' ) return

    const spacer = document.createElement( 'div' )
    spacer.className   = 'smk-spacer'
    spacer.style.height = '170px'
    smk.addToStatus( spacer )

    const ly = smk.$viewer.createBasemapLayer( this.baseMap || 'Topographic' )

    ;( new L.Control.MiniMap( ly[ 0 ], Object.assign( { toggleDisplay: true }, this.option ) ) )
        .addTo( smk.$viewer.map )
} )
