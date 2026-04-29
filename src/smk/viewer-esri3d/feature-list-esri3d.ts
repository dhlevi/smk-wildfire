import { SMK } from '../smk-ref'
/**
 * feature-list-esri3d — Feature highlight graphics for ESRI 3D viewer.
 * Converted from viewer-esri3d/feature-list-esri3d.js.
 */

const smkRef = SMK

export function toolFeatureListEsri3d( this: any, smk: any ) {
    const self = this
    const E    = smkRef.TYPE.Esri3d

    const layer = new E.layers.GraphicsLayer()
    smk.$viewer.map.add( layer )

    function showFeatureSet() {
        layer.removeAll()

        self.featureSets.forEach( function ( fs: any ) {
            if ( !fs.visible ) return

            fs.features.forEach( function ( feature: any ) {
                const styleConfig = self.styleFeature( fs.style )
                const symbols = smkRef.UTIL.smkStyleToEsriSymbol( styleConfig, smk.$viewer )
                const graphics = smkRef.UTIL.geoJsonToEsriGraphics( feature )
                smkRef.UTIL.mapSymbolsToGraphics( graphics, symbols ).forEach( function ( g: any ) {
                    layer.add( g )
                } )
            } )
        } )
    }

    this.changedActive( function () {
        showFeatureSet()
    } )

    this.changedVisible( function () {
        showFeatureSet()
    } )

    this.featureSets.forEach( function ( fs: any ) {
        fs.addedFeatures( function () {
            showFeatureSet()
        } )

        fs.clearedFeatures( function () {
            showFeatureSet()
        } )

        fs.removedFeatures( function () {
            showFeatureSet()
        } )

        fs.pickedFeature( function ( ev: any ) {
            smk.$viewer.showPopup( ev.el, { latitude: ev.latitude, longitude: ev.longitude } )
        } )

        fs.zoomToFeature( function ( ev: any ) {
            smk.$viewer.panToFeature( ev.feature, 15 )
        } )
    } )
}

export default toolFeatureListEsri3d
