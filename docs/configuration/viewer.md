###### [SMK](../..) / [Configuration](.)

# Viewer

The `"viewer"` section of the SMK configuration controls the overall properties of the map.
This includes the type of map engire to use ([`"type"` property](#type-property)), the starting position of the map ([`"location"` property](#location-property)), the type of devide the application is running on ([`"device"` property](#device-property)), and what theme to apply to map's user interface elements ([`"themes"` property](#themes-property)).

These are the default values for the `"viewer"` configuration.
Click on a property name for more information:
<pre>
{ "viewer": {
    <a href="#type-property"                    >"type"</a>:        "leaflet",
    <a href="#device-property"                  >"device"</a>:      "auto",
    <a href="#deviceautobreakpoint-property"    >"deviceAutoBreakpoint"</a>: 500,
    <a href="#themes-property"                  >"themes"</a>:      null
    <a href="#panelwidth-property"              >"panelWidth"</a>:  300,
    <a href="#basemap-property"                 >"baseMap"</a>:     "Topographic",
    <a href="#activeTool-property"              >"activeTool"</a>:  null,
    <a href="#location-property"                >"location"</a>: {
        <a href="#extent-sub-property"          >"extent"</a>:  [ -139.1782, 47.6039, -110.3533, 60.5939 ],
        <a href="#center-sub-property"          >"center"</a>:  [ -124.76575, 54.0989 ],
        <a href="#zoom-sub-property"            >"zoom"</a>:    5,
    },
    <a href="#dem-property"                     >"dem"</a>: {
        <a href="#dem-property"                 >"url"</a>:          "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png",
        <a href="#dem-property"                 >"encoding"</a>:     "terrarium",
        <a href="#dem-property"                 >"tileSize"</a>:     256,
        <a href="#dem-property"                 >"maxzoom"</a>:      15,
        <a href="#dem-property"                 >"exaggeration"</a>: 1.2
    }
} }
</pre>

## Type Property
`"type": String`

The type of map viewer to use.
Available options:

- `"leaflet"`  - use the [Leaflet](https://leafletjs.com/) viewer (default).
- `"maplibre"` - use the [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) viewer.
  Adds an actionbar 2D / 3D mode toggle and supports terrain via the
  [`"dem"` property](#dem-property).  Loaded via a `<script>` tag pointing at
  the MapLibre GL JS bundle (the host page must include it).
- `"esri3d"`   - use the ArcGIS 3D viewer.


## Device Property
`"device": String`

The type of device that the map application is running on.
There are three options:

- `"auto"` - detect the device automatically (see [`"deviceAutoBreakpoint"` property](#deviceautobreakpoint-property)).
- `"desktop"` - user interface assumes that the device is a desktop computer browser.
- `"mobile"` - user interface assumes that the device is a mobile device.


## DeviceAutoBreakpoint Property
`"deviceAutoBreakpoint": Number`

When the [`"device"` property](#device-property) is `"auto"`, this value is used to detect if the device is `"desktop"` or `"mobile"`.
The width of the browser frame is compared with this property, and if the browser frame width is the larger value, then the [`"device"` property](#device-property) is `"desktop"`; otherwise `"mobile"` is used.


## Themes Property
`"themes": Array`

Load additional UI themes at startup.
These themes are defined:

- `"alpha"`
- `"beta"`
- `"gamma"`
- `"delta"`

##### Note

This property and the themes are experimental.


## PanelWidth Property
`"panelWidth": Number`

The width of the UI panel, in pixels.


## BaseMap Property
`"baseMap": String`

The name of the basemap to display at startup.
These are the possible values:

- `"Topographic"`
- `"Streets"`
- `"Imagery"`
- `"Oceans"`
- `"NationalGeographic"`
- `"ShadedRelief"`
- `"DarkGray"`
- `"Gray"`
- `"StamenTonerLight"`
- `"bc-roads"`         — *MapLibre + Leaflet.* BC BaseMap (vector tiles, public, no token).
- `"bc-roads-raster"`  — Raster fallback for the BC BaseMap.
- `"topography"`       — Canada Topographic vector + hillshade composite.
- `"openstreetmap"`    — OpenStreetMap raster.
- `"esri-imagery"`     — Public ESRI World Imagery (raster).

Additional ESRI v2 vector basemaps (`imagery-esri-v2`, `streets-esri-v2`) are
registered but require an ESRI API token; see
[`src/smk/base-maps.ts`](https://github.com/bcgov/smk-wildfire/blob/master/src/smk/base-maps.ts).

### Adding a custom basemap

Basemaps are registered in code via `defineBaseMap( id, cfg )` in
[`src/smk/base-maps.ts`](https://github.com/bcgov/smk-wildfire/blob/master/src/smk/base-maps.ts).
The `cfg.type` selects the basemap implementation.  The MapLibre viewer
adds three vector-capable types in addition to the legacy raster types:

#### `"esri-vector-tile"` — ESRI VectorTileServer

For vector tile services published by ArcGIS Server / ArcGIS Online.  The
style is auto-discovered at `<url>/resources/styles/root.json` (override
with `styleUrl`) and the source URL is rewritten to the explicit
`<url>/tile/{z}/{y}/{x}.pbf` form.

```js
defineBaseMap( 'bc-roads', {
    type:  'esri-vector-tile',
    title: 'BC BaseMap Vector',
    url:   'https://tiles.arcgis.com/tiles/ubm4tcTYICKBpist/arcgis/rest/services/BC_BASEMAP_20240307/VectorTileServer',
    // optional:
    styleUrl:        '...root.json',          // override the default style URL
    transformLayers: ( layers ) => layers,    // mutate / filter MapLibre layers
} )
```

Under Leaflet this falls back to `esri-leaflet-vector` (which requires
`L.esri.Vector.vectorTileLayer`).

#### `"maplibre-style"` — Remote MapLibre style.json

Loads any standards-compliant MapLibre / Mapbox `style.json`, namespaces
its sources and layers under the basemap id (so they cannot collide with
viewer layers), and resolves relative `glyphs` / `sprite` / `tiles` URLs.

```js
defineBaseMap( 'my-vector', {
    type:        'maplibre-style',
    title:       'My Vector Style',
    url:         'https://tiles.example.com/styles/my-style/style.json',
    attribution: '© Example',
    // transformLayers: layers => layers.filter( l => l.id !== 'highway-shields' )
} )
```

MapLibre only — under Leaflet the basemap registers but renders as blank
in the basemap chooser preview.

#### `"vector-tile"` — Direct MVT source with inline style

For a single MVT endpoint where you want to author the MapLibre layers
inline rather than load a `style.json`.

```js
defineBaseMap( 'my-mvt', {
    type:  'vector-tile',
    title: 'My MVT',
    tiles: [ 'https://tiles.example.com/v1/{z}/{x}/{y}.pbf' ],
    // or: tileJsonUrl: 'https://tiles.example.com/v1.json'
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    layers: [
        { id: 'land',  type: 'fill', 'source-layer': 'land',  paint: { 'fill-color': '#eee' } },
        { id: 'roads', type: 'line', 'source-layer': 'roads', paint: { 'line-color': '#888' } }
    ],
    option: { minzoom: 0, maxzoom: 14 }
} )
```

MapLibre only.

All three vector basemap types load asynchronously.  Switching basemaps
before the previous load completes is safe — in-flight loads that are
superseded are discarded automatically.


## ActiveTool Property
`"activeTool": String`

If this property is set to the id of a tool, then this tool will be active when the map is finished initialization.


## Location Property
`"location": String`

The location that map shows when the map starts.
The default value is the map centered on BC, at zoom level 5, which shows the whole province.


### Extent Sub-property
`"location": { "extent": Array }`

The extent which must be displayed by the map at startup.
The array contains 4 values, which are in order: *`[MIN-LONG]`*,*`[MIN-LAT]`*,*`[MAX-LONG]`*,*`[MAX-LAT]`*.
This take precedence over any center and zoom settings.


### Center Sub-property
`"location": { "center": Array }`

The center point of the map at startup.
The array contains 2 values, which are in order: *`[LONG]`*,*`[LAT]`*.


### Zoom Sub-property
`"location": { "zoom": Number }`

The zoom level of the map at startup.
This is a value from 0 (whole world) to 30.
The default value is 5, which shows the whole province of BC.


## Dem Property
`"dem": Object`

*MapLibre viewer only.*  Configures the digital elevation model (DEM) source
used by the 2D / 3D mode toggle to render terrain.  All sub-properties are
optional and fall back to the defaults shown above.

- `"url"` — DEM raster tile URL template.  Defaults to the public AWS
  Terrarium tileset.
- `"encoding"` — `"terrarium"` or `"mapbox"`, matching the tileset's
  elevation encoding.
- `"tileSize"` — Tile size in pixels (typically `256` or `512`).
- `"maxzoom"` — Maximum native zoom of the DEM tileset.
- `"exaggeration"` — Vertical exaggeration applied when 3D mode is enabled.

MapLibre GL JS supports only a single DEM source per map, so this is a
global setting rather than a per-basemap option.
