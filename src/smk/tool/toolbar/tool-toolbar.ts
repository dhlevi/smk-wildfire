/**
 * tool-toolbar — Toolbar container tool.
 * Converted from tool/toolbar/tool-toolbar.js.
 */

import Tool from '../../tool'
import toolbarHtml from './toolbar.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

const factory = ( Tool as any ).define( 'ToolBarTool',
    function ( this: any ) {
        this.model = {
            widgets: [] as any[],
        }
    },
    function ( this: any, smk: any ) {
        const container = smk.addToOverlay( toolbarHtml )

        this.vm = new Vue( {
            el:   container,
            data: this.model,
            methods: {
                trigger( toolId: string, event: string, arg: any, comp: any ) {
                    smk.emit( toolId, event, arg, comp )
                },
            },
        } )
    },
    {
        addTool( this: any, tool: any, smk: any ) {
            if ( tool.makeWidgetComponent ) {
                this.model.widgets.push( tool.makeWidgetComponent() )
            }

            smk.getSidepanel().addTool( tool, smk )

            return true
        },
    }
)

smkRef.TYPE[ 'tool-toolbar' ] = factory
export default factory
