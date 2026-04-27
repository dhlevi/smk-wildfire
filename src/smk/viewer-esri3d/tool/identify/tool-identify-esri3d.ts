/**
 * tool-identify-esri3d — Identify tool initializer for ESRI 3D viewer.
 * Converted from viewer-esri3d/tool/identify/tool-identify-esri3d.js.
 */

const smkRef = ( window as any ).SMK

smkRef.TYPE.IdentifyListTool.prototype.styleFeature = function ( this: any, override: any ) {
    return Object.assign( {
        strokeColor:   'black',
        strokeWidth:   8,
        strokeOpacity: 0.8,
        fillColor:     'white',
        fillOpacity:   0.5,
    }, this.style, override )
}

smkRef.TYPE.IdentifyListTool.addInitializer( function ( this: any, smk: any ) {
    if ( !smk.$viewer.view ) return   // not an esri3d viewer

    const self = this

    smk.$viewer.handlePick( 3, function ( location: any ) {
        if ( !self.active ) return

        return smk.$viewer.view.hitTest( location.screen )
            .then( function ( hit: any ) {
                if ( hit.results.length === 0 ) return
                if ( !hit.results[ 0 ].graphic ) return
                if ( !hit.results[ 0 ].graphic.attributes.$identifyMarker ) return

                smk.$viewer.identified.pick( self.firstId )
                return true
            } )
    } )
} )
