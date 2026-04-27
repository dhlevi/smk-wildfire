import type { SmkInstance } from '../../viewer-leaflet'
import './lib/leaflet-geoman-2.11.2.min.js'
import './lib/leaflet-geoman-2.11.2.css'

declare const SMK: any

SMK.TYPE.MarkupTool.addInitializer( function ( this: any, smk: SmkInstance ) {
    const self = this

    this.changedActive( function () {
        if ( self.active ) {
            self.removeMarkup()

            smk.$viewer.map.on( 'pm:create', function ( ev: any ) {
                self.prevLayer = ev.layer
                self.active = false
                SMK.HANDLER.get( self.id, 'markup-created' )( smk, self, ev.layer.toGeoJSON() )
            } )

            smk.$viewer.map.pm.enableDraw( self.drawMode )
        }
        else {
            smk.$viewer.map.pm.disableDraw()
            smk.$viewer.map.off( 'pm:create' )
        }
    } )

    this.removeMarkup = function () {
        if ( self.prevLayer ) {
            self.prevLayer.remove()
            self.prevLayer = null
        }
    }
} )
