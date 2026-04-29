/**
 * tool-pan-esri3d — Pan tool initializer for ESRI 3D viewer.
 * Converted from viewer-esri3d/tool/pan/tool-pan-esri3d.js.
 */

import '../../../tool/pan/tool-pan'
import { SMK } from '../../../smk-ref'

const smkRef = SMK

smkRef.TYPE.PanTool.addInitializer( function ( this: any, smk: any ) {
    if ( !smk.$viewer.view ) return   // not an esri3d viewer

    const self = this

    if ( this.control ) {
        smk.$viewer.zoomHandler.keyDown.remove()

        const navModel = new smkRef.TYPE.Esri3d.widgets.NavigationToggle.NavigationToggleViewModel( {
            view: smk.$viewer.view,
        } )

        const compassModel = new smkRef.TYPE.Esri3d.widgets.Compass.CompassViewModel( {
            view: smk.$viewer.view,
        } )

        smk.on( this.id, {
            'trigger-compass':          () => compassModel.reset(),
            'trigger-nav-mode-pan':     () => { self.navMode = 'pan';    if ( navModel.navigationMode !== 'pan'    ) navModel.toggle() },
            'trigger-nav-mode-rotate':  () => { self.navMode = 'rotate'; if ( navModel.navigationMode !== 'rotate' ) navModel.toggle() },
        } )

        smkRef.TYPE.Esri3d.core.watchUtils.watch( compassModel, 'orientation', function () {
            self.compassStyle = { transform: 'rotateZ(' + compassModel.orientation.z + 'deg)' }
        } )
    }

    smk.$viewer.panHandler.drag.remove()
    smk.$viewer.panHandler.keyDown.remove()
} )
