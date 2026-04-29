/**
 * tool-list-menu — List menu container tool.
 * Converted from tool/list-menu/tool-list-menu.js.
 */

import Tool from '../../tool'
import panelListMenuHtml from './panel-list-menu.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'list-menu-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'list-menu-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelListMenuHtml,
    props: [ 'subWidgets' ],
} )

const factory = ( Tool as any ).define( 'ListMenuTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'list-menu-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'list-menu-panel' )
        this.defineProp( 'subWidgets' )
        this.subWidgets = []
    },
    function ( this: any, smk: any ) {
        smk.on( this.id, {
            'swipe-up': function ( _ev: any ) {
                smk.$sidepanel.setExpand( 2 )
            },
            'swipe-down': function ( _ev: any ) {
                smk.$sidepanel.incrExpand( -1 )
            },
        } )
    },
    {
        addTool( this: any, tool: any, smk: any, setParentId: any ) {
            if ( !tool.parentId ) {
                setParentId( tool, this.id )
                this.subWidgets.push( tool.makeWidgetComponent() )
            }
            smk.getSidepanel().addTool( tool, smk )
            tool.showTitle = true
            return true
        },
    }
)

smkRef.TYPE[ 'tool-list-menu' ] = factory
export default factory
