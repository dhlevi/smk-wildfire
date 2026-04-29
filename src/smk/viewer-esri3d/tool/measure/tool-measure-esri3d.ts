/**
 * tool-measure-esri3d — Measure tool for ESRI 3D viewer.
 * Converted from viewer-esri3d/tool/measure/tool-measure-esri3d.js.
 */

import '../../../tool/measure/tool-measure'
import { SMK } from '../../../smk-ref'

const smkRef = SMK

smkRef.TYPE.MeasureTool.addInitializer( function ( this: any, smk: any ) {
    if ( !smk.$viewer.view ) return   // not an esri3d viewer

    const self = this
    const E    = smkRef.TYPE.Esri3d

    this.changedActive( function () {
        if ( self.active ) self.showStatusMessage( 'Select measurement method' )
    } )

    function newContainer() {
        const div = document.createElement( 'div' )
        self.containerEl.appendChild( div )
        return div
    }

    function destroyWidget() {
        if ( self.measureWidget ) self.measureWidget.destroy()
        self.measureWidget = null
    }

    smk.on( this.id, {
        'container-inserted': function ( ev: any ) {
            self.containerEl = ev.el
        },

        'container-unbind': function () {
            destroyWidget()
        },

        'start-area': function () {
            destroyWidget()
            self.showStatusMessage()
            self.measureWidget = new E.widgets.AreaMeasurement3D( {
                view:      smk.$viewer.view,
                container: newContainer(),
            } )
        },

        'start-distance': function () {
            destroyWidget()
            self.showStatusMessage()
            self.measureWidget = new E.widgets.DirectLineMeasurement3D( {
                view:      smk.$viewer.view,
                container: newContainer(),
            } )
        },

        'cancel': function () {
            destroyWidget()
        },
    } )
} )
