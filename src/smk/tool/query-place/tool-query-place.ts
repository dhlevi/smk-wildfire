/**
 * tool-query-place — Query-place tool.
 * Converted from tool/query-place/tool-query-place.js.
 * Note: Inherits from QueryTool (SMK.TYPE.QueryTool) via prototype chain.
 */

import featurePlaceHtml from './feature-place.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'query-place-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'feature-place', {
    extends: smkRef.TYPE.VueFeatureComponent,
    template: featurePlaceHtml,
} )

function QueryPlaceTool( this: any, option: any ) {
    if ( smkRef.TYPE.QueryTool )
        smkRef.TYPE.QueryTool.prototype.constructor.call( this, Object.assign( {
            order:           4,
            widgetComponent: 'query-place-widget',
            instance:        'place',
        }, option ) )
}

// QueryTool was disabled in the AMD build (smk-tags.js has it commented out as
// "broken") and is not registered at module evaluation time.  Guard the
// prototype wiring so the bundle doesn't crash when QueryTool is absent.
if ( smkRef.TYPE.QueryTool ) {
    Object.assign( QueryPlaceTool.prototype, smkRef.TYPE.QueryTool.prototype )
    QueryPlaceTool.prototype.afterInitialize = smkRef.TYPE.QueryTool.prototype.afterInitialize.concat( [] )
    smkRef.TYPE.QueryPlaceTool = QueryPlaceTool
    smkRef.TYPE[ 'tool-query-place' ] = QueryPlaceTool
} else {
    console.warn( 'SMK: tool-query-place: QueryTool not defined, skipping registration' )
}

export default QueryPlaceTool
