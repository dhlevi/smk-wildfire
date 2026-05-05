/**
 * SMK Base Layer class
 * Converted from layer/layer.js to TypeScript ES module.
 *
 * Depends on: event.ts, util.ts (both already converted).
 *
 * Pattern is the same as viewer.ts will use:
 *   - LayerEvent = SMKEvent.define([...]) creates a prototype-chained subclass
 *   - Layer extends it via Object.setPrototypeOf
 *   - $.extend replaced with Object.assign / Object.setPrototypeOf
 *   - SMK.UTIL.* calls replaced with direct imports from util.ts
 *
 * Backward compat: SMK.TYPE.Layer is assigned at the bottom so unconverted
 * modules that reference SMK.TYPE.Layer still work.
 */

import { SMKEvent }            from '../event'
import { resolved, makePromise } from '../util'

// ---------------------------------------------------------------------------
// LayerEvent — typed event subclass for all layer instances
// ---------------------------------------------------------------------------

const LayerEvent = SMKEvent.define( [
    'startedLoading',
    'finishedLoading',
    'changedFeature',
] )

// ---------------------------------------------------------------------------
// Layer — base class for all SMK layer types
// ---------------------------------------------------------------------------

export interface LayerConfig {
    id:           string
    type:         string
    title?:       string
    isVisible?:   boolean
    isQueryable?: boolean
    isDisplayed?: boolean
    opacity?:     number
    attribution?: string
    minScale?:    number
    maxScale?:    number
    titleAttribute?: string
    titleFormat?:    string
    popupTemplate?:  string
    queries?:        any[]
    tolerance?:      number
    clusterOption?:  any
    [key: string]: unknown
}

export class Layer {
    config:        LayerConfig
    loading:       boolean     // defined via Object.defineProperty below
    id:            string      // defined via Object.defineProperty below
    legendPromise?: Promise<any>

    constructor( config: LayerConfig ) {
        const self = this

        // Initialise the event dispatcher from the LayerEvent mixin
        LayerEvent.prototype.constructor.call( this )

        Object.assign( this, { config } )

        let loading = false
        Object.defineProperty( this, 'loading', {
            get() { return loading },
            set( v: any ) {
                if ( !!v === loading ) return
                loading = !!v
                if ( v )
                    ( self as any ).startedLoading()
                else
                    ( self as any ).finishedLoading()
            }
        } )

        Object.defineProperty( this, 'id', {
            get() { return config.id }
        } )
    }

    // -------------------------------------------------------------------------
    // Legend support
    // -------------------------------------------------------------------------

    initLegends( _viewer?: any ): Promise<any[]> {
        return resolved( [] )
    }

    getLegends( viewer?: any ): Promise<any[]> {
        const self = this

        if ( !this.legendPromise ) {
            this.legendPromise = makePromise<any>( ( res ) => {
                res( self.initLegends( viewer ) )
            } )
            .then( ( legends: any[] ) => {
                return legends.map( ( lg: any ) => {
                    lg.style = Object.assign( {
                        'background-image':  `url( ${ lg.url })`,
                        'background-repeat': 'no-repeat',
                        'background-size':   `${ lg.width }px ${ lg.height }px`,
                        'width':             `${ lg.clipWidth || lg.width }px`,
                        'height':            `${ lg.clipHeight || lg.height }px`,
                        'display':           'block',
                    }, lg.style )
                    return lg
                } )
            } )
        }

        return this.legendPromise
    }

    // -------------------------------------------------------------------------
    // Feature querying — overridden by concrete layer types
    // -------------------------------------------------------------------------

    getFeaturesAtPoint( _arg?: any ): Promise<any[]> | void {
    }

    // -------------------------------------------------------------------------
    // Layer merging — concrete types override to enable merged viewer layers
    // -------------------------------------------------------------------------

    canMergeWith( _other: Layer ): boolean {
        return false
    }

    // -------------------------------------------------------------------------
    // Scale visibility
    //
    // Note: scale values are denominators (e.g. 1:50000 is scale = 50000),
    // so "minScale > scale" means the map is more zoomed out than allowed.
    // -------------------------------------------------------------------------

    inScaleRange( view: { scale: number } ): boolean {
        if ( this.config.maxScale && view.scale < this.config.maxScale ) return false
        if ( this.config.minScale && view.scale > this.config.minScale ) return false
        return true
    }

    // -------------------------------------------------------------------------

    getConfig( _visible?: boolean ): LayerConfig {
        return this.config
    }

    canAddToMap(): boolean {
        return true
    }
}

// Wire up the prototype chain so Layer instances inherit the event methods
// (startedLoading, finishedLoading, changedFeature, destroy, catchExceptions).
// Must come after the class body so the prototype object exists.
Object.setPrototypeOf( Layer.prototype, LayerEvent.prototype )
Layer.prototype.constructor = Layer as any

// ---------------------------------------------------------------------------
// Backward compat: assign to window.SMK.TYPE.Layer so unconverted modules
// that reference SMK.TYPE.Layer can still instantiate it.
// ---------------------------------------------------------------------------

if ( typeof window !== 'undefined' && window.SMK ) {
    window.SMK.TYPE.Layer = Layer as any
}

export default Layer
