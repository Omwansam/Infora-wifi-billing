# Fiber plant (OSP) — the map, and why it is a diagnostic

The fiber section models the **outside plant**: the physical tree of boxes and
cable between the head-end and each subscriber's ONT.

```
OLT ─ PON port ─ feeder ─ Splitter (FDT) ─ distribution ─ ODB/FAT ─ drop ─ ONT
                                                                          ↑ already
                                                                            instrumented
```

The ONT end already existed before this feature: every `CpeDevice` carries
`rx_power_dbm` from the TR-069 ACS (see `TR069.md`). Everything above it is new.

---

## The point of it

Plotting boxes on a map is presentation. The thing worth building is the
comparison between an ONT's **measured** receive power and what the plant says
it **should** be.

> A subscriber 6 km out on a 1:32 split reading −24 dBm is healthy.
> One 400 m out on a 1:8 reading the same number has a fault.

Only the plant model can tell those apart, and `services/fiber_geo.predict_rx_dbm()`
is what does it. Two consequences fall out:

1. **Per-ONT diagnosis.** `discrepancy_db` on the map payload is measured minus
   predicted. Beyond ±3 dB the marker gets a dark ring — the reading may look
   acceptable while still being wrong *for that distance and split*.
2. **Fault localisation.** `localise_faults()` walks the tree and reports the
   deepest node whose whole subtree is degraded. One bad ONT under a healthy ODB
   is a drop cable or the premises. *Every* ONT under one ODB going dark is that
   ODB, its feed, or the splitter above it — **one van to a splice point instead
   of five to living rooms.** Suspects are ranked deepest-first because the most
   specific node that explains the damage is the one to visit.

Localisation only works when ONTs are linked to their port. That link is made on
the **Splice plan** tab (or by the field app), and the map says so explicitly
when no ONT has one yet.

---

## Data model

| Table | What it holds |
|---|---|
| `fiber_nodes` | Every node kind in one tree — OLT, cabinet, splitter, ODB, joint, pole, handhole. `parent_id` is the upstream link. |
| `fiber_cables` | A segment with its **drawn route** in `path` (JSON `[[lat,lng],…]`), plus `fiber_count`, `length_m`, `slack_m`. |
| `fiber_splices` | One row per occupied port: strand number, tube/fibre colour, what it serves. |

Three deliberate choices:

- **One table for all node kinds**, not one per kind. They differ in what they
  *contain*, not in what a map or an upstream trace needs from them. "Walk from
  this ONT to its OLT" is one recursive walk instead of a union across four
  tables.
- **`length_m` is always server-computed** from `path`. A client-supplied length
  is how cable inventory quietly stops matching the map.
- **Port occupancy is derived from the presence of a splice row**, never from a
  counter, so it cannot drift. The `uq_fiber_splice_node_port` constraint is what
  makes "is port 6 free?" answerable from the table alone.

New columns elsewhere: `customers.latitude/longitude/geo_source/geo_updated_at`,
`cpe_devices.latitude/longitude/fiber_node_id`. All created by
`ensure_schema_upgrades()` on boot — **no Alembic migration**, per house style.

---

## Coordinates — four ways in

Nothing in the database had a latitude before this feature; every "location"
field was free text. All four paths write to the same columns:

| Path | Where | Note |
|---|---|---|
| Click-to-place | Map: `Add node`, or drag any marker | The baseline. Every other method still needs correcting by hand. |
| Bulk geocode | Map: `Geocode addresses` → `POST /api/fiber/geocode` | OSM Nominatim, **1 req/sec** with a real User-Agent — exceeding it gets the deployment's IP blocked. Kenyan informal addresses geocode poorly, so results are stamped `geo_source='geocode'` and drawn as a dashed hollow pin: an approximation must never look like a survey. |
| KML / GeoJSON | Map: `Import survey` → `POST /api/fiber/import` | `?dry_run=1` previews first. **KML and GeoJSON store `lon,lat`** — reversed from Leaflet — and `services/fiber_import` normalises at the boundary so nothing downstream has to remember. Imports land as `planned` and *unattached*: a wrong automatic join costs far more to find later than an obvious gap. |
| Field GPS | Mobile app → `More → Field survey` | Lists unplaced nodes, pins from `expo-location`. Refuses to save quietly above ±20 m accuracy — a rough pin sends the next tech to the wrong side of the road while looking authoritative. |

---

## Optical constants

In `services/fiber_geo.py`, all standard planning figures:

| Term | Value |
|---|---|
| Fibre attenuation | 0.30 dB/km (covers 1310 up / 1490 down with margin) |
| Splitter insertion loss | 1:8 → 10.5 dB, 1:16 → 13.5, 1:32 → 17.0 (a node's own `splitter_loss_db` wins) |
| Connector | 0.5 dB per mated pair |
| Splice | 0.1 dB per fusion |
| OLT launch | +3.0 dBm (Class B+) |
| ONT sensitivity | −27 dBm — below this a branch cannot work as designed |

Optical health bands are **identical** to `routes/cpe.py::_optical_health`. Keep
them that way: a map and a device page disagreeing about the same reading is
worse than either alone.

The loss breakdown rounds each term *before* summing, because the UI prints the
four terms above a total and a total derived from unrounded values disagrees with
the numbers beneath it by a hundredth — which reads as a broken sum.

---

## Map stack

Leaflet + react-leaflet 4 + OpenStreetMap tiles. Free, no API key.

- **OSM's tile policy** requires attribution (present) and discourages heavy
  commercial traffic. Self-host tiles if the fleet grows.
- Markers are **`divIcon`s (styled HTML)**, not image icons: Leaflet's default
  PNGs resolve relative to the stylesheet and 404 under Vite, and HTML markers
  carry health colour and port state without a sprite per combination.
- ONTs and subscribers render inside `MarkerClusterGroup` so thousands of pins
  stay usable.
- `GET /api/fiber/map` returns **everything in one request** — a map cannot
  render usefully until it has all layers, and staggered responses make it jump.
- Bounds are fitted **once**, on first load. Refitting on every reload would
  fight the operator's panning.

---

## Pages

| Route | Purpose |
|---|---|
| `/fiber/map` | The geographic view; drawing, placing, tracing, fault suspects |
| `/fiber/nodes` | Searchable table with port occupancy — finding a free port is a list problem, not a map problem |
| `/fiber/cables` | Segment inventory with per-type route totals, which is what reorders are made from |
| `/fiber/splices` | Port sheet per node; TIA-598-C strand colours in standard order |

---

## Guards worth knowing

- **Parent cycles are refused** on `PUT /api/fiber/nodes/<id>` — a cycle would
  make every upstream trace loop. `walk_upstream()` is *also* depth-capped, so
  bad data already in the table cannot hang a request.
- **Deleting a node with children is refused (409)** rather than silently
  orphaning a branch.
- Deleting a node clears `cpe_devices.fiber_node_id` for anything below it, so an
  ONT is never left pointing at a node that no longer exists.

---

## Testing

`backend/server/tests/test_fiber_plant.py` — 36 tests, no database. Covers the
loss budget (bigger split predicts exactly 6.5 dB less, terms sum to their own
total, slack counts), health bands, cycle survival, and the localisation
thresholds in both directions: a fully dark branch raises a suspect, one bad ONT
among healthy ones does not.

Layout: `services/{fiber_geo,fiber_import,geocoding}.py`, `routes/fiber.py`
(`/api/fiber`), models `FiberNode|FiberCable|FiberSplice`, pages
`components/fiber/*`, mobile `MOBILE/lumen-billing/src/app/fiber/`.
