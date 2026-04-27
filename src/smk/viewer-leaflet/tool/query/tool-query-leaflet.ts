/**
 * tool-query-leaflet — Leaflet initializer for QueryResultsTool (clustering).
 */

import { toolFeatureListClusteringLeaflet } from '../tool-feature-list-clustering-leaflet'

const smkRef = ( window as any ).SMK

smkRef.TYPE.QueryResultsTool.addInitializer( function ( this: any ) {
    this.styleFeature = function () {
        const self = this
        return function () {
            return Object.assign( {
                color:       'black',
                weight:      3,
                opacity:     0.8,
                fillColor:   'white',
                fillOpacity: 0.5,
            }, self.style )
        }
    }
} )

smkRef.TYPE.QueryResultsTool.addInitializer( toolFeatureListClusteringLeaflet )
