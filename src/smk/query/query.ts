/**
 * SMK Query — base class + all concrete query types
 * Converted from query/query.js and query/query-*.js to TypeScript ES module.
 *
 * Depends (converted): event.ts, util.ts
 *
 * Structure:
 *   QueryParameter          — base parameter descriptor
 *   QueryParameter.constant
 *   QueryParameter.input
 *   QueryParameter.select
 *   QueryParameter['select-unique']
 *
 *   Query                   — base query (class + namespace merge)
 *   Query.vector            — predicate-based in-memory JS filter
 *   Query.wms               — CQL / WFS HTTP query
 *   Query['esri-dynamic']   — ESRI ArcGIS dynamic-layer REST query
 *   Query['esri-feature']   — ESRI ArcGIS feature-service REST query
 *   Query.place             — BC Geocoder address search
 *
 * Backward compat: SMK.TYPE.Query and SMK.TYPE.QueryParameter are set at bottom.
 */

import { SMKEvent }             from '../event'
import { makePromise, resolved, asyncReduce } from '../util'

// ---------------------------------------------------------------------------
// Predicate / parameter types shared by all query types
// ---------------------------------------------------------------------------

export interface PredicateArg {
    operator?:  string
    operand?:   string
    name?:      string
    id?:        string
    arguments?: PredicateArg[]
    [key: string]: unknown
}

export interface QueryConfig {
    id:          string
    type?:       string
    title?:      string
    parameters?: ParameterConfig[]
    predicate?:  PredicateArg
    [key: string]: unknown
}

export interface ParameterConfig {
    id:   string
    type: string
    title?: string
    value?: unknown
    uniqueAttribute?: string
    [key: string]: unknown
}

export interface QueryCallConfig {
    within?: boolean
    option?: Record<string, unknown>
}

export interface ParamMap {
    [paramId: string]: {
        value: unknown
        [key: string]: unknown
    }
}

// ---------------------------------------------------------------------------
// QueryParameter — base
// ---------------------------------------------------------------------------

export class QueryParameter {
    id:        string
    layerId:   string
    component: string
    prop:      Record<string, any>
    initial:   unknown

    constructor( query: Query, config: ParameterConfig ) {
        this.id        = query.id + '--' + config.id
        this.layerId   = query.layerId
        this.component = 'parameter-' + config.type
        this.prop      = Object.assign( { value: null, focus: 0 }, config )
        this.initial   = config.value
    }

    mounted(): void {}
    focus(): void {}
}

export namespace QueryParameter {
    export class constant extends QueryParameter {
        constructor( query: Query, config: ParameterConfig, _viewer?: any ) {
            super( query, config )
        }
    }

    export class input extends QueryParameter {
        constructor( query: Query, config: ParameterConfig, _viewer?: any ) {
            super( query, config )
        }
        focus(): void {
            this.prop.focus += 1
        }
    }

    export class select extends QueryParameter {
        constructor( query: Query, config: ParameterConfig, _viewer?: any ) {
            super( query, config )
        }
    }
}

// 'select-unique' has a hyphen so we can't use namespace syntax directly.
// Declare the class, then assign to the namespace object.
class SelectUniqueParameter extends QueryParameter {
    constructor( query: Query, config: ParameterConfig, viewer?: any ) {
        const uniqueAttribute = config.uniqueAttribute
        const cfgCopy: ParameterConfig = Object.assign( {}, config, { type: 'select' } )
        delete ( cfgCopy as any ).uniqueAttribute

        super( query, cfgCopy )

        const self = this
        let fetchUnique: Promise<any> | undefined

        this.mounted = function () {
            if ( fetchUnique ) return
            fetchUnique = query.fetchUniqueValues( uniqueAttribute!, viewer )
                .then( ( values: unknown[] ) => {
                    self.prop.choices = values
                        .map( v => ( { value: v } ) )
                        .sort( ( a, b ) => ( a.value > b.value ? 1 : -1 ) )
                } )
                .catch( ( e: unknown ) => {
                    console.warn( e )
                    self.prop.useFallback = true
                } )
        }
    }
}

( QueryParameter as any )[ 'select-unique' ] = SelectUniqueParameter

// ---------------------------------------------------------------------------
// QueryEvent
// ---------------------------------------------------------------------------

const QueryEvent = SMKEvent.define( [] )

// ---------------------------------------------------------------------------
// Query — base class
// ---------------------------------------------------------------------------

export class Query {
    id:          string
    layerId:     string
    title?:      string
    parameters?: ParameterConfig[]
    predicate?:  PredicateArg

    constructor( layerId: string, config: QueryConfig ) {
        QueryEvent.prototype.constructor.call( this )

        Object.assign( this, config )
        this.layerId = layerId
        this.id      = this.layerId + '--' + this.id
    }

    getParameters( viewer: any ): QueryParameter[] {
        return ( this.parameters || [] ).map( p =>
            new ( QueryParameter as any )[ p.type ]( this, p, viewer )
        )
    }

    queryLayer( _param: ParamMap, _config: QueryCallConfig, _viewer: any ): Promise<any[]> {
        console.log( 'not implemented', _param )
        return resolved( [] )
    }

    fetchUniqueValues( _attribute: string, _viewer: any ): Promise<unknown[]> {
        console.log( 'not implemented', _attribute )
        return resolved( [] )
    }

    canUseWithExtent( _viewer: any ): boolean {
        return true
    }
}

Query.prototype.maxUniqueValues = 100

Object.setPrototypeOf( Query.prototype, QueryEvent.prototype )
Query.prototype.constructor = Query as any

// ---------------------------------------------------------------------------
// Helper — GET request (replaces $.ajax GET + makePromise)
// ---------------------------------------------------------------------------

function fetchGet( url: string, params: Record<string, unknown> ): Promise<any> {
    const qs = new URLSearchParams(
        Object.entries( params ).map( ( [ k, v ] ) => [ k, String( v ) ] )
    ).toString()
    return fetch( `${ url }?${ qs }` )
        .then( r => {
            if ( !r.ok ) throw new Error( `Request failed: ${ r.status } ${ r.statusText }` )
            return r.json()
        } )
}

// Helper — POST request with form-encoded body
function fetchPost( url: string, params: Record<string, unknown> ): Promise<any> {
    const body = new URLSearchParams(
        Object.entries( params ).map( ( [ k, v ] ) => [ k, String( v ) ] )
    )
    return fetch( url, { method: 'POST', body } )
        .then( r => {
            if ( !r.ok ) throw new Error( `Request failed: ${ r.status } ${ r.statusText }` )
            return r.json()
        } )
}

// ---------------------------------------------------------------------------
// Shared predicate SQL WHERE clause builder
// ---------------------------------------------------------------------------

type StringMapper = ( predicate: PredicateArg, param: ParamMap, quote?: boolean ) => string | undefined

function makeWhereClauseBuilder( operandHandlers: Record<string, StringMapper> ) {
    const operators: Record<string, ( args: PredicateArg[], param: ParamMap ) => string | undefined> = {
        'and': ( args, param ) => {
            if ( args.length === 0 ) throw new Error( 'AND needs at least 1 argument' )
            const parts = args.map( a => {
                const c = handleOp( a, param )
                return c ? `( ${ c } )` : undefined
            } ).filter( Boolean )
            return parts.length ? parts.join( ' AND ' ) : undefined
        },
        'or': ( args, param ) => {
            if ( args.length === 0 ) throw new Error( 'OR needs at least 1 argument' )
            const parts = args.map( a => {
                const c = handleOp( a, param )
                return c ? `( ${ c } )` : undefined
            } ).filter( Boolean )
            return parts.length ? parts.join( ' OR ' ) : undefined
        },
        'equals': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'EQUALS needs exactly 2 arguments' )
            const a = handleOperand( args[ 0 ], param )
            const b = handleOperand( args[ 1 ], param )
            return ( a && b ) ? `${ a } = ${ b }` : undefined
        },
        'less-than': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'LESS-THAN needs exactly 2 arguments' )
            const a = handleOperand( args[ 0 ], param )
            const b = handleOperand( args[ 1 ], param )
            return ( a && b ) ? `${ a } < ${ b }` : undefined
        },
        'greater-than': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'GREATER-THAN needs exactly 2 arguments' )
            const a = handleOperand( args[ 0 ], param )
            const b = handleOperand( args[ 1 ], param )
            return ( a && b ) ? `${ a } > ${ b }` : undefined
        },
        'contains': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'CONTAINS needs exactly 2 arguments' )
            const a = handleOperand( args[ 0 ], param )
            const b = handleOperand( args[ 1 ], param, false )
            return ( a && b ) ? `${ a } ${ operandHandlers[ 'LIKE' ] ? 'ILIKE' : 'LIKE' } '%${ b }%'` : undefined
        },
        'starts-with': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'STARTS-WITH needs exactly 2 arguments' )
            const a = handleOperand( args[ 0 ], param )
            const b = handleOperand( args[ 1 ], param, false )
            return ( a && b ) ? `${ a } ${ operandHandlers[ 'LIKE' ] ? 'ILIKE' : 'LIKE' } '${ b }%'` : undefined
        },
        'ends-with': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'ENDS-WITH needs exactly 2 arguments' )
            const a = handleOperand( args[ 0 ], param )
            const b = handleOperand( args[ 1 ], param, false )
            return ( a && b ) ? `${ a } ${ operandHandlers[ 'LIKE' ] ? 'ILIKE' : 'LIKE' } '%${ b }'` : undefined
        },
        'not': ( args, param ) => {
            if ( args.length !== 1 ) throw new Error( 'NOT needs exactly 1 argument' )
            const a = handleOp( args[ 0 ], param )
            return a ? `NOT ${ a }` : undefined
        },
    }

    function handleOp( pred: PredicateArg, param: ParamMap ): string | undefined {
        if ( !pred.operator || !( pred.operator in operators ) )
            throw new Error( `unknown operator: ${ JSON.stringify( pred ) }` )
        return operators[ pred.operator ]( pred.arguments || [], param )
    }

    function handleOperand( pred: PredicateArg, param: ParamMap, quote?: boolean ): string | undefined {
        if ( !pred.operand || !( pred.operand in operandHandlers ) )
            throw new Error( `unknown operand: ${ JSON.stringify( pred ) }` )
        return operandHandlers[ pred.operand ]( pred, param, quote )
    }

    return handleOp
}

// CQL (WMS) clause builder — attribute names unquoted, values single-quoted, ILIKE
const makeCqlClause = makeWhereClauseBuilder( {
    'LIKE': () => 'ILIKE',   // sentinel to pick ILIKE
    'attribute': ( arg, _param, quote ) => {
        if ( quote === false )
            return `' || ${ arg.name } || '`
        return arg.name
    },
    'parameter': ( arg, param, quote ) => {
        const v = param[ arg.id! ]?.value
        if ( v == null || v === '' ) return undefined
        return ( quote === false ? '' : "'" ) + escapeSql( String( v ) ) + ( quote === false ? '' : "'" )
    },
} )

// SQL WHERE (ESRI) clause builder — similar but uses LIKE (not ILIKE)
const makeWhereClause = makeWhereClauseBuilder( {
    'attribute': ( arg, _param, quote ) => {
        if ( quote === false )
            return `' || ${ arg.name } || '`
        return arg.name
    },
    'parameter': ( arg, param, quote ) => {
        const v = param[ arg.id! ]?.value
        if ( v == null || v === '' ) return undefined
        return ( quote === false ? '' : "'" ) + escapeSql( String( v ) ) + ( quote === false ? '' : "'" )
    },
} )

function escapeSql( s: string ): string { return s }   // placeholder — no-op matching original

// ---------------------------------------------------------------------------
// Shared unique-value fetcher used by ESRI types
// ---------------------------------------------------------------------------

function buildExcludeFilter( excludes: unknown[], attribute: string ): string {
    const notNullExcludes = excludes.filter( v => v != null )
    let filter = '(1=1)'
    if ( excludes.length !== notNullExcludes.length )
        filter = `( ${ attribute } IS NOT NULL )`
    if ( notNullExcludes.length > 0 )
        filter += ` AND ${ attribute } NOT IN ( ${ notNullExcludes.map( x => `'${ x }'` ).join( ', ' ) } )`
    return filter
}

function extractUniqueValues( data: any, attribute: string ): unknown[] {
    if ( !data?.features?.length ) return []
    const value: Record<string, true> = {}
    let hasNull = false
    data.features.forEach( ( f: any ) => {
        if ( f.properties[ attribute ] == null ) hasNull = true
        else value[ f.properties[ attribute ] ] = true
    } )
    return Object.keys( value ).concat( hasNull ? [ null as any ] : [] )
}

// ---------------------------------------------------------------------------
// Query.vector — in-memory predicate-based filter
// ---------------------------------------------------------------------------

export namespace Query {
    export class vector extends Query {
        canUseWithExtent( _viewer: any ): boolean {
            return false
        }

        fetchUniqueValues( attribute: string, viewer: any ): Promise<unknown[]> {
            const value: Record<string, true> = {}
            let hasNull = false
            viewer.visibleLayer[ this.layerId ].eachLayer( ( ly: any ) => {
                if ( ly.feature.properties[ attribute ] == null ) hasNull = true
                else value[ ly.feature.properties[ attribute ] ] = true
            } )
            return resolved( Object.keys( value ).concat( hasNull ? [ null as any ] : [] ) )
        }

        queryLayer( param: ParamMap, config: QueryCallConfig, viewer: any ): Promise<any[]> {
            const layerConfig = viewer.layerId[ this.layerId ].config

            const test = makeVectorTest( this.predicate!, param )
            if ( !test ) throw new Error( 'test is empty' )

            const testGeometry = config.within
                ? ( geometry: any ) => overlapsExtent( viewer.getView().extent, geometry )
                : () => true

            const features: any[] = []
            viewer.visibleLayer[ this.layerId ].eachLayer( ( ly: any ) => {
                if ( test( ly.feature.properties ) && testGeometry( ly.feature.geometry ) )
                    features.push( ly.feature )
            } )

            return resolved( features )
                .then( ( feats: any[] ) => {
                    if ( !feats?.length ) throw new Error( 'no results' )
                    return feats.map( ( f, i ) => {
                        f.title = layerConfig.titleAttribute
                            ? f.properties[ layerConfig.titleAttribute ]
                            : `Feature #${ i + 1 }`
                        return f
                    } )
                } )
        }
    }

    // -------------------------------------------------------------------------
    // Query.wms — WFS + CQL filter
    // -------------------------------------------------------------------------

    export class wms extends Query {
        canUseWithExtent( viewer: any ): boolean {
            return !!viewer.layerId[ this.layerId ].config.geometryAttribute
        }

        fetchUniqueValues( attribute: string, viewer: any ): Promise<unknown[]> {
            const self = this
            const layerConfig = viewer.layerId[ this.layerId ].config
            const typeName    = layerConfig.layerName
            const serviceUrl  = layerConfig.serviceUrl

            return asyncReduce( ( accum: unknown[], done: ( v?: unknown ) => void ) =>
                fetchWmsUniqueValues( accum, serviceUrl, typeName, attribute )
                    .then( values => {
                        if ( !values?.length ) return done( accum )
                        const a = ( accum as unknown[] ).concat( values )
                        if ( a.length >= self.maxUniqueValues ) done()
                        return a
                    } )
            , [] )
        }

        queryLayer( param: ParamMap, config: QueryCallConfig, viewer: any ): Promise<any[]> {
            const layerConfig = viewer.layerId[ this.layerId ].config

            const filter = makeCqlClause( this.predicate!, param )
            if ( !filter ) throw new Error( 'filter is empty' )

            const data: Record<string, unknown> = Object.assign( {
                service:      'WFS',
                version:      '1.1.0',
                request:      'GetFeature',
                srsName:      'EPSG:4326',
                typename:     layerConfig.layerName,
                outputformat: 'application/json',
                cql_filter:   filter,
            }, ( param as any ).option || {} )

            if ( config.within && layerConfig.geometryAttribute ) {
                data.cql_filter = `( ${ data.cql_filter } ) AND BBOX( ${ layerConfig.geometryAttribute }, ${ viewer.getView().extent.join( ', ' ) }, 'EPSG:4326' )`
            }

            return fetchGet( layerConfig.serviceUrl, data )
                .then( ( d: any ) => {
                    if ( !d?.features?.length ) throw new Error( 'no features' )
                    return d.features.map( ( f: any, i: number ) => {
                        f.title = layerConfig.titleAttribute
                            ? f.properties[ layerConfig.titleAttribute ]
                            : `Feature #${ i + 1 }`
                        return f
                    } )
                } )
        }
    }

    // -------------------------------------------------------------------------
    // Query.esriDynamic (exposed as Query['esri-dynamic'])
    // -------------------------------------------------------------------------

    export class esriDynamic extends Query {
        fetchUniqueValues( attribute: string, viewer: any ): Promise<unknown[]> {
            const self = this
            const layerConfig  = viewer.layerId[ this.layerId ].config
            const dynamicLayer = JSON.parse( layerConfig.dynamicLayers[ 0 ] )
            const serviceUrl   = layerConfig.serviceUrl + '/dynamicLayer/query'
            delete dynamicLayer.drawingInfo

            return asyncReduce( ( accum: unknown[], done: ( v?: unknown ) => void ) =>
                fetchEsriUniqueValues( accum, serviceUrl, attribute, true, dynamicLayer )
                    .then( values => {
                        if ( !values?.length ) return done( accum )
                        const a = ( accum as unknown[] ).concat( values )
                        if ( a.length >= self.maxUniqueValues ) done()
                        return a
                    } )
            , [] )
        }

        queryLayer( param: ParamMap, config: QueryCallConfig, viewer: any ): Promise<any[]> {
            const layerConfig = viewer.layerId[ this.layerId ].config
            if ( layerConfig.dynamicLayers.length !== 1 )
                throw new Error( 'more than one dynamic layer def' )

            const serviceUrl   = layerConfig.serviceUrl + '/dynamicLayer/query'
            const dynamicLayer = JSON.parse( layerConfig.dynamicLayers[ 0 ] )
            delete dynamicLayer.drawingInfo

            const whereClause = makeWhereClause( this.predicate!, param )
            if ( !whereClause ) throw new Error( 'filter is empty' )

            const data: Record<string, unknown> = {
                f:                    'geojson',
                layer:                JSON.stringify( dynamicLayer ).replace( /^"|"$/g, '' ),
                where:                whereClause,
                outFields:            '*',
                inSR:                 4326,
                outSR:                4326,
                returnGeometry:       true,
                returnZ:              false,
                returnM:              false,
                returnIdsOnly:        false,
                returnCountOnly:      false,
                returnDistinctValues: false,
            }

            if ( config.within ) {
                data.geometry     = viewer.getView().extent.join( ',' )
                data.geometryType = 'esriGeometryEnvelope'
                data.spatialRel   = 'esriSpatialRelIntersects'
            }

            return fetchPost( serviceUrl, data )
                .then( ( d: any ) => {
                    if ( !d?.features?.length ) throw new Error( 'no features' )
                    return d.features.map( ( f: any, i: number ) => {
                        f.title = layerConfig.titleAttribute
                            ? f.properties[ layerConfig.titleAttribute ]
                            : `Feature #${ i + 1 }`
                        return f
                    } )
                } )
        }
    }

    // -------------------------------------------------------------------------
    // Query.esriFeature (exposed as Query['esri-feature'])
    // -------------------------------------------------------------------------

    export class esriFeature extends Query {
        fetchUniqueValues( attribute: string, viewer: any ): Promise<unknown[]> {
            const self = this
            const layerConfig = viewer.layerId[ this.layerId ].config
            const serviceUrl  = layerConfig.serviceUrl + '/query'

            return asyncReduce( ( accum: unknown[], done: ( v?: unknown ) => void ) =>
                fetchEsriUniqueValues( accum, serviceUrl, attribute, false )
                    .then( values => {
                        if ( !values?.length ) return done( accum )
                        const a = ( accum as unknown[] ).concat( values )
                        if ( a.length >= self.maxUniqueValues ) done()
                        return a
                    } )
            , [] )
        }

        queryLayer( param: ParamMap, config: QueryCallConfig, viewer: any ): Promise<any[]> {
            const layerConfig = viewer.layerId[ this.layerId ].config
            const serviceUrl  = layerConfig.serviceUrl + '/query'

            const whereClause = makeWhereClause( this.predicate!, param )
            if ( !whereClause ) throw new Error( 'filter is empty' )

            const data: Record<string, unknown> = {
                f:                    'geojson',
                where:                whereClause,
                outFields:            '*',
                inSR:                 4326,
                outSR:                4326,
                returnGeometry:       true,
                returnZ:              false,
                returnM:              false,
                returnIdsOnly:        false,
                returnCountOnly:      false,
                returnDistinctValues: false,
            }

            if ( config.within ) {
                data.geometry     = viewer.getView().extent.join( ',' )
                data.geometryType = 'esriGeometryEnvelope'
                data.spatialRel   = 'esriSpatialRelIntersects'
            }

            return fetchPost( serviceUrl, data )
                .then( ( d: any ) => {
                    if ( !d?.features?.length ) throw new Error( 'no features' )
                    return d.features.map( ( f: any, i: number ) => {
                        f.title = layerConfig.titleAttribute
                            ? f.properties[ layerConfig.titleAttribute ]
                            : `Feature #${ i + 1 }`
                        return f
                    } )
                } )
        }
    }

    // -------------------------------------------------------------------------
    // Query.place — BC Geocoder
    // -------------------------------------------------------------------------

    export class place extends Query {
        constructor( layerId: string, _config?: Partial<QueryConfig> ) {
            super( layerId, {
                id:         'place',
                type:       'place',
                title:      'Location',
                parameters: [ {
                    id:    'param1',
                    type:  'input',
                    title: 'Place or road name',
                } ],
            } )
        }

        canUseWithExtent( _viewer: any ): boolean { return false }

        queryLayer( param: ParamMap, _config: QueryCallConfig, _viewer: any ): Promise<any[]> {
            const self = this

            const qs = new URLSearchParams( {
                ver:           '1.2',
                maxResults:    '20',
                outputSRS:     '4326',
                addressString: String( param.param1?.value ?? '' ),
                autoComplete:  'true',
            } )

            return fetch( `https://apps.gov.bc.ca/pub/geocoder/addresses.geojson?${ qs }` )
                .then( r => {
                    if ( !r.ok ) throw new Error( `Geocoder request failed: ${ r.status }` )
                    return r.json()
                } )
                .then( ( data: any ) => {
                    if ( !data?.features?.length ) throw new Error( 'no features' )

                    const features = data.features
                        .map( ( feature: any ) => {
                            if ( !feature.geometry?.coordinates ) return null
                            if ( feature.properties.fullAddress === 'BC' ) return null
                            feature.radius = self.getAddressRadius( feature.properties )
                            feature.title  = feature.properties.fullAddress
                            return feature
                        } )
                        .filter( Boolean )

                    if ( !features.length ) throw new Error( 'no features' )
                    return features
                } )
        }

        getAddressRadius( address: { matchPrecision?: string } ): number {
            switch ( address.matchPrecision ) {
                case 'STREET':         return 500
                case 'INTERSECTION':
                case 'BLOCK':
                case 'CIVIC_NUMBER':   return 100
                default:               return 1000
            }
        }
    }
}

// Expose hyphenated names for runtime dispatch (Query['esri-dynamic'] etc.)
;( Query as any )[ 'esri-dynamic' ] = Query.esriDynamic
;( Query as any )[ 'esri-feature' ] = Query.esriFeature

// ---------------------------------------------------------------------------
// Vector predicate helpers (in-memory JS filter)
// ---------------------------------------------------------------------------

type PropertyTest = ( properties: Record<string, unknown> ) => boolean

function makeVectorTest( predicate: PredicateArg, param: ParamMap ): PropertyTest | undefined {
    return makeVectorOperator( predicate, param )
}

function makeVectorOperator( predicate: PredicateArg, param: ParamMap ): PropertyTest | undefined {
    const operators: Record<string, ( args: PredicateArg[], param: ParamMap ) => PropertyTest | undefined> = {
        'and': ( args, param ) => {
            if ( args.length === 0 ) throw new Error( 'AND needs 1 or more arguments' )
            const tests = args.map( a => makeVectorOperator( a, param ) ).filter( Boolean ) as PropertyTest[]
            if ( !tests.length ) return undefined
            return props => tests.every( t => t( props ) )
        },
        'or': ( args, param ) => {
            if ( args.length === 0 ) throw new Error( 'OR needs 1 or more arguments' )
            const tests = args.map( a => makeVectorOperator( a, param ) ).filter( Boolean ) as PropertyTest[]
            if ( !tests.length ) return undefined
            return props => tests.some( t => t( props ) )
        },
        'equals': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'EQUALS needs exactly 2 arguments' )
            const a = makeVectorOperand( args[ 0 ], param )
            const b = makeVectorOperand( args[ 1 ], param )
            if ( !a || !b ) return undefined
            return props => a( props ) == b( props )
        },
        'less-than': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'LESS-THAN needs exactly 2 arguments' )
            const a = makeVectorOperand( args[ 0 ], param )
            const b = makeVectorOperand( args[ 1 ], param )
            if ( !a || !b ) return undefined
            return props => ( a( props ) as any ) < ( b( props ) as any )
        },
        'greater-than': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'GREATER-THAN needs exactly 2 arguments' )
            const a = makeVectorOperand( args[ 0 ], param )
            const b = makeVectorOperand( args[ 1 ], param )
            if ( !a || !b ) return undefined
            return props => ( a( props ) as any ) > ( b( props ) as any )
        },
        'contains': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'CONTAINS needs exactly 2 arguments' )
            const a = makeVectorOperand( args[ 0 ], param )
            const b = makeVectorOperand( args[ 1 ], param )
            if ( !a || !b ) return undefined
            return props => new RegExp( String( b( props ) ), 'i' ).test( String( a( props ) ) )
        },
        'starts-with': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'STARTS-WITH needs exactly 2 arguments' )
            const a = makeVectorOperand( args[ 0 ], param )
            const b = makeVectorOperand( args[ 1 ], param )
            if ( !a || !b ) return undefined
            return props => new RegExp( '^' + String( b( props ) ), 'i' ).test( String( a( props ) ) )
        },
        'ends-with': ( args, param ) => {
            if ( args.length !== 2 ) throw new Error( 'ENDS-WITH needs exactly 2 arguments' )
            const a = makeVectorOperand( args[ 0 ], param )
            const b = makeVectorOperand( args[ 1 ], param )
            if ( !a || !b ) return undefined
            return props => new RegExp( String( b( props ) ) + '$', 'i' ).test( String( a( props ) ) )
        },
        'not': ( args, param ) => {
            if ( args.length !== 1 ) throw new Error( 'NOT needs exactly 1 argument' )
            const a = makeVectorOperator( args[ 0 ], param )
            if ( !a ) return undefined
            return props => !a( props )
        },
    }

    if ( !predicate.operator || !( predicate.operator in operators ) )
        throw new Error( `unknown operator: ${ JSON.stringify( predicate ) }` )

    return operators[ predicate.operator ]( predicate.arguments || [], param )
}

type ValueGetter = ( properties: Record<string, unknown> ) => unknown

function makeVectorOperand( predicate: PredicateArg, param: ParamMap ): ValueGetter | undefined {
    switch ( predicate.operand ) {
        case 'attribute':
            return props => {
                if ( !( predicate.name! in props ) )
                    throw new Error( `"${ predicate.name }" is not a valid attribute` )
                return props[ predicate.name! ]
            }
        case 'parameter': {
            if ( !( predicate.id! in param ) )
                throw new Error( `"${ predicate.id }" is not a valid parameter` )
            const v = param[ predicate.id! ]?.value
            if ( v == null || v === '' ) return undefined
            return () => v
        }
        default:
            throw new Error( `unknown operand: ${ JSON.stringify( predicate ) }` )
    }
}

function overlapsExtent( extent: number[], geom: any ): boolean {
    const turf = ( window as any ).turf
    const extentGeom = turf.bboxPolygon( extent )

    switch ( geom.type ) {
        case 'Polygon':
        case 'MultiPolygon':
            return turf.booleanOverlap( geom, extentGeom )
                || turf.booleanCrosses( extentGeom, geom )
                || turf.booleanContains( extentGeom, geom )
                || turf.booleanContains( geom, extentGeom )

        case 'LineString':
        case 'MultiLineString':
            return turf.booleanCrosses( extentGeom, geom )
                || turf.booleanContains( extentGeom, geom )

        case 'Point':
        case 'MultiPoint':
            return turf.coordReduce( geom, ( accum: boolean, coord: number[] ) =>
                accum || turf.booleanPointInPolygon( coord, extentGeom )
            , false )

        default:
            console.warn( 'skip', geom.type )
            return false
    }
}

// ---------------------------------------------------------------------------
// ESRI unique-value fetcher (shared by esri-dynamic and esri-feature)
// ---------------------------------------------------------------------------

function fetchEsriUniqueValues(
    excludes:     unknown[],
    serviceUrl:   string,
    attribute:    string,
    useDynamic:   boolean,
    dynamicLayer?: any,
): Promise<unknown[]> {
    const filter = buildExcludeFilter( excludes, attribute )
    const data: Record<string, unknown> = {
        f:                    'geojson',
        where:                filter,
        outFields:            attribute,
        inSR:                 4326,
        outSR:                4326,
        returnGeometry:       false,
        returnZ:              false,
        returnM:              false,
        returnIdsOnly:        false,
        returnCountOnly:      false,
        returnDistinctValues: true,
    }
    if ( useDynamic && dynamicLayer ) {
        data.layer = JSON.stringify( dynamicLayer ).replace( /^"|"$/g, '' )
    }
    return fetchPost( serviceUrl, data ).then( d => extractUniqueValues( d, attribute ) )
}

// ---------------------------------------------------------------------------
// WMS unique-value fetcher
// ---------------------------------------------------------------------------

function fetchWmsUniqueValues(
    excludes:   unknown[],
    serviceUrl: string,
    typeName:   string,
    attribute:  string,
): Promise<unknown[]> {
    const notNullExcludes = excludes.filter( v => v != null )
    let filter = '(1=1)'
    if ( excludes.length !== notNullExcludes.length )
        filter = `( ${ attribute } IS NOT NULL )`
    if ( notNullExcludes.length > 0 )
        filter += ` AND ${ attribute } NOT IN ( ${ notNullExcludes.map( x => `'${ x }'` ).join( ', ' ) } )`

    const data = {
        service:      'WFS',
        version:      '1.1.0',
        request:      'GetFeature',
        srsName:      'EPSG:4326',
        typename:     typeName,
        outputformat: 'application/json',
        cql_filter:   filter,
        propertyName: attribute,
        maxFeatures:  '10',
    }

    return fetchGet( serviceUrl, data )
        .then( d => extractUniqueValues( d, attribute ) )
        .catch( e => {
            if ( ( e as any ).responseText )
                throw new Error( `Request failed: ${ ( e as any ).responseText }` )
            throw e
        } )
}

// ---------------------------------------------------------------------------
// Backward compat
// ---------------------------------------------------------------------------

if ( typeof window !== 'undefined' && ( window as any ).SMK ) {
    ;( window as any ).SMK.TYPE.Query          = Query
    ;( window as any ).SMK.TYPE.QueryParameter = QueryParameter
}

export default Query
