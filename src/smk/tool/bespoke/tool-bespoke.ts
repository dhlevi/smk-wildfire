/**
 * tool-bespoke — Bespoke (custom) tool.
 * Converted from tool/bespoke/tool-bespoke.js.
 */

import Tool from '../../tool'
import panelBespokeHtml from './panel-bespoke.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

Vue.component( 'bespoke-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'bespoke-panel', {
    extends:  smkRef.COMPONENT.ToolPanelBase,
    template: panelBespokeHtml,
    props:    [ 'content', 'component' ],
} )

const factory = ( Tool as any ).define( 'BespokeTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'bespoke-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'bespoke-panel' )

        this.defineProp( 'content' )
        this.defineProp( 'component' )
    },
    function ( this: any, smk: any ) {
        const self = this

        smk.on( this.id, {
            'activate': function () {
                if ( !self.enabled ) return

                if ( smkRef.HANDLER.has( self.id, 'triggered' ) ) {
                    self.active = false
                    smkRef.HANDLER.get( self.id, 'triggered' )( smk, self )
                }
            },

            'swipe-up': function () {
                smk.$sidepanel.setExpand( 2 )
            },

            'swipe-down': function () {
                smk.$sidepanel.incrExpand( -1 )
            },
        } )

        if ( !this.component )
            this.content = {
                createContent: function ( el: any ) {
                    smkRef.HANDLER.get( self.id, 'activated' )( smk, self, el )
                },
            }

        this.changedActive( function () {
            if ( self.active ) {
                if ( self.component )
                    smkRef.HANDLER.get( self.id, 'activated' )( smk, self )
            }
            else {
                smkRef.HANDLER.get( self.id, 'deactivated' )( smk, self )
            }
        } )

        smkRef.HANDLER.get( self.id, 'initialized' )( smk, self )
    },
    {
        configure( this: any, name: string, option: any ) {
            Object.assign( this, option )

            if ( this.instance ) {
                this.id = name + '--' + this.instance
            }
            else {
                this.id = name
            }

            return this
        },
    }
)

smkRef.TYPE[ 'tool-bespoke' ] = factory
export default factory
