import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SMKEvent } from '../../src/smk/event'

// ---------------------------------------------------------------------------
// EventDispatcher (tested indirectly through SMKEvent)
// ---------------------------------------------------------------------------

describe( 'SMKEvent.define()', () => {
    it( 'returns a constructor function', () => {
        const MyEvent = SMKEvent.define( [ 'changed' ] )
        expect( typeof MyEvent ).toBe( 'function' )
    } )

    it( 'instances have the named event methods', () => {
        const MyEvent = SMKEvent.define( [ 'changed', 'selected' ] )
        const obj = new MyEvent()
        expect( typeof obj.changed ).toBe( 'function' )
        expect( typeof obj.selected ).toBe( 'function' )
    } )

    it( 'instances have the SMKEvent base methods (destroy, catchExceptions)', () => {
        const MyEvent = SMKEvent.define( [ 'foo' ] )
        const obj = new MyEvent()
        expect( typeof obj.destroy ).toBe( 'function' )
        expect( obj.catchExceptions ).toBe( true )
    } )
} )

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

describe( 'event method — registering a handler', () => {
    it( 'calling with a function registers a listener', () => {
        const MyEvent = SMKEvent.define( [ 'changed' ] )
        const obj = new MyEvent()
        const handler = vi.fn()
        obj.changed( handler )
        obj.changed( 'payload' )
        expect( handler ).toHaveBeenCalledTimes( 1 )
    } )

    it( 'returns this for chaining when registering', () => {
        const MyEvent = SMKEvent.define( [ 'a', 'b' ] )
        const obj = new MyEvent()
        expect( obj.a( () => {} ) ).toBe( obj )
    } )

    it( 'multiple handlers for the same event all receive the emit', () => {
        const MyEvent = SMKEvent.define( [ 'ping' ] )
        const obj = new MyEvent()
        const h1 = vi.fn()
        const h2 = vi.fn()
        obj.ping( h1 )
        obj.ping( h2 )
        obj.ping()
        expect( h1 ).toHaveBeenCalledTimes( 1 )
        expect( h2 ).toHaveBeenCalledTimes( 1 )
    } )
} )

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

describe( 'event method — emitting', () => {
    it( 'calling with a non-function emits the event', () => {
        const MyEvent = SMKEvent.define( [ 'moved' ] )
        const obj = new MyEvent()
        const handler = vi.fn()
        obj.moved( handler )
        obj.moved( 10, 20 )
        expect( handler ).toHaveBeenCalledWith( 10, 20 )
    } )

    it( 'calling with no arguments emits the event (no args to handler)', () => {
        const MyEvent = SMKEvent.define( [ 'ready' ] )
        const obj = new MyEvent()
        const handler = vi.fn()
        obj.ready( handler )
        obj.ready()
        expect( handler ).toHaveBeenCalledWith()
    } )

    it( 'returns this for chaining when emitting', () => {
        const MyEvent = SMKEvent.define( [ 'tick' ] )
        const obj = new MyEvent()
        expect( obj.tick() ).toBe( obj )
    } )

    it( 'does not call unregistered events', () => {
        const MyEvent = SMKEvent.define( [ 'a', 'b' ] )
        const obj = new MyEvent()
        const handler = vi.fn()
        obj.a( handler )
        obj.b( 'payload' )         // emit b — should not call the a handler
        expect( handler ).not.toHaveBeenCalled()
    } )
} )

// ---------------------------------------------------------------------------
// Exception handling
// ---------------------------------------------------------------------------

describe( 'catchExceptions', () => {
    it( 'swallows handler errors and logs a warning when catchExceptions = true (default)', () => {
        const warnSpy = vi.spyOn( console, 'warn' ).mockImplementation( () => {} )
        const MyEvent = SMKEvent.define( [ 'boom' ] )
        const obj = new MyEvent()
        obj.boom( () => { throw new Error( 'oops' ) } )
        expect( () => obj.boom() ).not.toThrow()
        expect( warnSpy ).toHaveBeenCalled()
        warnSpy.mockRestore()
    } )

    it( 'rethrows with modified message when catchExceptions = false', () => {
        const MyEvent = SMKEvent.define( [ 'boom' ] )
        const obj = new MyEvent()
        obj.catchExceptions = false
        obj.boom( () => { throw new Error( 'bad' ) } )
        expect( () => obj.boom() ).toThrow( /Exception caught in boom event handler/ )
    } )
} )

// ---------------------------------------------------------------------------
// destroy()
// ---------------------------------------------------------------------------

describe( 'destroy()', () => {
    it( 'removes all listeners — subsequent emits are no-ops', () => {
        const MyEvent = SMKEvent.define( [ 'update' ] )
        const obj = new MyEvent()
        const handler = vi.fn()
        obj.update( handler )
        obj.destroy()
        obj.update( 'value' )
        expect( handler ).not.toHaveBeenCalled()
    } )
} )

// ---------------------------------------------------------------------------
// Multiple independent instances
// ---------------------------------------------------------------------------

describe( 'independent instances', () => {
    it( 'handlers on one instance do not fire for another instance', () => {
        const MyEvent = SMKEvent.define( [ 'ping' ] )
        const a = new MyEvent()
        const b = new MyEvent()
        const handlerA = vi.fn()
        const handlerB = vi.fn()
        a.ping( handlerA )
        b.ping( handlerB )
        a.ping()
        expect( handlerA ).toHaveBeenCalledTimes( 1 )
        expect( handlerB ).not.toHaveBeenCalled()
    } )
} )

// ---------------------------------------------------------------------------
// Subclass extending a defined event class
// ---------------------------------------------------------------------------

describe( 'using define() as a base class', () => {
    it( 'a class can extend the defined subclass and still use events', () => {
        const Base = SMKEvent.define( [ 'ready' ] )

        class Viewer extends Base {
            init() {
                this.ready( 'done' )
            }
        }

        const v = new Viewer()
        const handler = vi.fn()
        v.ready( handler )
        v.init()
        expect( handler ).toHaveBeenCalledWith( 'done' )
    } )
} )
