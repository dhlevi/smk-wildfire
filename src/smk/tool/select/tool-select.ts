/**
 * tool-select — Select composite tool.
 * Converted from tool/select/tool-select.js.
 */

import Tool from '../../tool'
import SelectListFactory from './tool-select-list'
import SelectFeatureFactory from './tool-select-feature'

const smkRef = ( window as any ).SMK

const factory = ( Tool as any ).defineComposite( [
    SelectListFactory,
    SelectFeatureFactory,
] )

smkRef.TYPE[ 'tool-select' ] = factory
export default factory
