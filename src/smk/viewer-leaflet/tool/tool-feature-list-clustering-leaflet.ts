/**
 * tool-feature-list-clustering-leaflet — clustering display for feature-list tools.
 * Converted from tool-feature-list-clustering-leaflet.js.
 */

declare const L:    any
declare const turf: any

const smkRef = ( window as any ).SMK

/** Called with tool instance as `this` context; smk is first arg */
export function toolFeatureListClusteringLeaflet( this: any, smk: any ) {
    if ( smk.$viewer.type !== 'leaflet' ) return

    const self = this

    this.marker  = {}
    this.cluster = L.markerClusterGroup( Object.assign( {
        singleMarkerMode:    true,
        zoomToBoundsOnClick: false,
        spiderfyOnMaxZoom:   false,
        iconCreateFunction:  function ( cluster: any ) {
            const count = cluster.getChildCount()
            return new L.DivIcon( {
                html:      '<div><span>' + ( count === 1 ? '' : count > 999 ? 'lots' : count ) + '</span></div>',
                className: 'smk-identify-cluster smk-identify-cluster-' + ( count === 1 ? 'one' : 'many' ),
                iconSize:  null,
            } )
        },
    }, smk.viewer.clusterOption ) )
    .on( {
        clusterclick: function ( ev: any ) {
            const featureIds = ev.layer.getAllChildMarkers().map( ( m: any ) => m.options.featureId )
            self.featureSet.pick( featureIds[ 0 ], { cluster: true, position: ev.latlng } )
        },
        click: function ( ev: any ) {
            self.featureSet.pick( ev.layer.options.featureId, { cluster: true, position: ev.latlng } )
        },
    } )

    self.changedVisible( function () {
        if ( self.visible ) {
            self.cluster.addTo( smk.$viewer.map )
        } else {
            self.cluster.remove()
        }
    } )

    self.featureSet.addedFeatures( function ( ev: any ) {
        ev.features.forEach( function ( f: any ) {
            let center: any
            switch ( turf.getType( f ) ) {
            case 'Point':
                center = L.GeoJSON.coordsToLatLng( f.geometry.coordinates )
                break
            case 'MultiPoint':
                if ( f._identifyPoint )
                    center = [ f._identifyPoint.latitude, f._identifyPoint.longitude ]
                break
            default:
                break
            }

            if ( !center )
                center = L.GeoJSON.coordsToLatLng( turf.centerOfMass( f.geometry ).geometry.coordinates )

            self.marker[ f.id ] = L.marker( center, { featureId: f.id } )
            self.cluster.addLayer( self.marker[ f.id ] )
        } )
    } )

    self.featureSet.clearedFeatures( function () {
        self.cluster.clearLayers()
        self.marker = {}
    } )
}

// Register on SMK for legacy access
smkRef.TYPE[ 'tool-feature-list-clustering-leaflet' ] = toolFeatureListClusteringLeaflet

export default toolFeatureListClusteringLeaflet
