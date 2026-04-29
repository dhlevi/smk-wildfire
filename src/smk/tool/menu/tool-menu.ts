/**
 * tool-menu — Menu container tool.
 * Converted from tool/menu/tool-menu.js.
 */

import Tool from '../../tool'
import panelMenuHtml from './panel-menu.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'menu-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'menu-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelMenuHtml,
    props: [ 'subWidgets', 'subPanels' ],
    methods: {
        isActivePanel( this: any, widgetId: string ) {
            let p = this.getPanel( widgetId )
            if ( !p ) return false
            if ( p.prop.active ) return true
            while ( p ) {
                p = this.getChildPanel( p.prop.id )
                if ( p && p.prop.active ) return true
            }
            return false
        },
        getPanel( this: any, id: string ) {
            return this.subPanels.find( ( p: any ) => p.prop.id === id )
        },
        getChildPanel( this: any, id: string ) {
            return this.subPanels.find( ( p: any ) => p.prop.parentId === id )
        },
    },
} )

const factory = Tool.define( 'MenuTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'menu-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'menu-panel' )
        this.defineProp( 'subWidgets' )
        this.defineProp( 'subPanels' )
        this.subWidgets = []
        this.subPanels  = []
    },
    function ( this: any, smk: any ) {
        const self = this

        smk.on( this.id, {
            'previous-panel': function () {
                if ( self.previousId ) smk.getToolById( self.previousId ).active = true
            },
            'swipe-up': function () {
                smk.$sidepanel.setExpand( 2 )
            },
            'swipe-down': function () {
                smk.$sidepanel.incrExpand( -1 )
            },
        } )

        this.changedActive( function () {
            if ( self.active ) {
                if ( self.selectedId ) smk.getToolById( self.selectedId ).active = true
            } else {
                self.subPanels.forEach( ( t: any ) => {
                    smk.getToolById( t.prop.id ).active = false
                } )
            }
        } )
    },
    {
        addTool( this: any, tool: any, smk: any, setParentId: any ) {
            const self = this

            if ( !tool.parentId ) setParentId( tool, this.id )

            if ( tool.makeWidgetComponent ) {
                this.subWidgets.push( tool.makeWidgetComponent() )
                if ( !this.selectedId ) this.selectedId = tool.id
            }

            if ( tool.makePanelComponent ) {
                this.subPanels.push( tool.makePanelComponent() )
            }

            tool.changedActive( function () {
                if ( tool.active ) {
                    self.selectedId  = tool.id
                    self.hasPrevious = !tool.widgetComponent
                    self.previousId  = tool.parentId
                }
            } )

            tool.isToolInGroupActive = function ( toolId: string ) {
                return toolId === tool.id || toolId === self.id
            }

            return true
        },
    }
)

smkRef.TYPE[ 'tool-menu' ] = factory
export default factory
