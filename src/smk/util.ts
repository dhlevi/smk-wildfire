/**
 * SMK Utilities
 * Converted from util.js to TypeScript ES module.
 *
 * Original used include.module() and Object.assign(window.SMK.UTIL, {...}).
 * Now exported directly. Backward compat: the UTIL object is merged into
 * window.SMK.UTIL so unconverted modules using SMK.UTIL.xxx still work.
 *
 * Migration note: getProjection() previously relied on include('projections')
 * to lazy-load the proj4 setup. It now assumes proj4 is available as a global
 * (loaded earlier in the entry point). When projections.ts is migrated this
 * can be converted to a direct import.
 */

// ---------------------------------------------------------------------------
// metersPerUnit — declared up front (was a var at the bottom of util.js,
// hoisted by JS var semantics; here we make the ordering explicit).
// ---------------------------------------------------------------------------

const metersPerUnit: Record<string, number> = {
    "Mil":                  2.5399999999999996e-8,
    "MicroInch":            0.0000254,
    "mm":                   0.001,
    "Millimeter":           0.001,
    "cm":                   0.01,
    "Centimeter":           0.01,
    "IInch":                0.0254,
    "us-in":                0.0254000508001016,
    "Inch":                 0.0254000508001016,
    "in":                   0.0254000508001016,
    "inches":               0.0254000508001016,
    "Decimeter":            0.1,
    "ClarkeLink":           0.201166194976,
    "SearsLink":            0.2011676512155,
    "BenoitLink":           0.20116782494375873,
    "IntnlLink":            0.201168,
    "link":                 0.201168,
    "GunterLink":           0.2011684023368047,
    "CapeFoot":             0.3047972615,
    "ClarkeFoot":           0.3047972651151,
    "ind-ft":               0.30479841,
    "IndianFt37":           0.30479841,
    "SearsFoot":            0.30479947153867626,
    "IndianFt75":           0.3047995,
    "IndianFoot":           0.30479951,
    "IndianFt62":           0.3047996,
    "GoldCoastFoot":        0.3047997101815088,
    "IFoot":                0.3048,
    "Foot":                 0.3048006096012192,
    "ft":                   0.3048006096012192,
    "us-ft":                0.3048006096012192,
    "ModAmFt":              0.304812252984506,
    "ind-yd":               0.9143952300000001,
    "IndianYd37":           0.9143952300000001,
    "SearsYard":            0.914398414616029,
    "IndianYd75":           0.9143985000000001,
    "IndianYard":           0.9143985307444409,
    "IndianYd62":           0.9143987999999998,
    "IYard":                0.9143999999999999,
    "Yard":                 0.9144018288036576,
    "yd":                   0.9144018288036576,
    "us-yd":                0.9144018288036576,
    "CaGrid":               0.9997380000000001,
    "m":                    1,
    "Meter":                1,
    "GermanMeter":          1.0000135965,
    "fath":                 1.8287999999999998,
    "Fathom":               1.8287999999999998,
    "Rood":                 3.7782668980000005,
    "Perch":                5.02921005842012,
    "Rod":                  5.02921005842012,
    "Pole":                 5.02921005842012,
    "Dekameter":            10,
    "GunterChain":          20.11684023368047,
    "Furlong":              201.1684023368046,
    "mi":                   1609.3472186944373,
    "nmi":                  1851.9999999999998,
    "KM":                   1000,
    "km":                   1000,
    "NautM":                1852,
}

// ---------------------------------------------------------------------------
// Promise helpers
// ---------------------------------------------------------------------------

export function makePromise<T = any>(
    withFn?: ( resolve: ( value: T ) => void, reject: ( reason?: any ) => void ) => void
): Promise<T> {
    return new Promise( withFn || function () {} )
}

export function resolved<T = any>( ...args: any[] ): Promise<T> {
    return ( Promise.resolve as any ).apply( Promise, args )
}

export function rejected( ...args: any[] ): Promise<never> {
    return ( Promise.reject as any ).apply( Promise, args )
}

export function waitAll<T = any>( promises: Promise<T>[] ): Promise<T[]> {
    return Promise.all( promises )
}

// ---------------------------------------------------------------------------
// Type detection
// ---------------------------------------------------------------------------

export function type( val: unknown ): string {
    const t = typeof val
    if ( t !== 'object' ) return t
    if ( Array.isArray( val ) ) return 'array'
    if ( val === null ) return 'null'
    return 'object'
}

// ---------------------------------------------------------------------------
// Template substitution  (  <%= key %>  syntax )
// ---------------------------------------------------------------------------

export const templatePattern = /<%=\s*(.*?)\s*%>/g

export function templateReplace(
    template: string,
    replacer: ( key: string, match: string ) => string | null | undefined
): string {
    if ( !template ) return template
    if ( !replacer ) return template

    const m = String( template ).match( templatePattern )
    if ( !m ) return template

    const safeReplacer = ( function ( inner: typeof replacer ) {
        return function ( param: string, match: string ): string {
            const r = inner( param, match )
            return r == null ? match : r
        }
    } )( replacer )

    if ( m.length === 1 && m[ 0 ] === template ) {
        templatePattern.lastIndex = 0
        const x = templatePattern.exec( template )!
        return safeReplacer( x[ 1 ], template )
    }

    return String( template ).replace( templatePattern, function ( match, parameterName ) {
        return safeReplacer( parameterName, match )
    } )
}

// ---------------------------------------------------------------------------
// Feature title resolution — used by Identify list, query results, etc.
// Honours
//   cfg.titleFormat — template string with `<%= expr %>` tokens evaluated
//        with `feature`, `properties`, and `value` (the raw titleAttribute
//        value) in scope.  Bare attribute names (e.g. `<%= NAME %>`) are
//        looked up directly on the feature properties as a fast path.
//   cfg.titleAttribute — feature.properties[ titleAttribute ].
//   fallback is standard identify fallback to feature #
// ---------------------------------------------------------------------------

const titleFormatCache: Record<string, ( feature: any, properties: any, value: any ) => any> = {}

export function featureTitle(
    cfg:      { titleAttribute?: string, titleFormat?: string } | null | undefined,
    feature:  any,
    fallback: string
): string {
    const properties = ( feature && feature.properties ) || {}
    const rawValue   = cfg && cfg.titleAttribute ? properties[ cfg.titleAttribute ] : undefined

    if ( cfg && cfg.titleFormat ) {
        try {
            return templateReplace( cfg.titleFormat, function ( token ) {
                if ( token in properties ) return properties[ token ]
                let fn = titleFormatCache[ token ]
                if ( !fn ) {
                    try {
                        // eslint-disable-next-line no-new-func
                        fn = new Function( 'feature', 'properties', 'value', 'return (' + token + ')' ) as any
                        titleFormatCache[ token ] = fn
                    }
                    catch { return null }
                }
                try {
                    const r = fn( feature, properties, rawValue )
                    return r == null ? '' : String( r )
                }
                catch { return null }
            } )
        }
        catch { /* fall through to titleAttribute / fallback */ }
    }

    if ( cfg && cfg.titleAttribute ) return rawValue
    return fallback
}

// ---------------------------------------------------------------------------
// Deep equality
// ---------------------------------------------------------------------------

export function isDeepEqual( a: unknown, b: unknown ): boolean {
    const at = type( a )
    const bt = type( b )

    if ( at !== bt ) return false

    switch ( at ) {
    case 'array': {
        const aa = a as any[]
        const ba = b as any[]
        if ( aa.length !== ba.length ) return false
        for ( let i = 0; i < aa.length; i += 1 )
            if ( !isDeepEqual( aa[ i ], ba[ i ] ) ) return false
        return true
    }
    case 'object': {
        const ao = a as Record<string, unknown>
        const bo = b as Record<string, unknown>
        const ak = Object.keys( ao ).sort()
        const bk = Object.keys( bo ).sort()
        if ( !isDeepEqual( ak, bk ) ) return false
        for ( let i = 0; i < ak.length; i += 1 )
            if ( !isDeepEqual( ao[ ak[ i ] ], bo[ ak[ i ] ] ) ) return false
        return true
    }
    case 'string':
        return a === b
    default:
        return String( a ) === String( b )
    }
}

// ---------------------------------------------------------------------------
// Grammatical number
// ---------------------------------------------------------------------------

export function grammaticalNumber(
    num: number,
    zero: string | null,
    one: string | null,
    many?: string | null
): string {
    if ( one == null ) one = zero
    if ( many == null ) many = one
    switch ( num ) {
    case 0:  return zero == null  ? '' : zero.replace( '{}', String( num ) )
    case 1:  return one  == null  ? '' : one.replace( '{}', String( num ) )
    default: return many == null  ? '' : many.replace( '{}', String( num ) )
    }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export function makeSet( values: string[] ): Record<string, true> {
    return values.reduce( ( accum, v ) => { accum[ v ] = true; return accum }, {} as Record<string, true> )
}

// ---------------------------------------------------------------------------
// Delayed / debounced call
// ---------------------------------------------------------------------------

interface DelayedCallOptions {
    delay?:     number
    context?:   any
    arguments?: any[]
}

interface DelayedCall {
    ( ...args: any[] ): void
    cancel:  () => void
    option:  Required<DelayedCallOptions>
}

export function makeDelayedCall( fn: Function, option?: DelayedCallOptions ): DelayedCall {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const opts: Required<DelayedCallOptions> = Object.assign( {
        delay:      200,
        context:    undefined,
        arguments:  undefined,
    }, option ) as Required<DelayedCallOptions>

    function cancel() {
        if ( timeoutId ) clearTimeout( timeoutId )
        timeoutId = null
    }

    const delayedCall: any = function ( this: any, ...args: any[] ) {
        const ctxt  = opts.context   || this
        const fargs = opts.arguments || args

        cancel()

        timeoutId = setTimeout( function () {
            timeoutId = null
            try {
                fn.apply( ctxt, fargs )
            } catch ( e ) {
                console.warn( 'during makeDelayedCall:', e )
            }
        }, opts.delay )
    }

    delayedCall.cancel = cancel
    delayedCall.option = opts

    return delayedCall as DelayedCall
}

// ---------------------------------------------------------------------------
// CRS extraction
// ---------------------------------------------------------------------------

export function extractCRS( obj: any ): string {
    if ( obj.properties?.name ) return obj.properties.name
    throw new Error( 'unable to determine CRS from: ' + JSON.stringify( obj ) )
}

// ---------------------------------------------------------------------------
// Projection (depends on proj4 global; see migration note at top)
// ---------------------------------------------------------------------------

export function getProjection( name: string ): Promise<( pt: number[] ) => number[]> {
    // TODO (Step 2 follow-up): when projections.ts is migrated, import directly
    // and remove the assumption that proj4 is a pre-loaded global.
    return Promise.resolve().then( function () {
        const proj4 = ( window as any ).proj4
        if ( !proj4 ) throw new Error( 'proj4 is not loaded' )
        const proj = proj4( name )
        if ( !proj ) throw new Error( 'Projection "' + name + '" is not understood' )
        return function ( pt: number[] ) { return proj.inverse( pt ) }
    } )
}

// ---------------------------------------------------------------------------
// GeoJSON reprojection
// ---------------------------------------------------------------------------

export function reprojectGeoJSON( geojson: any, projection: ( c: number[] ) => number[] ): any {
    return traverse.GeoJSON( geojson, {
        coordinate: function ( c: number[] ) { return projection( c ) }
    } )
}

type TraverseCb = { coordinate: ( c: any ) => any }

export const traverse = {
    GeoJSON( geojson: any, cb?: Partial<TraverseCb> ): any {
        const opts: TraverseCb = Object.assign( { coordinate: ( c: any ) => c }, cb )
        return ( this as any )[ geojson.type ]( geojson, opts )
    },
    Point( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, { coordinates: cb.coordinate( obj.coordinates ) } )
    },
    MultiPoint( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, { coordinates: obj.coordinates.map( ( c: any ) => cb.coordinate( c ) ) } )
    },
    LineString( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, { coordinates: obj.coordinates.map( ( c: any ) => cb.coordinate( c ) ) } )
    },
    MultiLineString( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, {
            coordinates: obj.coordinates.map( ( ls: any[] ) => ls.map( ( c: any ) => cb.coordinate( c ) ) )
        } )
    },
    Polygon( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, {
            coordinates: obj.coordinates.map( ( ls: any[] ) => ls.map( ( c: any ) => cb.coordinate( c ) ) )
        } )
    },
    MultiPolygon( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, {
            coordinates: obj.coordinates.map( ( ps: any[][] ) =>
                ps.map( ( ls: any[] ) => ls.map( ( c: any ) => cb.coordinate( c ) ) )
            )
        } )
    },
    GeometryCollection( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, {
            geometries: obj.geometries.map( ( g: any ) => ( traverse as any )[ g.type ]( g, cb ) )
        } )
    },
    FeatureCollection( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, {
            features: obj.features.map( ( f: any ) => ( traverse as any )[ f.type ]( f, cb ) )
        } )
    },
    Feature( obj: any, cb: TraverseCb ) {
        return Object.assign( obj, {
            geometry: ( traverse as any )[ obj.geometry.type ]( obj.geometry, cb )
        } )
    },
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function circlePoints(
    center: { x: number; y: number },
    radius: number,
    segmentCount: number
): [ number, number ][] {
    const points: [ number, number ][] = []
    for ( let i = 0; i <= segmentCount; i += 1 )
        points.push( [
            center.x + radius * Math.cos( 2 * Math.PI * i / segmentCount ),
            center.y + radius * Math.sin( 2 * Math.PI * i / segmentCount ),
        ] )
    return points
}

// ---------------------------------------------------------------------------
// BC Geocoder — findNearestSite
// Converted from $.ajax to fetch.
// ---------------------------------------------------------------------------

interface NearestSiteResult {
    longitude:          number
    latitude:           number
    civicNumber:        string
    civicNumberSuffix:  string
    fullAddress:        string
    localityName:       string
    localityType:       string
    streetName:         string
    streetType:         string
}

export function findNearestSite( location: { longitude: number; latitude: number } ): Promise<NearestSiteResult | typeof location> {
    const params = new URLSearchParams( {
        point:              [ location.longitude, location.latitude ].join( ',' ),
        outputSRS:          '4326',
        locationDescriptor: 'routingPoint',
        maxDistance:        '1000',
    } )

    return fetch( 'https://geocoder.api.gov.bc.ca/sites/nearest.geojson?' + params.toString(), {
        signal: AbortSignal.timeout( 10_000 ),
    } )
        .then( res => {
            if ( !res.ok ) throw new Error( 'Geocoder returned ' + res.status )
            return res.json()
        } )
        .then( ( data: any ): NearestSiteResult => ( {
            longitude:          data.geometry.coordinates[ 0 ],
            latitude:           data.geometry.coordinates[ 1 ],
            civicNumber:        data.properties.civicNumber,
            civicNumberSuffix:  data.properties.civicNumberSuffix,
            fullAddress:        data.properties.fullAddress,
            localityName:       data.properties.localityName,
            localityType:       data.properties.localityType,
            streetName:         data.properties.streetName,
            streetType:         data.properties.streetType,
        } ) )
        .catch( ( err: any ) => {
            console.warn( err )
            return location
        } )
}

// ---------------------------------------------------------------------------
// Function wrapping
// ---------------------------------------------------------------------------

export function wrapFunction( obj: any, fName: string, outer: ( inner: Function ) => Function ): Function {
    return ( obj[ fName ] = ( function ( inner: Function ) {
        return outer.call( null, inner )
    } )( obj[ fName ] ) )
}

// ---------------------------------------------------------------------------
// Async reduce
// ---------------------------------------------------------------------------

export function asyncReduce<T = any>(
    cb: ( accum: T, done: ( result: T ) => T ) => Promise<T>,
    accum: T
): Promise<T> {
    return resolved<T>()
        .then( () => accum )
        .then( ( arg ) => {
            let done = false
            return cb( arg, ( res ) => { done = true; return res } )
                .then( ( res ) => {
                    if ( done ) return res
                    return asyncReduce( cb, res )
                } )
        } )
}

// ---------------------------------------------------------------------------
// Object projection (key picker)
// ---------------------------------------------------------------------------

export function projection( ...keys: string[] ): ( obj: Record<string, any> ) => Record<string, any> {
    return function ( obj ) {
        return keys.reduce( ( accum, k ) => {
            if ( k in obj ) accum[ k ] = obj[ k ]
            return accum
        }, {} as Record<string, any> )
    }
}

// ---------------------------------------------------------------------------
// ID / UUID generation
// ---------------------------------------------------------------------------

export function makeId( ...parts: ( string | number | undefined )[] ): string {
    return parts
        .filter( v => v !== undefined )
        .map( v => String( v ).toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^[-]|[-]$/g, '' ) )
        .map( v => v ? v : '~' )
        .join( '=' )
}

export function makeUUID(): string {
    let d = new Date().getTime()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, function ( c ) {
        const r = ( d + Math.random() * 16 ) % 16 | 0
        d = Math.floor( d / 16 )
        return ( c === 'x' ? r : ( r & 0x3 | 0x8 ) ).toString( 16 )
    } )
}

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

export function getMetersPerUnit( unit: string ): number {
    if ( !( unit in metersPerUnit ) )
        throw new Error( unit + ' is an unknown unit' )
    return metersPerUnit[ unit ]
}

// ---------------------------------------------------------------------------
// Mutex — prevents concurrent async operations (e.g. identify)
// ---------------------------------------------------------------------------

interface MutexLock {
    name:    string
    held:    () => boolean
    release: () => void
}

export function makeMutex( name: string ): () => MutexLock {
    const mutex: ( boolean | undefined )[] = []
    return function acquire() {
        for ( let i = 0; i < mutex.length; i += 1 ) delete mutex[ i ]
        const idx = mutex.length
        mutex[ idx ] = true
        return {
            name,
            held:    () => !!mutex[ idx ],
            release: () => { delete mutex[ idx ] },
        }
    }
}

// ---------------------------------------------------------------------------
// UTIL namespace object — matches the shape of the old window.SMK.UTIL
// ---------------------------------------------------------------------------

export const UTIL = {
    makePromise,
    resolved,
    rejected,
    waitAll,
    type,
    templatePattern,
    templateReplace,
    isDeepEqual,
    grammaticalNumber,
    makeSet,
    makeDelayedCall,
    extractCRS,
    getProjection,
    reprojectGeoJSON,
    traverse,
    circlePoints,
    findNearestSite,
    wrapFunction,
    asyncReduce,
    projection,
    makeId,
    makeUUID,
    getMetersPerUnit,
    makeMutex,
}

// Backward compat: merge into window.SMK.UTIL so unconverted modules that
// reference SMK.UTIL.xxx continue to work without modification.
if ( typeof window !== 'undefined' && window.SMK ) {
    Object.assign( window.SMK.UTIL, UTIL )
}

export default UTIL
