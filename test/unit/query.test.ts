/**
 * Unit tests for src/smk/query/query.ts
 */
import { describe, it, expect, vi } from 'vitest'
import {
    Query,
    QueryParameter,
    type ParamMap,
    type QueryConfig,
    type ParameterConfig,
} from '../../src/smk/query/query'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuery( id = 'lyr1', config: Partial<QueryConfig> = {} ): Query {
    return new Query( id, Object.assign( { id: 'q1' }, config ) as QueryConfig )
}

function makeParam( value: unknown ): ParamMap {
    return { p1: { value } }
}

// ---------------------------------------------------------------------------
// Query — base
// ---------------------------------------------------------------------------

describe( 'Query base', () => {
    it( 'constructs and composes id', () => {
        const q = makeQuery( 'myLayer' )
        expect( q.layerId ).toBe( 'myLayer' )
        expect( q.id ).toBe( 'myLayer--q1' )
    } )

    it( 'canUseWithExtent returns true by default', () => {
        expect( makeQuery().canUseWithExtent( {} ) ).toBe( true )
    } )

    it( 'maxUniqueValues defaults to 100', () => {
        expect( ( makeQuery() as any ).maxUniqueValues ).toBe( 100 )
    } )

    it( 'getParameters returns QueryParameter instances', () => {
        const q = makeQuery( 'lyr', {
            parameters: [
                { id: 'p1', type: 'input', title: 'Name' } as ParameterConfig,
            ],
        } )
        const params = q.getParameters( {} )
        expect( params ).toHaveLength( 1 )
        expect( params[ 0 ] ).toBeInstanceOf( QueryParameter )
        expect( params[ 0 ].component ).toBe( 'parameter-input' )
    } )

    it( 'is an event emitter (changedVisibility pattern not applicable, just alive)', () => {
        // Query uses empty event definition — just verify no exception
        const q = makeQuery()
        expect( q ).toBeTruthy()
    } )
} )

// ---------------------------------------------------------------------------
// QueryParameter subtypes
// ---------------------------------------------------------------------------

describe( 'QueryParameter', () => {
    const baseQuery = makeQuery( 'lyr', { parameters: [] } )

    it( 'input.focus increments prop.focus', () => {
        const p = new QueryParameter.input( baseQuery, { id: 'p1', type: 'input' } )
        expect( p.prop.focus ).toBe( 0 )
        p.focus()
        expect( p.prop.focus ).toBe( 1 )
    } )

    it( 'constant does not change focus', () => {
        const p = new QueryParameter.constant( baseQuery, { id: 'p1', type: 'constant' } )
        p.focus()
        expect( p.prop.focus ).toBe( 0 )
    } )

    it( 'select-unique exists as a class', () => {
        const SelectUnique = ( QueryParameter as any )[ 'select-unique' ]
        expect( typeof SelectUnique ).toBe( 'function' )
    } )

    it( 'constructs composite id from query.id + param.id', () => {
        const p = new QueryParameter.input( baseQuery, { id: 'x', type: 'input' } )
        expect( p.id ).toContain( 'x' )
        expect( p.id ).toContain( baseQuery.id )
    } )
} )

// ---------------------------------------------------------------------------
// Query.vector — predicate/in-memory tests
// ---------------------------------------------------------------------------

describe( 'Query.vector', () => {
    it( 'canUseWithExtent returns false', () => {
        const q = new Query.vector( 'lyr', { id: 'vq' } as QueryConfig )
        expect( q.canUseWithExtent( {} ) ).toBe( false )
    } )

    it( 'queryLayer — equals predicate matches features', async () => {
        const q = new Query.vector( 'lyr', {
            id:        'vq',
            predicate: {
                operator:  'equals',
                arguments: [
                    { operand: 'attribute', name: 'color' },
                    { operand: 'parameter', id: 'p1' },
                ],
            },
        } as QueryConfig )

        const mockViewer = {
            layerId: {
                lyr: { config: { id: 'lyr' } },
            },
            visibleLayer: {
                lyr: {
                    eachLayer( cb: Function ) {
                        cb( { feature: { properties: { color: 'red' },  geometry: null } } )
                        cb( { feature: { properties: { color: 'blue' }, geometry: null } } )
                    },
                },
            },
        }

        const result = await q.queryLayer( makeParam( 'red' ), { within: false }, mockViewer )
        expect( result ).toHaveLength( 1 )
        expect( result[ 0 ].properties.color ).toBe( 'red' )
    } )

    it( 'queryLayer — throws when no results', async () => {
        const q = new Query.vector( 'lyr', {
            id:        'vq',
            predicate: {
                operator:  'equals',
                arguments: [
                    { operand: 'attribute', name: 'color' },
                    { operand: 'parameter', id: 'p1' },
                ],
            },
        } as QueryConfig )

        const mockViewer = {
            layerId: { lyr: { config: {} } },
            visibleLayer: { lyr: { eachLayer: ( _cb: Function ) => {} } },
        }

        await expect( q.queryLayer( makeParam( 'red' ), {}, mockViewer ) )
            .rejects.toThrow( 'no results' )
    } )

    it( 'queryLayer — and predicate', async () => {
        const q = new Query.vector( 'lyr', {
            id:        'vq',
            predicate: {
                operator: 'and',
                arguments: [
                    {
                        operator: 'equals',
                        arguments: [
                            { operand: 'attribute', name: 'color' },
                            { operand: 'parameter', id: 'p1' },
                        ],
                    },
                    {
                        operator: 'equals',
                        arguments: [
                            { operand: 'attribute', name: 'size' },
                            { operand: 'parameter', id: 'p2' },
                        ],
                    },
                ],
            },
        } as QueryConfig )

        const mockViewer = {
            layerId: { lyr: { config: {} } },
            visibleLayer: {
                lyr: {
                    eachLayer( cb: Function ) {
                        cb( { feature: { properties: { color: 'red', size: 'big' }, geometry: null } } )
                        cb( { feature: { properties: { color: 'red', size: 'small' }, geometry: null } } )
                    },
                },
            },
        }

        const result = await q.queryLayer(
            { p1: { value: 'red' }, p2: { value: 'big' } },
            {},
            mockViewer,
        )
        expect( result ).toHaveLength( 1 )
        expect( result[ 0 ].properties.size ).toBe( 'big' )
    } )

    it( 'queryLayer — not predicate', async () => {
        const q = new Query.vector( 'lyr', {
            id:        'vq',
            predicate: {
                operator: 'not',
                arguments: [
                    {
                        operator: 'equals',
                        arguments: [
                            { operand: 'attribute', name: 'color' },
                            { operand: 'parameter', id: 'p1' },
                        ],
                    },
                ],
            },
        } as QueryConfig )

        const mockViewer = {
            layerId: { lyr: { config: {} } },
            visibleLayer: {
                lyr: {
                    eachLayer( cb: Function ) {
                        cb( { feature: { properties: { color: 'red' },  geometry: null } } )
                        cb( { feature: { properties: { color: 'blue' }, geometry: null } } )
                    },
                },
            },
        }

        const result = await q.queryLayer( makeParam( 'red' ), {}, mockViewer )
        expect( result ).toHaveLength( 1 )
        expect( result[ 0 ].properties.color ).toBe( 'blue' )
    } )

    it( 'queryLayer — or predicate', async () => {
        const q = new Query.vector( 'lyr', {
            id:        'vq',
            predicate: {
                operator: 'or',
                arguments: [
                    {
                        operator:  'equals',
                        arguments: [
                            { operand: 'attribute', name: 'color' },
                            { operand: 'parameter', id: 'p1' },
                        ],
                    },
                    {
                        operator:  'equals',
                        arguments: [
                            { operand: 'attribute', name: 'color' },
                            { operand: 'parameter', id: 'p2' },
                        ],
                    },
                ],
            },
        } as QueryConfig )

        const mockViewer = {
            layerId: { lyr: { config: {} } },
            visibleLayer: {
                lyr: {
                    eachLayer( cb: Function ) {
                        [ 'red', 'blue', 'green' ].forEach( color =>
                            cb( { feature: { properties: { color }, geometry: null } } )
                        )
                    },
                },
            },
        }

        const result = await q.queryLayer(
            { p1: { value: 'red' }, p2: { value: 'blue' } },
            {},
            mockViewer,
        )
        expect( result ).toHaveLength( 2 )
    } )

    it( 'queryLayer — contains / starts-with / ends-with', async () => {
        function makeContainsQuery( operator: string ) {
            return new Query.vector( 'lyr', {
                id:        'vq',
                predicate: {
                    operator,
                    arguments: [
                        { operand: 'attribute', name: 'label' },
                        { operand: 'parameter', id: 'p1' },
                    ],
                },
            } as QueryConfig )
        }

        const features = [ 'apple', 'pineapple', 'peach' ]
        const mockViewerFor = ( feats: string[] ) => ( {
            layerId: { lyr: { config: {} } },
            visibleLayer: {
                lyr: {
                    eachLayer( cb: Function ) {
                        feats.forEach( label =>
                            cb( { feature: { properties: { label }, geometry: null } } )
                        )
                    },
                },
            },
        } )

        const contains = await makeContainsQuery( 'contains' )
            .queryLayer( makeParam( 'apple' ), {}, mockViewerFor( features ) )
        expect( contains.map( f => f.properties.label ) ).toEqual( [ 'apple', 'pineapple' ] )

        const starts = await makeContainsQuery( 'starts-with' )
            .queryLayer( makeParam( 'p' ), {}, mockViewerFor( features ) )
        expect( starts.map( f => f.properties.label ) ).toEqual( [ 'pineapple', 'peach' ] )

        const ends = await makeContainsQuery( 'ends-with' )
            .queryLayer( makeParam( 'apple' ), {}, mockViewerFor( features ) )
        expect( ends.map( f => f.properties.label ) ).toEqual( [ 'apple', 'pineapple' ] )
    } )

    it( 'queryLayer — uses titleAttribute when available', async () => {
        const q = new Query.vector( 'lyr', {
            id:        'vq',
            predicate: {
                operator:  'equals',
                arguments: [
                    { operand: 'attribute', name: 'id' },
                    { operand: 'parameter', id: 'p1' },
                ],
            },
        } as QueryConfig )

        const mockViewer = {
            layerId: { lyr: { config: { titleAttribute: 'name' } } },
            visibleLayer: {
                lyr: {
                    eachLayer( cb: Function ) {
                        cb( { feature: { properties: { id: '1', name: 'Park A' }, geometry: null } } )
                    },
                },
            },
        }

        const result = await q.queryLayer( makeParam( '1' ), {}, mockViewer )
        expect( result[ 0 ].title ).toBe( 'Park A' )
    } )

    it( 'fetchUniqueValues returns attribute values from visible layer', async () => {
        const q = new Query.vector( 'lyr', { id: 'vq' } as QueryConfig )

        const mockViewer = {
            visibleLayer: {
                lyr: {
                    eachLayer( cb: Function ) {
                        cb( { feature: { properties: { color: 'red' } } } )
                        cb( { feature: { properties: { color: 'blue' } } } )
                        cb( { feature: { properties: { color: 'red' } } } )
                    },
                },
            },
        }

        const values = await q.fetchUniqueValues( 'color', mockViewer )
        expect( values ).toHaveLength( 2 )
        expect( values ).toContain( 'red' )
        expect( values ).toContain( 'blue' )
    } )
} )

// ---------------------------------------------------------------------------
// Query['esri-dynamic'] and ['esri-feature'] — registered on Query
// ---------------------------------------------------------------------------

describe( 'Query type registration', () => {
    it( 'Query["esri-dynamic"] is a constructor', () => {
        expect( typeof ( Query as any )[ 'esri-dynamic' ] ).toBe( 'function' )
    } )

    it( 'Query["esri-feature"] is a constructor', () => {
        expect( typeof ( Query as any )[ 'esri-feature' ] ).toBe( 'function' )
    } )

    it( 'Query.wms is a constructor', () => {
        expect( typeof Query.wms ).toBe( 'function' )
    } )

    it( 'Query.place is a constructor', () => {
        expect( typeof Query.place ).toBe( 'function' )
    } )

    it( 'Query.vector is a constructor', () => {
        expect( typeof Query.vector ).toBe( 'function' )
    } )
} )

// ---------------------------------------------------------------------------
// Query.place — structure + getAddressRadius
// ---------------------------------------------------------------------------

describe( 'Query.place', () => {
    it( 'constructs with default parameters', () => {
        const q = new Query.place( 'place' )
        expect( q.title ).toBe( 'Location' )
        expect( q.parameters ).toHaveLength( 1 )
        expect( q.parameters![ 0 ].type ).toBe( 'input' )
    } )

    it( 'canUseWithExtent returns false', () => {
        const q = new Query.place( 'place' )
        expect( q.canUseWithExtent( {} ) ).toBe( false )
    } )

    it( 'getAddressRadius returns correct values', () => {
        const q = new Query.place( 'place' )
        expect( q.getAddressRadius( { matchPrecision: 'STREET' } ) ).toBe( 500 )
        expect( q.getAddressRadius( { matchPrecision: 'CIVIC_NUMBER' } ) ).toBe( 100 )
        expect( q.getAddressRadius( { matchPrecision: 'PROVINCE' } ) ).toBe( 1000 )
    } )
} )
