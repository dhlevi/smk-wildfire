/**
 * tool-query — Query composite tool.
 * Converted from tool/query/tool-query.js.
 */

import Tool from '../../tool'
import QueryParametersFactory from './tool-query-parameters'
import QueryResultsFactory from './tool-query-results'
import QueryFeatureFactory from './tool-query-feature'
import { SMK } from '../../smk-ref'

const smkRef = SMK

const factory = Tool.defineComposite( [
    QueryParametersFactory,
    QueryResultsFactory,
    QueryFeatureFactory,
] )

smkRef.TYPE[ 'tool-query' ] = factory
export default factory
