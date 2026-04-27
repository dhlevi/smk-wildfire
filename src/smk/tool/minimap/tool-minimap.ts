/**
 * tool-minimap — Minimap (placeholder) tool.
 * Converted from tool/minimap/tool-minimap.js.
 */

import Tool from '../../tool'

const smkRef = ( window as any ).SMK

const factory = ( Tool as any ).define( 'MinimapTool' )

smkRef.TYPE[ 'tool-minimap' ] = factory
export default factory
