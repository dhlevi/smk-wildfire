/**
 * tool-minimap — Minimap (placeholder) tool.
 * Converted from tool/minimap/tool-minimap.js.
 */

import Tool from '../../tool'
import { SMK } from '../../smk-ref'

const smkRef = SMK

const factory = ( Tool as any ).define( 'MinimapTool' )

smkRef.TYPE[ 'tool-minimap' ] = factory
export default factory
