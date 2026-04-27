/**
 * sidepanel — slide-out panel that hosts tool panels.
 * Converted from sidepanel/sidepanel.js (include.module -> ES module).
 */

import { SMKEvent } from '../event'
import sidepanelHtml from './sidepanel.html?raw'

declare const Vue: any

const SidepanelEvent: any = SMKEvent.define( [
    'changedVisible',
    'changedTool',
    'changedSize',
] )

export function Sidepanel( this: any, smk: any ): void {
    const self = this

    SidepanelEvent.prototype.constructor.call( this )

    this.model = {
        visible: false,
        expand:  0,
        panels:  [] as any[],
    }

    function getTool( id: string ) {
        return self.model.panels.find( ( p: any ) => p.prop.id === id )
    }

    this.vm = new Vue( {
        el: smk.addToOverlay( sidepanelHtml ),
        data: this.model,
        methods: {
            trigger( toolId: string, event: string, arg: any, comp: any ) {
                smk.emit( toolId, event, arg, comp )
            },
            previousPanel( id: string ) {
                const t = getTool( id )
                if ( t ) {
                    const pt = getTool( t.prop.parentId )
                    if ( pt ) {
                        smk.getToolById( pt.prop.id ).active = true
                        smk.getToolById( t.prop.id ).active  = false
                    }
                }
                smk.emit( id, 'previous-panel' )
            },
            closePanel() {
                self.setExpand( 0 )
            },
            beforeShow() {},
            afterShow() {
                self.changedVisible()
            },
            beforeHide() {},
            afterHide() {
                self.changedVisible()
            },
        },
    } )

    this.changedVisible( function () {
        if ( self.isPanelVisible() ) {
            self.setExpand( 1 )
        } else {
            self.changedSize()
            self.model.panels.forEach( ( p: any ) => {
                smk.getToolById( p.prop.id ).active = false
            } )
        }
    } )
}

Object.assign( Sidepanel.prototype, SidepanelEvent.prototype )

Sidepanel.prototype.getExpand = function () {
    return this.model.expand
}

Sidepanel.prototype.setExpand = function ( val: number ) {
    if ( val ) {
        this.model.expand = val
        this.changedSize()
    } else {
        this.model.visible = false
        this.model.expand  = 0
    }
}

Sidepanel.prototype.incrExpand = function ( incr: number ) {
    return this.setExpand( Math.max( 0, this.getExpand() + ( incr || 1 ) ) )
}

Sidepanel.prototype.isPanelVisible = function () {
    return this.model.visible
}

Sidepanel.prototype.addTool = function ( tool: any, smk: any ) {
    const self = this

    if ( !tool.makePanelComponent ) return

    this.model.panels.push( tool.makePanelComponent() )

    tool.changedActive( function () {
        const was = self.model.visible
        self.model.visible = self.model.panels.some( ( p: any ) => p.prop.active )

        if ( was === self.model.visible && tool.active )
            self.changedSize()
    } )

    return true
}

// Assign to SMK.TYPE for backward compat
if ( typeof window !== 'undefined' ) {
    const smk = ( window as any ).SMK
    if ( smk && smk.TYPE ) smk.TYPE.Sidepanel = Sidepanel
}

export default Sidepanel
