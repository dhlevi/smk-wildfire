/**
 * tool-select — Select composite tool.
 * Converted from tool/select/tool-select.js.
 */

import Tool from '../../tool'
import SelectListFactory from './tool-select-list'
import SelectFeatureFactory from './tool-select-feature'
import { SMK } from '../../smk-ref'

const smkRef = SMK

const factory = ( Tool as any ).defineComposite( [
    SelectListFactory,
    SelectFeatureFactory,
] )

smkRef.TYPE[ 'tool-select' ] = factory
export default factory
