/**
 * tool-measure — Measure tool.
 * Converted from tool/measure/tool-measure.js.
 */

import Tool from '../../tool'
import panelMeasureHtml from './panel-measure.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'measure-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'measure-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelMeasureHtml,
    props: [ 'results', 'viewer', 'content', 'unit' ],
    data() {
        return {
            unitProp: this.unit,
        }
    },
    computed: {
        dimensionalNumber() {
            return Vue.filter( 'dimensionalNumber' )
        },
    },
} )

const factory = Tool.define( 'MeasureTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'measure-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'measure-panel' )
        this.defineProp( 'results' )
        this.defineProp( 'viewer' )
        this.defineProp( 'content' )
        this.defineProp( 'unit' )
        this.results = []
        this.viewer  = {}
        this.unit    = 'metric'
        this.$propFilter.dimensionalNumber = false
    },
    function ( this: any, smk: any ) {
        const self = this
        this.content = {
            createContent( el: HTMLElement ) {
                smkRef.HANDLER.get( self.id, 'activated' )( smk, self, el )
            },
        }
    }
)

smkRef.TYPE[ 'tool-measure' ] = factory
export default factory
