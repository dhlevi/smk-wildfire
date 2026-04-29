/**
 * tool-directions — Directions composite tool.
 * Converted from tool/directions/tool-directions.js.
 */

import Tool from '../../tool'
import DirectionsWaypointsFactory from './tool-directions-waypoints'
import DirectionsOptionsFactory from './tool-directions-options'
import DirectionsRouteFactory from './tool-directions-route'
import { SMK } from '../../smk-ref'

const smkRef = SMK

const factory = ( Tool as any ).defineComposite( [
    DirectionsWaypointsFactory,
    DirectionsOptionsFactory,
    DirectionsRouteFactory,
] )

smkRef.TYPE[ 'tool-directions' ] = factory
export default factory
