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
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelBespokeHtml,
    props: [ 'bespoke' ],
} )

const factory = ( Tool as any ).define( 'BespokeTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'bespoke-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'bespoke-panel' )
        this.defineProp( 'bespoke' )
        this.bespoke = {}
    },
    function ( this: any, smk: any ) {
        const self = this

        this.changedActive( function () {
            if ( self.active )
                smkRef.HANDLER.get( self.id, 'activated' )( smk, self )
            else
                smkRef.HANDLER.get( self.id, 'deactivated' )( smk, self )
        } )

        smkRef.HANDLER.get( self.id, 'initialized' )( smk, self )

        smk.on( this.id, {
            trigger( _ev: any ) {
                smkRef.HANDLER.get( self.id, 'triggered' )( smk, self )
            },
        } )

        this.bespoke.create = function ( el: any ) {
            smkRef.HANDLER.get( self.id, 'activated' )( smk, self, el )
        }
    }
)

; ( factory as any ).configure = function ( this: any ) {}

smkRef.TYPE[ 'tool-bespoke' ] = factory
export default factory
