## TitleAttribute Property
`"titleAttribute": String`

The name of the attribute to use as the title for a feature from this layer.

For richer formatting (e.g. converting a raw number into a percentage,
combining multiple attributes, or applying `toFixed`), use
[`titleFormat`](#titleformat-property).


## TitleFormat Property
`"titleFormat": String`

A template string used to compose the feature title shown in the Identify
panel and query results.  Tokens of the form `<%= expr %>` are replaced
with the result of evaluating *expr* against the feature.

In scope inside each `<%= %>`:

| Variable     | Description |
|--------------|-------------|
| `properties` | The feature's properties object. |
| `feature`    | The full GeoJSON feature. |
| `value`      | The raw value of [`titleAttribute`](#titleattribute-property), if it is also set. |

A bare attribute name resolves directly to the property value as a
fast-path \u2014 e.g. `<%= NAME %>` is equivalent to `<%= properties.NAME %>`.

When `titleFormat` is set it takes precedence over `titleAttribute`; if
the template fails to evaluate, `titleAttribute` (or the default
`Feature #N`) is used as a fallback.

Examples:

```jsonc
// Format a fractional number as a percentage:
{ "titleAttribute": "PCT_COVER",
  "titleFormat":    "<%= (value * 100).toFixed(1) %>% cover" }

// Combine multiple attributes:
{ "titleFormat": "<%= NAME %> (<%= AREA_HA %> ha)" }

// Conditional formatting:
{ "titleFormat": "<%= STATUS === 'A' ? 'Active' : 'Inactive' %> \u2014 <%= NAME %>" }

// Date formatting:
{ "titleFormat": "<%= new Date(properties.OBSERVED).toLocaleDateString() %>" }
```