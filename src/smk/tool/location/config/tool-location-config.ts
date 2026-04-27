// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:       'location',
    enabled:    true,
    showHeader: false,
    internalLayers: [
        {
            id: 'location',
            style: {
                markerSize:   [ 25, 41 ],
                markerOffset: [ 12, 41 ],
                shadowSize:   [ 41, 41 ],
            },
            legend: { point: true },
        },
    ],
}
export default config
