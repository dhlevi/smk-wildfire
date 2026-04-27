/**
 * tool-actionbar — Actionbar container tool.
 * Converted from tool/actionbar/tool-actionbar.js.
 */

import Tool from '../../tool'
import actionbarHtml from './actionbar.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

const factory = ( Tool as any ).define( 'ActionBarTool',
    null,
    function ( this: any, smk: any ) {
        const container = smk.addToOverlay( actionbarHtml )

        this.vm = new Vue( {
            el:   container,
            data: {},
        } )
    }
)

; ( factory as any ).addTool = function ( smk: any, tool: any ) {
    smk.getSidepanel().addTool( smk, tool )
}

smkRef.TYPE[ 'tool-actionbar' ] = factory
export default factory
