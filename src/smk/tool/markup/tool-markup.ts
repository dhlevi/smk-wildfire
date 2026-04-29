/**
 * tool-markup — Markup tool.
 * Converted from tool/markup/tool-markup.js.
 */

import Tool from '../../tool'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'markup-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
    props: [ 'drawMode' ],
} )

const factory = Tool.define( 'MarkupTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'markup-widget' )
        this.defineProp( 'drawMode' )
        this.drawMode = 'Polygon'
    },
    function ( this: any, smk: any ) {
        const self = this

        smk.on( this.id, {
            'activate': function () {
                if ( !self.enabled ) return
            },
        } )

        this.changedActive( function () {
            if ( self.active )
                smkRef.HANDLER.get( self.id, 'activated' )( smk, self )
            else
                smkRef.HANDLER.get( self.id, 'deactivated' )( smk, self )
        } )

        smkRef.HANDLER.get( self.id, 'initialized' )( smk, self )
    }
)

smkRef.TYPE[ 'tool-markup' ] = factory
export default factory
