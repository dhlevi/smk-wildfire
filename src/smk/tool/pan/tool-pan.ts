/**
 * tool-pan — Pan tool.
 * Converted from tool/pan/tool-pan.js.
 */

import Tool from '../../tool'
import widgetPanHtml from './widget-pan.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

Vue.component( 'pan-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
    template: widgetPanHtml,
    props: [ 'control', 'navMode', 'compassStyle' ],
    computed: {
        navModePanClasses( this: any ) {
            const c = Object.assign( {}, this.classes )
            c[ 'smk-tool-active' ] = this.navMode === 'pan'
            return c
        },
        navModeRotateClasses( this: any ) {
            const c = Object.assign( {}, this.classes )
            c[ 'smk-tool-active' ] = this.navMode === 'rotate'
            return c
        },
    },
} )

const factory = ( Tool as any ).define( 'PanTool', {
    construct( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'pan-widget' )
        this.defineProp( 'control' )
        this.defineProp( 'navMode' )
        this.defineProp( 'compassStyle' )
        this.navMode = 'pan'
    },
    initialize( _smk: any ) {},
} )

smkRef.TYPE[ 'tool-pan' ] = factory
export default factory
