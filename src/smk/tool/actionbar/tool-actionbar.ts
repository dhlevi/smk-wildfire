/**
 * tool-actionbar — Actionbar container tool.
 * Converted from tool/actionbar/tool-actionbar.js.
 */

import Tool from '../../tool'
import actionbarHtml from './actionbar.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

const factory = ( Tool as any ).define( 'ActionBarTool',
    function ( this: any ) {
        this.model = {
            widgets: [] as any[],
        }
    },
    function ( this: any, smk: any ) {
        this.vm = new Vue( {
            el:   smk.addToOverlay( actionbarHtml ),
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

smkRef.TYPE[ 'tool-actionbar' ] = factory
export default factory
