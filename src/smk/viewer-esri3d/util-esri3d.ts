/**
 * util-esri3d — GeoJSON ↔ ESRI geometry conversion and symbol helpers.
 * Converted from util-esri3d.js.
 *
 * Depends on `Terraformer` global (ESRI Terraformer ArcGIS plugin).
 */

declare const Terraformer: any

const smkRef = ( window as any ).SMK

// ---------------------------------------------------------------------------
// GeoJSON to ESRI geometry conversion
// ---------------------------------------------------------------------------

let featureId = 1000

const geojsonType: Record<string, ( obj: any ) => any[]> = {
    Point( obj ) {
        return [ Object.assign( { type: 'point' }, Terraformer.ArcGIS.convert( obj ) ) ]
    },
    MultiPoint( obj ) {
        return obj.coordinates.reduce( ( acc: any[], c: any ) =>
            acc.concat( convertGeojson( { type: 'Point', coordinates: c } ) ), [] )
    },
    LineString( obj ) {
        return [ Object.assign( { type: 'polyline' }, Terraformer.ArcGIS.convert( obj ) ) ]
    },
    MultiLineString( obj ) {
        return [ Object.assign( { type: 'polyline' }, Terraformer.ArcGIS.convert( obj ) ) ]
    },
    Polygon( obj ) {
        return [ Object.assign( { type: 'polygon' }, Terraformer.ArcGIS.convert( obj ) ) ]
    },
    MultiPolygon( obj ) {
        return [ Object.assign( { type: 'polygon' }, Terraformer.ArcGIS.convert( obj ) ) ]
    },
    GeometryCollection( obj ) {
        return obj.geometries.reduce( ( acc: any[], g: any ) => acc.concat( convertGeojson( g ) ), [] )
    },
    FeatureCollection( obj ) {
        return obj.features.reduce( ( acc: any[], f: any ) => acc.concat( convertGeojson( f ) ), [] )
    },
    Feature( obj ) {
        return convertGeojson( obj.geometry ).map( function ( g: any ) {
            featureId += 1
            return {
                geometry:   g,
                attributes: Object.assign( {
                    _geojsonGeometry: obj.geometry,
                    _featureId:       featureId,
                }, obj.properties ),
            }
        } )
    },
}

function convertGeojson( geojson: any ): any[] {
    return geojsonType[ geojson.type || 'Feature' ]( geojson )
}

// ---------------------------------------------------------------------------
// Attach helpers to SMK.UTIL
// ---------------------------------------------------------------------------

Object.assign( smkRef.UTIL, {
    geoJsonToEsriGraphics( geojson: any ) {
        return convertGeojson( geojson )
    },

    mapSymbolsToGraphics( graphics: any[], symbols: any ) {
        const self = smkRef.UTIL
        return graphics.reduce( function ( acc: any[], g: any ) {
            return acc.concat( self.symbolsForGraphic( g, symbols ).map( function ( symbol: any, i: number ) {
                let g1: any
                if ( g.clone )        g1 = g.clone()
                else                  g1 = Object.assign( {}, g )
                g1.symbol                        = symbol
                g1.attributes._symbolIndex       = i
                return g1
            } ) )
        }, [] )
    },

    symbolsForGraphic( graphic: any, symbols: any ) {
        symbols = [].concat( symbols || [] )
        if ( symbols.length === 0 ) symbols.push( {} )
        return symbols.map( function ( symbol: any ) {
            const s = symbol[ graphic.geometry.type ]
            if ( smkRef.UTIL.type( s ) === 'function' ) return s( graphic.attributes )
            return s
        } )
    },

    smkStyleToEsriSymbol( styleConfig: any, viewer: any ) {
        const line = {
            type: 'line-3d',
            symbolLayers: [ {
                type:     'line',
                size:     styleConfig.strokeWidth,
                material: { color: color( styleConfig.strokeColor, styleConfig.strokeOpacity ) },
                cap:      styleConfig.strokeCap,
                join:     styleConfig.strokeJoin,
            } ],
        }

        let point: any
        if ( styleConfig.markerUrl ) {
            const sz  = styleConfig.markerSize
            const cx  = sz[ 0 ] / 2, cy  = sz[ 1 ] / 2
            const off = styleConfig.markerOffset || []
            const ox  = off[ 0 ] || cx, oy = off[ 1 ] || cy
            const x   = ox / sz[ 0 ] - 0.5, y = oy / sz[ 1 ] - 0.5
            point = {
                type: 'point-3d',
                symbolLayers: [ {
                    type:          'icon',
                    size:          Math.max( ...( styleConfig.markerSize as number[] ) ) + 'px',
                    anchor:        'relative',
                    anchorPosition: { x, y },
                    resource: { href: viewer.resolveAttachmentUrl( styleConfig.markerUrl, null, 'png' ) },
                } ],
            }
        } else {
            const sw = styleConfig.strokeWidth  || 3
            const fc = styleConfig.fillColor    || '#3388ff'
            const fo = styleConfig.fillOpacity  || 0.2
            const sc = styleConfig.strokeColor  || '#3388ff'
            const so = styleConfig.strokeOpacity || 1
            point = {
                type: 'point-3d',
                symbolLayers: [ {
                    type:     'icon',
                    size:     sw,
                    resource: { primitive: 'circle' },
                    material: { color: color( fc, fo ) },
                    outline:  { size: 1, color: color( sc, so ) },
                } ],
            }
        }

        const fill: any = { type: 'polygon-3d', symbolLayers: [] }
        if ( styleConfig.fill )
            fill.symbolLayers.push( { type: 'fill', material: { color: color( styleConfig.fillColor, styleConfig.fillOpacity ) } } )
        if ( styleConfig.stroke !== false )
            fill.symbolLayers.push( line.symbolLayers[ 0 ] )

        const styles: any[] = [ { point, polyline: line, polygon: fill } ]

        if ( styleConfig.labelAttribute ) {
            styles.unshift( {
                point: function ( prop: any ) {
                    return {
                        type:            'text',
                        color:           styleConfig.labelColor || 'black',
                        haloColor:       styleConfig.labelBackgroundColor,
                        haloSize:        3,
                        text:            prop[ styleConfig.labelAttribute ] + '\n\n',
                    }
                },
            } )
        }

        return styles

        function color( c: any, a: any ) {
            const ec = new smkRef.TYPE.Esri3d.Color( c )
            ec.a = a
            return ec
        }
    },
} )
