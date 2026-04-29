/**
 * tool-dropdown — Dropdown container tool.
 * Converted from tool/dropdown/tool-dropdown.js.
 */

import Tool from '../../tool'
import panelDropdownHtml from './panel-dropdown.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'dropdown-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'dropdown-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelDropdownHtml,
    props: [ 'visible', 'enabled', 'active', 'subWidgets', 'subPanels', 'activeToolId' ],
    methods: {
        removeTitle( prop: any ) {
            prop.title = null
            return prop
        },
    },
} )

const factory = ( Tool as any ).define( 'DropdownTool',
    function ( this: any ) {
        this.defineProp( 'subWidgets' )
        this.defineProp( 'subPanels' )
        this.defineProp( 'activeToolId' )
        this.subWidgets   = []
        this.subPanels    = {}
        this.activeToolId = null
    },
    function ( this: any, smk: any ) {
        const self = this

        smk.on( this.id, {
            'activate': function () {
                if ( !self.enabled ) return
                self.active = !self.active
            },
            'select-tool': function ( ev: any ) {
                smk.$tool[ ev.id ].active = true
            },
        } )

        self.changedActive( function () {
            if ( self.selectedTool )
                self.selectedTool.active = self.active
        } )
    },
    {
        addTool( this: any, tool: any, smk: any ) {
            const self = this

            this.subWidgets.push( {
                id:              tool.id,
                widgetComponent: tool.widgetComponent,
                widget:          tool.widget,
            } )

            Vue.set( this.subPanels, tool.id, {
                panelComponent: tool.panelComponent,
                panel:          tool.panel,
            } )

            if ( !this.selectedTool )
                this.selectedTool = tool

            tool.changedActive( function () {
                if ( tool.active ) {
                    if ( self.selectedTool.id !== tool.id ) {
                        const prev = self.selectedTool
                        self.selectedTool = tool
                        prev.active = false
                    }
                    self.active = true
                } else {
                    if ( self.selectedTool.id === tool.id && self.active )
                        tool.active = true
                }

                if ( tool.id === self.selectedTool.id )
                    self.activeToolId = tool.active ? tool.id : null
            } )

            return true
        },
    }
)

smkRef.TYPE[ 'tool-dropdown' ] = factory
export default factory
