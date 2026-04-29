import { SMK } from '../../smk-ref'
/**
 * tool-base mixin — defines base properties for all Tool instances.
 * Converted from mixin/tool-base/tool-base.js (include.module -> ES module).
 */

export function ToolBase( this: any ): void {
    this.defineProp( 'id' )
    this.defineProp( 'type' )
    this.defineProp( 'title' )
    this.defineProp( 'status' )
    this.defineProp( 'visible',  { onSet: function ( this: any ) { this.changedVisible() } } )
    this.defineProp( 'enabled',  { onSet: function ( this: any ) { this.changedEnabled() } } )
    this.defineProp( 'active',   { onSet: function ( this: any ) { this.changedActive() } } )
    this.defineProp( 'group',    { onSet: function ( this: any ) { this.changedGroup() } } )
    this.defineProp( 'parentId' )
    this.defineProp( 'showTitle' )
    this.defineProp( 'icon' )
    this.defineProp( 'order' )
    this.defineProp( 'busy' )

    this.visible = false
    this.enabled = false
    this.active  = false
    this.group   = false
    this.busy    = false

    this.$propFilter.baseClasses = false

    this.$initializers.push( function ( this: any, smk: any ) {
        const self = this

        function setParentId( tool: any, parentId: any ) {
            tool.parentId   = parentId
            tool.hasPrevious = !!parentId

            if ( !tool.parentId ) {
                tool.rootId = tool.id
            }

            const group: Record<string, string[]> = {}
            smk.forEachTool( function ( t: any ) {
                const r = t.rootId = findRoot( t.id )
                if ( !group[ r ] ) group[ r ] = []
                group[ r ].push( t.id )
            } )

            smk.$group = group

            function findRoot( toolId: string ): string {
                let tool = smk.getToolById( toolId )
                while ( true ) {
                    const parent = smk.getToolById( tool.parentId )
                    if ( !parent ) return tool.id
                    tool = parent
                }
            }
        }

        setParentId( this, this.parentId )

        const positions: string[] = [].concat( this.position || [] )

        if ( positions.length ) {
            positions.push( 'toolbar' )

            const found = positions.some( function ( p: string ) {
                if ( p === self.id || p === self.type ) return false

                if ( !smk.hasToolType( p ) && !smk.getToolById( p ) ) {
                    console.warn( 'position ' + p + ' not available for tool ' + self.id )
                    return false
                }

                if ( smk.hasToolType( p ) ) {
                    const tools = smk.getToolsByType( p )
                    if ( tools.length > 1 ) {
                        console.warn( 'position ' + p + ' is ambiguous for tool ' + self.id )
                        return false
                    }
                    return tools[ 0 ].addTool( self, smk, setParentId )
                } else {
                    return smk.getToolById( p ).addTool( self, smk, setParentId )
                }
            } )

            if ( !found ) {
                console.warn( 'no position found for tool ' + self.id )
            }
        }

        // Tools with a parentId but no position (composite child tools) need to
        // be registered with the sidepanel directly so their panel can render.
        if ( !positions.length && this.parentId && this.makePanelComponent ) {
            smk.getSidepanel().addTool( this, smk )
        }

        this.changedActive( function () {
            const ids = smk.getToolGroup( self.rootId )
            const g = ids.some( function ( id: string ) {
                return smk.getToolById( id ).active
            } )
            ids.forEach( function ( id: string ) {
                smk.getToolById( id ).group = g
            } )

            if ( self.active ) {
                ids.forEach( function ( id: string ) {
                    smk.getToolById( id ).active = self.isToolInGroupActive( id )
                } )
            }
        } )

        if ( this.id === this.rootId )
            this.changedGroup( function () {
                if ( self.group ) {
                    smk.getToolRootIds().forEach( function ( rootId: string ) {
                        if ( rootId === self.id ) return

                        smk.getToolGroup( rootId ).forEach( function ( id: string ) {
                            smk.getToolById( id ).active = false
                        } )
                    } )
                }
            } )

        this.showStatusMessage = function ( message: string, status: string, delay: number ) {
            return smk.getStatusMessage().show( message, status, delay, this.busy )
        }
    } )

    this.isToolInGroupActive = function ( toolId: string ) {
        return toolId === this.id
    }

    this.addTool = function ( _tool: any, _smk: any ) {
        return false
    }
}

// Assign to SMK.TYPE for backward compat
if ( typeof window !== 'undefined' ) {
    const smk = SMK
    if ( smk && smk.TYPE ) smk.TYPE.ToolBase = ToolBase
}

export default ToolBase
