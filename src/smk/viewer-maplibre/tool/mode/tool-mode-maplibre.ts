/**
 * tool-mode-maplibre — 2D / 3D mode toggle for the MapLibre viewer.
 * Renders as a button in the actionbar by default.
 */

import Tool from '../../../tool'
import widgetModeHtml from './widget-mode.html?raw'
import './widget-mode.css'
import { SMK } from '../../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'mode-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
    template: widgetModeHtml,
} )

const factory = ( Tool as any ).define( 'ModeTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'mode-widget' )
        this.status = '2d'
        this.title  = 'Switch to 3D'
    },
    function ( this: any, smk: any ) {
        const self = this

        // Only meaningful for the maplibre viewer.  Disable for others so the
        // button doesn't show up where it has no effect.
        if ( typeof smk.$viewer.toggleMode !== 'function' ) {
            self.enabled = false
            self.visible = false
            return
        }

        self.enabled = true
        self.visible = true

        function syncIcon() {
            const mode = smk.$viewer.getMode?.() || '2d'
            if ( mode === '3d' ) {
                self.title  = 'Switch to 2D'
                self.status = '3d'
            } else {
                self.title  = 'Switch to 3D'
                self.status = '2d'
            }
        }

        syncIcon()

        smk.on( this.id, {
            trigger() {
                smk.$viewer.toggleMode()
                syncIcon()
            },
        } )
    }
)

smkRef.TYPE[ 'tool-mode' ] = factory
export default factory
