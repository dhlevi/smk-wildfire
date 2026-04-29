/**
 * tool-search-esri3d — Search tool initializer for ESRI 3D viewer.
 * Converted from viewer-esri3d/tool/search/tool-search-esri3d.js.
 */

import '../../../tool/search/tool-search-list'
import { SMK } from '../../../smk-ref'

const smkRef = SMK

smkRef.TYPE.SearchListTool.addInitializer( function ( this: any, smk: any ) {
    if ( !smk.$viewer.view ) return   // not an esri3d viewer

    const self = this

    smk.$viewer.handlePick( 3, function ( location: any ) {
        if ( !self.active ) return

        return smk.$viewer.view.hitTest( location.screen )
            .then( function ( hit: any ) {
                if ( hit.results.length === 0 ) return
                if ( !hit.results[ 0 ].graphic ) return

                smk.$viewer.searched.pick( hit.results[ 0 ].graphic.attributes.id )
                return true
            } )
    } )
} )
