/**
 * SMK Event system
 * Converted from event.js to TypeScript ES module.
 *
 * Key change: the original used a Vue 2 instance as an event dispatcher
 * (this.dispatcher = new Vue()). Vue 2 is EOL and was only used for its
 * $on/$off/$emit API. This version replaces it with a lightweight native
 * EventDispatcher class — no framework dependency, same interface.
 *
 * jQuery's $.extend and $.isFunction are replaced with Object.assign and
 * typeof checks respectively.
 *
 * Backward compat: SMKEvent is assigned to window.SMK.TYPE.Event so
 * unconverted modules that reference SMK.TYPE.Event.define() still work.
 */

// ---------------------------------------------------------------------------
// EventDispatcher — replaces the Vue 2 instance used as an event bus
// ---------------------------------------------------------------------------

class EventDispatcher {
    private listeners: Record<string, Function[]> = {}

    $on( event: string, handler: Function ): void {
        if ( !this.listeners[ event ] ) this.listeners[ event ] = []
        this.listeners[ event ].push( handler )
    }

    $off( event?: string ): void {
        if ( !event ) { this.listeners = {}; return }
        delete this.listeners[ event ]
    }

    $emit( event: string, ...args: any[] ): void {
        const handlers = this.listeners[ event ]
        if ( handlers ) handlers.slice().forEach( h => h( ...args ) )
    }
}

// ---------------------------------------------------------------------------
// SMKEvent — base class for all event-emitting objects in SMK
// ---------------------------------------------------------------------------

export class SMKEvent {
    dispatcher: EventDispatcher
    catchExceptions: boolean = true

    constructor() {
        this.dispatcher = new EventDispatcher()
    }

    destroy(): void {
        this.dispatcher.$off()
    }

    /**
     * Define a typed event subclass with the given event names.
     *
     * Each name becomes a method on the subclass prototype:
     *   - called with a function argument - registers a listener ($on)
     *   - called with non-function arguments - emits the event ($emit)
     *
     * Usage:
     *   const ViewerEvent = SMKEvent.define(['changedView', 'pickedLocation'])
     *   class Viewer extends ViewerEvent { ... }
     */
    static define( names: string[] ): any {
        const subclass: any = function ( this: any ) {
            // Cannot call an ES6 class constructor via .call() — initialise fields directly.
            this.dispatcher     = new EventDispatcher()
            this.catchExceptions = true
        }

        Object.setPrototypeOf( subclass.prototype, SMKEvent.prototype )
        subclass.prototype.constructor = subclass

        names.forEach( function ( n: string ) {
            subclass.prototype[ n ] = function ( this: any, handler?: any ) {
                if ( typeof handler === 'function' ) {
                    this.dispatcher.$on( n, handler )
                    return this
                }

                const args: any[] = Array.from( arguments )
                args.unshift( n )

                try {
                    this.dispatcher.$emit( ...args )
                } catch ( err: any ) {
                    if ( this.catchExceptions ) {
                        console.warn( 'Exception caught in ' + n + ' event handler:', err )
                    } else {
                        err.message = 'Exception caught in ' + n + ' event handler: ' + err.message
                        throw err
                    }
                }

                return this
            }
        } )

        return subclass
    }
}

// Backward compat: unconverted modules access SMK.TYPE.Event.define()
if ( typeof window !== 'undefined' && window.SMK ) {
    window.SMK.TYPE.Event = SMKEvent
}

export default SMKEvent
