// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:     'current-location',
    position: 'actionbar',
    order:    11,
    icon:     'my_location',
    title:    'Current Location',
    zoom:     17,
    internalLayers: [
        {
            id:    'current-location',
            title: 'Current Location',
            style: {
                markerSize:   [ 26, 26 ],
                markerOffset: [ 13, 13 ],
            },
            geometryType: 'point',
            legend: { point: true },
        },
    ],
}
export default config
