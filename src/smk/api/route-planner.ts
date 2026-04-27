/**
 * RoutePlanner — BC Route Planner API wrapper.
 * Converted from api/route-planner.js.
 */

declare const $: any
declare const turf: any

const smkRef = ( window as any ).SMK

function RoutePlanner( this: any, config: any ) {
    Object.assign( this, {
        url:    'https://router.api.gov.bc.ca/',
        apiKey: null
    }, config )
}

RoutePlanner.prototype.fetchDirections = function ( points: any[], option?: any ) {
    const self = this

    if ( this.request ) this.request.abort()

    const mode = Object.assign( {
        optimal:  false,
        truck:    false,
        oversize: false,
    }, option )

    option = Object.assign( {
        criteria:             'shortest',
        roundTrip:            false,
        correctSide:          null,
        height:               null,
        weight:               null,
        distanceUnits:        'km',
        followTruckRoute:     null,
        truckRouteMultiplier: null,
        disable:              null,
        outputSRS:            4326,
        partition:            mode.truck ? 'isFerry,isTruckRoute,locality' : '',
    }, option )
    delete option.optimal
    delete option.truck
    delete option.oversize

    const endPoint = [
        'directions',
        'optimalDirections',
        'truck/directions',
        'truck/optimalDirections',
    ][ ( !!mode.optimal ? 1 : 0 ) + 2 * ( !!mode.truck ? 1 : 0 ) ] + '.json'

    const query: any = Object.keys( option ).reduce( function ( accum: any, key: string ) {
        if ( option[ key ] ) accum[ key ] = option[ key ]
        return accum
    }, {} )
    query.points = points.map( function ( w: any ) { return w.longitude + ',' + w.latitude } ).join( ',' )

    const ajaxOpt: any = {
        timeout:  10 * 1000,
        dataType: 'json',
        url:      this.url + endPoint,
        data:     query,
        headers:  { apikey: this.apiKey }
    }

    return smkRef.UTIL.makePromise( function ( res: any, rej: any ) {
        ( self.request = $.ajax( ajaxOpt ) ).then( res, rej )
    } )
    .then( function ( data: any ) {
        if ( !data.routeFound ) throw new Error( 'failed to find route' )

        function getDirections( pt: any ) {
            return data.directions.filter( function ( dr: any ) {
                return close( dr.point, pt, 0.00001 )
            } )
        }

        if ( data.directions ) {
            data.directions = data.directions.map( function ( dir: any ) {
                if ( dir.distance != null ) {
                    dir.distanceUnit = appropriateUnit( dir.distance * 1000 )
                    return dir
                }

                dir.instruction = dir.text.replace( /^"|"$/g, '' ).replace(
                    /\s(?:for|and travel)\s((?:\d+.?\d*\s)?k?m)\s[(](\d+).+?((\d+).+)?$/,
                    function ( _m: string, _a: string, b: string, _c: string, d: string ) {
                        dir.distanceUnit = { value: dir.distance, unit: '' }
                        dir.time = d ? parseInt( b ) * 60 + parseInt( d ) : parseInt( b )
                        return ''
                    }
                )

                return dir
            } )
        }

        if ( data.route ) {
            if ( data.partitions ) {
                const routeLen = data.route.length
                let len = data.partitions.length

                if ( data.partitions[ len - 1 ].index < ( routeLen - 1 ) ) {
                    data.partitions.push( { index: routeLen - 1 } )
                    len += 1
                }

                data.segments = []
                for ( let pi = 1; pi < len; pi += 1 ) {
                    const prop = data.partitions[ pi - 1 ]
                    prop.isOversize = !!mode.oversize
                    data.segments.push( turf.lineString(
                        data.route.slice( prop.index, data.partitions[ pi ].index + 1 ),
                        prop
                    ) )
                }
            }
            else {
                data.segments = [ turf.lineString( data.route, { index: 0 } ) ]
            }

            data.segments = turf.featureCollection( data.segments )
            data.segments.properties = { isOversize: !!mode.oversize }

            const routeAttrs: any[] = data.route.map( function () { return { segs: {} } } )

            data.segments.features.forEach( function ( sg: any, i: number ) {
                for ( let j = 0; j < sg.geometry.coordinates.length; j += 1 ) {
                    const ri = j + sg.properties.index
                    routeAttrs[ ri ].segs[ i ] = true
                    routeAttrs[ ri ].dirs  = getDirections( data.route[ ri ] )
                    routeAttrs[ ri ].index = ri

                    for ( let k = 0; k < routeAttrs[ ri ].dirs.length; k += 1 )
                        routeAttrs[ ri ].dirs[ k ].segmentIndex = i
                }
            } )

            const problems = routeAttrs.filter( function ( ra: any ) {
                return Object.keys( ra.segs ).length > 1 && ra.dirs.length === 0
            } )

            if ( problems.length > 0 ) {
                problems.forEach( function ( p: any ) {
                    p.dirs = [ {
                        type:         'CONTINUE',
                        point:        JSON.parse( JSON.stringify( data.route[ p.index ] ) ),
                        segmentIndex: Math.max( ...Object.keys( p.segs ).map( Number ) )
                    } ]
                } )

                data.directions = routeAttrs
                    .map( function ( ra: any ) { return ra.dirs } )
                    .filter( function ( d: any ) { return !!d } )
                    .reduce( function ( acc: any[], v: any[] ) { return acc.concat( v ) }, [] )
            }
        }

        data.request = ajaxOpt

        return data
    } )
}

function appropriateUnit( m: number ) {
    if ( m <= 500 ) return { value: m, unit: 'meters' }
    return { value: m, unit: 'kilometers' }
}

function close( p1: number[], p2: number[], min: number ) {
    const d0 = p1[ 0 ] - p2[ 0 ]
    const d1 = p1[ 1 ] - p2[ 1 ]
    return ( d0 * d0 + d1 * d1 ) <= ( min * min )
}

smkRef.TYPE.RoutePlanner = RoutePlanner
export default RoutePlanner
