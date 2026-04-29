/**
 * tool-identify — Identify composite tool.
 * Converted from tool/identify/tool-identify.js.
 */

import Tool from '../../tool'
import IdentifyListFactory from './tool-identify-list'
import IdentifyFeatureFactory from './tool-identify-feature'
import { SMK } from '../../smk-ref'

const smkRef = SMK

const factory = Tool.defineComposite( [
    IdentifyListFactory,
    IdentifyFeatureFactory,
] )

smkRef.TYPE[ 'tool-identify' ] = factory
export default factory
