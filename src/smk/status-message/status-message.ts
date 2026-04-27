/**
 * status-message — floating status/progress bar overlay.
 * Converted from status-message/status-message.js (include.module -> ES module).
 */

import { SMKEvent } from '../event'
import statusMessageHtml from './status-message.html?raw'
import { resolved, makePromise, makeDelayedCall } from '../util'

declare const Vue: any

const StatusMessageEvent: any = SMKEvent.define( [] )

export function StatusMessage( this: any, smk: any ): void {
    StatusMessageEvent.prototype.constructor.call( this )

    this.model = {
        status:  null as string | null,
        message: null as string | null,
        busy:    false,
    }

    this.vm = new Vue( {
        el:   smk.addToOverlay( statusMessageHtml ),
        data: this.model,
    } )

    this._promise = resolved()
}

Object.assign( StatusMessage.prototype, StatusMessageEvent.prototype )

StatusMessage.prototype.clear = function () {
    if ( this._whenCleared ) this._whenCleared()
}

StatusMessage.prototype.cancel = function ( arg: any ) {
    if ( this._whenCancelled ) this._whenCancelled( arg )
}

StatusMessage.prototype.show = function (
    message: string | null,
    status?: string,
    delay?: number | null,
    busy?: boolean,
) {
    const self = this

    if ( !message ) return this.clear()

    this.cancel( 'replaced' )

    return this._promise.finally( function () {
        self.model.status  = status  || null
        self.model.message = message
        self.model.busy    = busy    || false

        let clear: () => void

        self._promise = makePromise( function ( res: () => void, rej: ( reason?: any ) => void ) {
            clear = self._whenCleared    = res
            self._whenCancelled          = rej
        } )
        .catch( function () {} )

        if ( delay !== null )
            makeDelayedCall( function () { clear() }, { delay: delay || 2000 } )()

        return self._promise.finally( function () {
            self.model.status          = null
            self.model.message         = null
            self.model.busy            = false
            self._whenCleared          = null
            self._whenCancelled        = null
        } )
    } )
}

// Assign to SMK.TYPE for backward compat
if ( typeof window !== 'undefined' ) {
    const smk = ( window as any ).SMK
    if ( smk && smk.TYPE ) smk.TYPE.StatusMessage = StatusMessage
}

export default StatusMessage
