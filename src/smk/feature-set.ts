/**
 * SMK FeatureSet
 * Converted from feature-set.js to TypeScript ES module.
 *
 * Depends (converted): event.ts, util.ts
 * Depends (not yet converted): turf — used only in getStats().vertexCount;
 *   accessed as (window as any).turf.
 *   TODO: import turf directly once bundled.
 *
 * include.hash() is inlined as a local `hashValue()` function.
 *
 * Backward compat: SMK.TYPE.FeatureSet is assigned at the bottom.
 */

import { SMKEvent }      from './event'
import { isDeepEqual }   from './util'

// ---------------------------------------------------------------------------
// Inlined from src/lib/include.js — used only for stable feature ID hashing
// ---------------------------------------------------------------------------

const _typeCode: Record<string, string> = {
    undefined: '\x00',
    null:      '\x01',
    boolean:   '\x02',
    number:    '\x03',
    string:    '\x04',
    function:  '\x05',
    array:     '\x06',
    object:    '\x0a',
}

function _type( val: unknown ): string {
    const t = typeof val
    if ( t !== 'object' ) return t
    if ( Array.isArray( val ) ) return 'array'
    if ( val === null ) return 'null'
    return 'object'
}

function hashValue( val: unknown ): string {
    /* eslint-disable no-bitwise */
    let h = 0x811c9dc5

    walk( val )

    return ( '0000000' + ( h >>> 0 ).toString( 16 ) ).substr( -8 )

    function walk( v: unknown ) {
        const t = _type( v )
        switch ( t ) {
            case 'string':
                return addBits( v as string )

            case 'array': {
                addBits( _typeCode[ t ] )
                for ( const j in ( v as unknown[] ) ) walk( ( v as unknown[] )[ j ] )
                return
            }

            case 'object': {
                addBits( _typeCode[ t ] )
                const keys = Object.keys( v as object ).sort()
                for ( const j in keys ) {
                    const key = keys[ j ]
                    addBits( key )
                    walk( ( v as Record<string, unknown> )[ key ] )
                }
                return
            }

            case 'undefined':
            case 'null':
                return addBits( _typeCode[ t ] )

            default:
                return addBits( _typeCode[ t ] + String( v ) )
        }
    }

    function addBits( str: string ) {
        for ( let i = 0, l = str.length; i < l; i += 1 ) {
            h ^= str.charCodeAt( i )
            h += ( h << 1 ) + ( h << 4 ) + ( h << 7 ) + ( h << 8 ) + ( h << 24 )
        }
    }
    /* eslint-enable no-bitwise */
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function featureId( feature: GeoFeature, keyAttribute: string | undefined, nonce: number ): string {
    if ( keyAttribute && keyAttribute in feature.properties )
        return hashValue( [ feature.properties[ keyAttribute ], nonce ] )
    return hashValue( [ feature.properties, nonce ] )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoFeature {
    id?:       string
    layerId?:  string
    title?:    string
    properties: Record<string, unknown>
    geometry:   unknown
    [key: string]: unknown
}

export interface AddedFeaturesEvent {
    features: GeoFeature[]
    layerId:  string
}

export interface RemovedFeaturesEvent {
    features: GeoFeature[]
}

export interface PickedFeatureEvent {
    feature: GeoFeature | undefined
    was:     GeoFeature | undefined
    [key: string]: unknown
}

export interface HighlightedFeaturesEvent {
    features:  GeoFeature[] | undefined
    was:       ( GeoFeature | undefined )[] | undefined
}

export interface FeatureStats {
    readonly featureCount: number
    readonly vertexCount:  number
    readonly layerCount:   number
}

// ---------------------------------------------------------------------------
// FeatureSetEvent — typed event subclass
// ---------------------------------------------------------------------------

const FeatureSetEvent = SMKEvent.define( [
    'addedFeatures',
    'removedFeatures',
    'pickedFeature',
    'zoomToFeature',
    'highlightedFeatures',
    'clearedFeatures',
] )

// ---------------------------------------------------------------------------
// FeatureSet
// ---------------------------------------------------------------------------

export class FeatureSet {
    featureSet:           Record<string, GeoFeature>
    pickedFeatureId:      string | null
    highlightedFeatureId: Record<string, boolean>

    constructor() {
        // Initialise the event dispatcher from the FeatureSetEvent mixin
        FeatureSetEvent.prototype.constructor.call( this )

        this.featureSet           = {}
        this.pickedFeatureId      = null
        this.highlightedFeatureId = {}
    }

    // -------------------------------------------------------------------------
    // Mutation
    // -------------------------------------------------------------------------

    add( layerId: string, features: GeoFeature[], keyAttribute?: string ): string[] {
        const self = this

        const ids = features.map( f => {
            let nonce = 0
            let id    = featureId( f, keyAttribute, nonce )

            while ( id in self.featureSet ) {
                const other = self.featureSet[ id ]
                if ( isDeepEqual( f.properties, other.properties ) && isDeepEqual( f.geometry, other.geometry ) )
                    return undefined

                nonce += 1
                id = featureId( f, keyAttribute, nonce )
            }

            f.id      = id
            f.layerId = layerId

            self.featureSet[ id ] = f

            return id
        } ).filter( ( id ): id is string => id !== undefined )

        if ( ids.length > 0 )
            ( this as any ).addedFeatures( {
                features: ids.map( id => self.featureSet[ id ] ),
                layerId,
            } )

        return ids
    }

    remove( featureIds: string[] ): string[] {
        const self = this

        const fs = featureIds.map( id => {
            if ( !( id in self.featureSet ) ) return undefined
            const f = self.featureSet[ id ]
            delete self.featureSet[ id ]
            return f
        } ).filter( ( f ): f is GeoFeature => f !== undefined )

        if ( fs.length > 0 )
            ( this as any ).removedFeatures( { features: fs } )

        return fs.map( f => f.id! )
    }

    clear(): void {
        this.featureSet      = {}
        this.pickedFeatureId = null
        ;( this as any ).clearedFeatures()
    }

    // -------------------------------------------------------------------------
    // Pick
    // -------------------------------------------------------------------------

    pick( featureId: string | null, option?: Record<string, unknown> ): string | null | undefined {
        if ( featureId && !this.has( featureId ) )
            throw new Error( `feature id ${ featureId } not present` )

        if ( this.pickedFeatureId === featureId ) return

        const old            = this.pickedFeatureId
        this.pickedFeatureId = featureId

        ;( this as any ).pickedFeature( Object.assign( {
            feature: featureId ? this.featureSet[ featureId ] : undefined,
            was:     old       ? this.featureSet[ old ]       : undefined,
        }, option ) )

        return old
    }

    zoomTo( featureId: string ): void {
        if ( featureId && !this.has( featureId ) )
            throw new Error( `feature id ${ featureId } not present` )

        ;( this as any ).zoomToFeature( {
            feature: featureId ? this.featureSet[ featureId ] : undefined,
        } )
    }

    // -------------------------------------------------------------------------
    // Highlight
    // -------------------------------------------------------------------------

    highlight( featureIds?: string[] ): string[] {
        const self = this

        const oldIds = Object.keys( this.highlightedFeatureId )
        this.highlightedFeatureId = {}

        let features: GeoFeature[] | undefined
        if ( featureIds ) {
            features = featureIds.map( id => {
                if ( !self.has( id ) )
                    throw new Error( `feature id ${ id } not present` )
                self.highlightedFeatureId[ id ] = true
                return self.featureSet[ id ]
            } )
        }

        const oldFeatures = oldIds.map( id => self.featureSet[ id ] )

        ;( this as any ).highlightedFeatures( {
            features,
            was: oldFeatures.length ? oldFeatures : undefined,
        } )

        return oldIds
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    isEmpty(): boolean {
        return Object.keys( this.featureSet ).length === 0
    }

    has( id: string ): boolean {
        return id in this.featureSet
    }

    get( id: string ): GeoFeature | undefined {
        return this.featureSet[ id ]
    }

    isPicked( id: string ): boolean {
        return this.pickedFeatureId === id
    }

    isHighlighted( id: string ): boolean {
        return !!this.highlightedFeatureId[ id ]
    }

    getPicked(): GeoFeature | undefined {
        if ( !this.pickedFeatureId ) return
        return this.featureSet[ this.pickedFeatureId ]
    }

    getStats(): FeatureStats {
        const self = this
        const ids  = Object.keys( this.featureSet )
        let v: number | undefined
        let l: number | undefined

        return {
            get featureCount() { return ids.length },
            get vertexCount() {
                if ( v !== undefined ) return v
                // TODO: import turf directly once bundled
                const turf = ( window as any ).turf
                if ( !turf ) return 0
                return ( v = ids.reduce( ( accum, id ) =>
                    accum + turf.coordReduce( self.featureSet[ id ].geometry, ( a: number ) => a + 1, 0 )
                , 0 ) )
            },
            get layerCount() {
                if ( l !== undefined ) return l
                return ( l = Object.keys(
                    ids.reduce( ( accum: Record<string, number>, id ) => {
                        const lid = self.featureSet[ id ].layerId!
                        accum[ lid ] = ( accum[ lid ] || 0 ) + 1
                        return accum
                    }, {} )
                ).length )
            },
        }
    }
}

// Wire up prototype chain so FeatureSet instances inherit the event methods
Object.setPrototypeOf( FeatureSet.prototype, FeatureSetEvent.prototype )
FeatureSet.prototype.constructor = FeatureSet as any

// ---------------------------------------------------------------------------
// Backward compat
// ---------------------------------------------------------------------------

if ( typeof window !== 'undefined' && window.SMK ) {
    window.SMK.TYPE.FeatureSet = FeatureSet as any
}

export default FeatureSet
