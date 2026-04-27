/**
 * tool-version — Version info tool.
 * Converted from tool/version/tool-version.js.
 */

import Tool from '../../tool'
import panelVersionHtml from './panel-version.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

Vue.component( 'version-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'version-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelVersionHtml,
    props: [ 'build', 'config' ],
} )

const factory = ( Tool as any ).define( 'VersionTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'version-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'version-panel' )
        this.defineProp( 'build' )
        this.defineProp( 'config' )
    },
    function ( this: any, smk: any ) {
        this.config = smkRef.UTIL.projection( 'lmfId', 'lmfRevision', 'createdBy', '_rev', 'published' )( smk )
        this.config.enabledTools = Object.keys( smk.$toolType ).sort()
    }
)

smkRef.TYPE[ 'tool-version' ] = factory
export default factory
