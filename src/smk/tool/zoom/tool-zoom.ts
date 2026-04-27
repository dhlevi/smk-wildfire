/**
 * tool-zoom — Zoom tool.
 * Converted from tool/zoom/tool-zoom.js.
 */

import Tool from '../../tool'
import widgetZoomHtml from './widget-zoom.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

Vue.component( 'zoom-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
    template: widgetZoomHtml,
    props: [ 'control' ],
} )

const factory = ( Tool as any ).define( 'ZoomTool', {
    construct( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'zoom-widget' )
        this.defineProp( 'control' )
    },
    initialize( _smk: any ) {},
} )

smkRef.TYPE[ 'tool-zoom' ] = factory
export default factory
