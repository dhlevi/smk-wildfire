import type { SmkInstance } from '../../viewer-leaflet'

declare const SMK: any
declare const L: any
declare const $: any

SMK.TYPE.MinimapTool.addInitializer( function ( this: any, smk: SmkInstance ) {
    if ( smk.$device === 'mobile' ) return

    smk.addToStatus( $( '<div class="smk-spacer">' ).height( 170 ).get( 0 ) )

    const ly = smk.$viewer.createBasemapLayer( this.baseMap || 'Topographic' );

    ( new L.Control.MiniMap( ly[ 0 ], Object.assign( { toggleDisplay: true }, this.option ) ) )
        .addTo( smk.$viewer.map )
} )
