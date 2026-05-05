###### [SMK](../../..) / [Configuration](..) / [Layers](.)

# Vector Layer

This is default configuration for the Vector layer.
Click on a property name for more information:
<pre>
{ "layers": [ {
    <a href="#type-property"                >"type"</a>:                "vector",
    <a href="#id-property"                  >"id"</a>:                  null,
    <a href="#title-property"               >"title"</a>:               null,
    <a href="#opacity-property"             >"opacity"</a>:             null,
    <a href="#isvisible-property"           >"isVisible"</a>:           false,
    <a href="#isqueryable-property"         >"isQueryable"</a>:         true,
    <a href="#minscale-property"            >"minScale"</a>:            null,
    <a href="#maxscale-property"            >"maxScale"</a>:            null,
    <a href="#metadataurl-property"         >"metadataUrl"</a>:         null,
    <a href="#popuptemplate-property"       >"popupTemplate"</a>:       null,
    <a href="#titleattribute-property"      >"titleAttribute"</a>:      null,
    <a href="#titleformat-property"         >"titleFormat"</a>:         null,
    <a href="#attributes-property"          >"attributes"</a>:          null,
    <a href="#queries-property"             >"queries"</a>:             null,
    <a href="#useclustering-property"       >"useClustering"</a>:       false,
    <a href="#useheatmap-property"          >"useHeatmap"</a>:          false,
    <a href="#cluster-property"             >"cluster"</a>:             null,
    <a href="#heatmap-property"             >"heatmap"</a>:             null,
    <a href="#style-property"               >"style"</a>:               null,
    <a href="#label-property"               >"label"</a>:               null,
    <a href="#dataUrl-property"             >"dataUrl"</a>:             null
} ] }
</pre>

{% include_relative include/type-property.md %}
{% include_relative include/id-property.md %}
{% include_relative include/title-property.md %}
{% include_relative include/opacity-property.md %}
{% include_relative include/is-visible-property.md %}
{% include_relative include/is-queryable-property.md %}
{% include_relative include/min-scale-property.md %}
{% include_relative include/max-scale-property.md %}
{% include_relative include/metadata-url-property.md %}
{% include_relative include/popup-template-property.md %}
{% include_relative include/title-attribute-property.md %}
{% include_relative include/attributes-property.md %}
{% include_relative include/queries-property.md %}


## UseClustering Property
`"useClustering": Boolean`

If `true`, the layer should use point clustering.
Only relevant for point geometry layers.
The default is `false`.


## UseHeatmap Property
`"useHeatmap": Boolean`

If `true`, the layer should use heatmap clustering.
Only relevant for point geometry layers.
The default is `false`.


## Cluster Property
`"cluster": Boolean | Object`

*MapLibre viewer only.*  Aggregate overlapping points into clickable
cluster bubbles.  Clicking a cluster eases the map to its expansion zoom.
Only Point / MultiPoint geometry is clustered; polygons and lines pass
through unchanged.

Shorthand: `"cluster": true` enables clustering with sensible defaults.

Object form supports:

| Property    | Type      | Description |
|-------------|-----------|-------------|
| `radius`    | `Number`  | Cluster pixel radius. Defaults to `50`. |
| `maxZoom`   | `Number`  | Maximum zoom at which features cluster. Defaults to `14`. |
| `minPoints` | `Number`  | Minimum points to form a cluster. |
| `color`     | `String`  | Default cluster bubble fill colour. |
| `textColor` | `String`  | Cluster count text colour. Defaults to `#222`. |
| `textSize`  | `Number`  | Cluster count font size in pixels. Defaults to `12`. |
| `font`      | `Array`   | Ordered list of font names (must exist in the basemap glyphs). |
| `opacity`   | `Number`  | Cluster bubble opacity, `0` – `1`. Defaults to `0.85`. |
| `steps`     | `Array`   | `[ [count, color], ... ]` thresholds — bubble colour and radius are stepped at each `count`. |

Example:

```json
{
    "type": "vector",
    "id":   "bc-fires",
    "dataProvider": "bc-out-of-control-fires",
    "cluster": {
        "radius":    40,
        "maxZoom":   10,
        "color":     "#b00020",
        "textColor": "#fff",
        "steps":  [ [ 5, "#ffb199" ], [ 20, "#ff5252" ], [ 50, "#b00020" ] ]
    }
}
```


## Heatmap Property
`"heatmap": Boolean | Object`

*MapLibre viewer only.*  Render the layer as a density heatmap.  Only
Point / MultiPoint geometry contributes to the heatmap; other geometry
is still drawn by the normal style.

Shorthand: `"heatmap": true` enables the heatmap with sensible defaults.

Object form supports:

| Property      | Type                | Description |
|---------------|---------------------|-------------|
| `weight`      | `Number` \| Expr.   | Per-feature weight. Defaults to `1`. |
| `weightField` | `String`            | Convenience: use this feature property as the weight (coerced to number, missing → `0`). |
| `intensity`   | `Number` \| Stops   | Heatmap intensity. Stops form: `[ [zoom, value], ... ]`. Defaults to `1` → `3`. |
| `radius`      | `Number` \| Stops   | Pixel radius. Stops form: `[ [zoom, value], ... ]`. Defaults to `8` → `30`. |
| `opacity`     | `Number` \| Stops   | Heatmap opacity. Defaults to a fade-out near `maxZoom`. |
| `colorRamp`   | `Array`             | `[ [t, color], ... ]` palette for `heatmap-density`, `t` in `0`–`1`. Defaults to MapLibre's blue→red ramp. |
| `minZoom`     | `Number`            | Heatmap appears at this zoom and above. Defaults to `0`. |
| `maxZoom`     | `Number`            | Heatmap fades out beyond this zoom. Defaults to `15`. |
| `showPoints`  | `Boolean`           | If `true` (default), the underlying points are also drawn above `maxZoom`. |

Cluster and heatmap are independent and may be used together.

Example:

```json
{
    "type": "vector",
    "id":   "bc-fires-heatmap",
    "dataProvider": "bc-out-of-control-fires",
    "heatmap": {
        "maxZoom":   9,
        "radius":    [ [ 0, 4 ], [ 6, 18 ], [ 9, 36 ] ],
        "intensity": [ [ 0, 0.6 ], [ 9, 2.5 ] ],
        "showPoints": true
    }
}
```


## Style Property
`"style": Object | Array`

The [style object](style) used to render the features from this data source.


## Label Property
`"label": String | Object`

Render a permanent text label on each feature.

Shorthand: a string is treated as the name of an attribute to use as the label
text — `"label": "NAME"` is equivalent to `"label": { "field": "NAME" }`.

Object form supports:

| Property        | Type      | Description |
|-----------------|-----------|-------------|
| `field`         | `String`  | Attribute name. Used as the label when `format` is not supplied. |
| `format`        | `String`  | Template string. Tokens of the form `{attr}` are replaced with the feature's property values. Overrides `field`. |
| `color`         | `String`  | CSS colour for the label text. Defaults to `#222`. |
| `size`          | `Number`  | Font size in pixels. Defaults to `12`. |
| `haloColor`     | `String`  | CSS colour for the text halo / outline. Defaults to `#fff`. |
| `haloWidth`     | `Number`  | Halo width in pixels. Defaults to `1.5`. |
| `font`          | `Array`   | (MapLibre only) An ordered list of font names available in the map style's glyphs. |
| `anchor`        | `String`  | (MapLibre) Text anchor — `center`, `top`, `bottom`, `left`, etc. |
| `direction`     | `String`  | (Leaflet) Tooltip direction — `center`, `top`, `bottom`, `left`, `right`, `auto`. |
| `offset`        | `Array`   | `[x, y]` pixel offset. |
| `placement`     | `String`  | (MapLibre) `point`, `line`, or `line-center`. Defaults to `point`. |
| `minZoom`       | `Number`  | (MapLibre) Smallest zoom at which the label is visible. |
| `maxZoom`       | `Number`  | (MapLibre) Largest zoom at which the label is visible. |
| `allowOverlap`  | `Boolean` | (MapLibre) If `true`, labels are drawn even when they overlap. Defaults to `false`. |
| `opacity`       | `Number`  | Label opacity, `0` – `1`. Defaults to `1`. |
| `className`     | `String`  | (Leaflet) Extra CSS class to apply to the tooltip element. |

Example:

```json
{
    "type":    "vector",
    "id":      "parks",
    "dataUrl": "/data/parks.geojson",
    "label": {
        "format":    "{NAME} ({AREA_HA} ha)",
        "color":     "#003366",
        "size":      13,
        "haloColor": "#ffffff",
        "haloWidth": 2
    }
}
```


## DataUrl Property
`"dataUrl": String`

The URL that points to a GeoJSON data source.




