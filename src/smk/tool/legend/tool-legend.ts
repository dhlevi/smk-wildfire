/**
 * tool-legend — Legend (status bar) tool.
 * Converted from tool/legend/tool-legend.js.
 */

import Tool from '../../tool'
import legendHtml from './legend.html?raw'
import legendDisplayHtml from './legend-display.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

Vue.component( 'legend-display', {
    template: legendDisplayHtml,
    props: {
        display: { type: Object },
        inGroup: { type: Boolean, default: false },
    },
} )

const factory = ( Tool as any ).define( 'LegendTool',
    null,
    function ( this: any, smk: any ) {
        const self = this

        const model = {
            contexts: [],
        }

        this.vm = new Vue( {
            el:   smk.addToStatus( legendHtml ),
            data: model,
        } )

        smk.$viewer.changedDisplayContext( function () {
            model.contexts = smk.$viewer.getDisplayContexts()
        } )
    }
)

smkRef.TYPE[ 'tool-legend' ] = factory
export default factory
