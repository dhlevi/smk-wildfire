/**
 * tool-query-results — Query results panel tool (part of query composite).
 * Converted from tool/query/tool-query-results.js.
 */

import Tool from '../../tool'
import panelQueryResultsHtml from './panel-query-results.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

Vue.component( 'query-results-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelQueryResultsHtml,
    props: [ 'tool', 'layers', 'highlightId', 'command' ],
} )

const factory = ( Tool as any ).define( 'QueryResultsTool',
    function ( this: any ) {
        smkRef.TYPE.ToolPanel.call( this, 'query-results-panel' )
        smkRef.TYPE.ToolInternalLayers.call( this )
        smkRef.TYPE.ToolFeatureList.call( this, function ( smk: any ) { return smk.$viewer.queried[ ( this as any ).instance ] } )

        this.internalLayers.push(
            { id: 'highlight-polygon', style: { fill: true, stroke: true, fillColor: 'white', fillOpacity: 0.5, strokeColor: 'black', strokeWidth: 3, strokeOpacity: 0.8 } },
            { id: 'highlight-line',    style: { stroke: true, strokeColor: 'black', strokeWidth: 3, strokeOpacity: 0.8 } },
            { id: 'highlight-point',   style: { markerSize: [ 25, 41 ], markerOffset: [ 12, 41 ], shadowSize: [ 41, 41 ] } },
        )

        this.defineProp( 'tool' )
        this.defineProp( 'command' )

        this.tool    = {}
        this.command = {}

        this.parentId = 'QueryParametersTool'
    },
    function ( this: any, smk: any ) {
        const self = this

        this.title = smk.$viewer.query[ this.instance ].title
        this.tool  = smk.getToolTypesAvailable()

        smk.on( this.id, {
            'previous-panel': function () {
                self.featureSet.clear()
            },
        } )

        self.featureSet.addedFeatures( function () {
            const stat = self.featureSet.getStats()
            self.active = true
            self.showStatusMessage( '<div>Found ' + smkRef.UTIL.grammaticalNumber( stat.featureCount, null, 'a feature', '{} features' ) + '</div>' )
        } )
    }
)

smkRef.TYPE[ 'tool-query-results' ] = factory
export default factory
