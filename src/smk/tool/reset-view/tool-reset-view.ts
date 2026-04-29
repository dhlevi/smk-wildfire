/**
 * tool-reset-view — Reset view tool.
 * Converted from tool/reset-view/tool-reset-view.js.
 */

import Tool from '../../tool'
import widgetResetViewHtml from './widget-reset-view.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'reset-view-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
    template: widgetResetViewHtml,
} )

const factory = Tool.define( 'ResetViewTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'reset-view-widget' )
    },
    function ( this: any, smk: any ) {
        const self = this

        smk.on( this.id, {
            trigger( _ev: any ) {
                smk.$viewer.setView( smk.viewer.location )
            },
        } )
    }
)

smkRef.TYPE[ 'tool-reset-view' ] = factory
export default factory
