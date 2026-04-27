/**
 * document-ready — resolves when the DOM is ready.
 * Converted from document-ready.js (include.module -> ES module).
 */

export const documentReady: Promise<void> = new Promise<void>( ( res, rej ) => {
    if ( document.readyState !== 'loading' ) {
        res()
        return
    }

    const id = setTimeout( () => {
        const e = new Error( 'timeout waiting for document ready' )
        console.error( e )
        rej( e )
    }, 20000 )

    document.addEventListener( 'DOMContentLoaded', () => {
        clearTimeout( id )
        res()
    } )
} )

export default documentReady
