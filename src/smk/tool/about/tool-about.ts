/**
 * tool-about — About tool.
 * Converted from tool/about/tool-about.js.
 */

import Tool from '../../tool'
import panelAboutHtml from './panel-about.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'about-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'about-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelAboutHtml,
    props: [ 'content' ],
} )

const factory = Tool.define( 'AboutTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'about-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'about-panel' )

        this.defineProp( 'content' )
    }
)

smkRef.TYPE[ 'tool-about' ] = factory
export default factory
