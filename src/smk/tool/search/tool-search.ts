/**
 * tool-search — Search composite tool.
 * Converted from tool/search/tool-search.js.
 */

import Tool from '../../tool'
import SearchListFactory from './tool-search-list'
import SearchLocationFactory from './tool-search-location'
import { SMK } from '../../smk-ref'

const smkRef = SMK

const factory = ( Tool as any ).defineComposite( [
    SearchListFactory,
    SearchLocationFactory,
] )

smkRef.TYPE[ 'tool-search' ] = factory
export default factory
