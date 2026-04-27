/**
 * tool-internal-layers mixin — manages internal map layers for a Tool.
 * Converted from mixin/tool-internal-layers/tool-internal-layers.js.
 */

export function ToolInternalLayers( this: any ): void {
    this.internalLayers = []

    this.$initializers.push( function ( this: any, smk: any ) {
        const self = this

        this.internalLayers.forEach( function ( ly: any ) {
            ly.id          = self.id + '--' + ly.id
            ly.type        = 'vector'
            ly.isVisible   = true
            ly.isQueryable = false
            ly.isInternal  = true

            smk.$viewer.addLayer( ly )
        } )

        this.setInternalLayerVisible = function ( visible: boolean ) {
            smk.$viewer.displayContext[ self.type ].setItemVisible( self.id, visible )
        }

        this.getInternalLayer = function ( id: string ) {
            const key = this.id + '--' + id
            if ( !smk.$viewer.layerId[ key ] )
                throw new Error( 'internal layer ' + id + ' not defined' )
            return smk.$viewer.layerId[ key ]
        }

        this.clearInternalLayer = function ( id: string ) {
            this.getInternalLayer( id ).clear()
        }

        this.loadInternalLayer = function ( id: string, geojson: any ) {
            this.getInternalLayer( id ).load( geojson )
        }
    } )
}

// Assign to SMK.TYPE for backward compat
if ( typeof window !== 'undefined' ) {
    const smk = ( window as any ).SMK
    if ( smk && smk.TYPE ) smk.TYPE.ToolInternalLayers = ToolInternalLayers
}

export default ToolInternalLayers
