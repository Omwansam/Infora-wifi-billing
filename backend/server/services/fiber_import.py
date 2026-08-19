"""Import surveyed fiber plant from KML (Google Earth) and GeoJSON.

Field surveys arrive as KML far more often than anything else — someone walks
the route with Google Earth or a GPS app and mails a .kml. This turns that into
nodes and cables.

The one thing that bites everybody: **KML stores coordinates as lon,lat,alt** —
longitude first — while GeoJSON does too, and Leaflet wants lat,lng. Every
conversion in this module normalises to [lat, lng] at the boundary so nothing
downstream has to remember.
"""
import json
import re
import xml.etree.ElementTree as ET

from extensions import db
from models import FiberCable, FiberNode
from services.fiber_geo import path_length_m, serialize_path

KML_NS = {'kml': 'http://www.opengis.net/kml/2.2'}

# Placemark names are the only hint most surveys carry about what a point is.
KIND_HINTS = (
    ('olt', 'olt'), ('headend', 'olt'), ('head-end', 'olt'),
    ('cabinet', 'cabinet'), ('fdt', 'cabinet'),
    ('splitter', 'splitter'), ('split', 'splitter'),
    ('odb', 'odb'), ('fat', 'odb'), ('fdb', 'odb'),
    ('joint', 'joint'), ('closure', 'joint'), ('splice', 'joint'),
    ('pole', 'pole'), ('handhole', 'handhole'), ('manhole', 'handhole'),
)

CABLE_HINTS = (
    ('feeder', 'feeder'), ('backbone', 'backbone'),
    ('distribution', 'distribution'), ('dist', 'distribution'),
    ('drop', 'drop'),
)


class ImportError_(Exception):
    """Raised for a file we cannot make sense of."""


def _guess_kind(name, default='odb'):
    lowered = (name or '').lower()
    for needle, kind in KIND_HINTS:
        if needle in lowered:
            return kind
    return default


def _guess_cable_type(name, default='distribution'):
    lowered = (name or '').lower()
    for needle, cable_type in CABLE_HINTS:
        if needle in lowered:
            return cable_type
    return default


def _kml_coords(text):
    """'lon,lat,alt lon,lat,alt' -> [[lat, lng], ...]. Note the swap."""
    points = []
    for chunk in re.split(r'\s+', (text or '').strip()):
        if not chunk:
            continue
        parts = chunk.split(',')
        if len(parts) < 2:
            continue
        try:
            lng, lat = float(parts[0]), float(parts[1])
        except ValueError:
            continue
        points.append([lat, lng])
    return points


def parse_kml(data):
    """-> {'points': [{name, lat, lng, kind}], 'lines': [{name, path, type}]}"""
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise ImportError_(f'Not valid KML/XML: {exc}') from exc

    # Namespaced and bare KML both occur in the wild.
    def find_all(tag):
        return root.findall(f'.//kml:{tag}', KML_NS) or root.findall(f'.//{tag}')

    points, lines = [], []
    for placemark in find_all('Placemark'):
        name_el = (placemark.find('kml:name', KML_NS)
                   if placemark.find('kml:name', KML_NS) is not None
                   else placemark.find('name'))
        name = (name_el.text or '').strip() if name_el is not None else ''

        for point in (placemark.findall('.//kml:Point/kml:coordinates', KML_NS)
                      or placemark.findall('.//Point/coordinates')):
            coords = _kml_coords(point.text)
            if coords:
                lat, lng = coords[0]
                points.append({'name': name or 'Imported point', 'lat': lat, 'lng': lng,
                               'kind': _guess_kind(name)})

        for line in (placemark.findall('.//kml:LineString/kml:coordinates', KML_NS)
                     or placemark.findall('.//LineString/coordinates')):
            coords = _kml_coords(line.text)
            if len(coords) >= 2:
                lines.append({'name': name or 'Imported cable', 'path': coords,
                              'type': _guess_cable_type(name)})

    if not points and not lines:
        raise ImportError_('No Placemark points or lines found in this KML.')
    return {'points': points, 'lines': lines}


def parse_geojson(data):
    """Same shape as parse_kml, from a FeatureCollection or bare geometry."""
    try:
        doc = json.loads(data)
    except (TypeError, ValueError) as exc:
        raise ImportError_(f'Not valid GeoJSON: {exc}') from exc

    features = doc.get('features') if isinstance(doc, dict) else None
    if features is None:
        features = [doc] if isinstance(doc, dict) else []

    points, lines = [], []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get('properties') or {}
        name = str(props.get('name') or props.get('Name') or '').strip()
        geometry = feature.get('geometry') or feature
        gtype = geometry.get('type')
        coords = geometry.get('coordinates')
        if not gtype or coords is None:
            continue

        if gtype == 'Point' and len(coords) >= 2:
            points.append({'name': name or 'Imported point',
                           'lat': float(coords[1]), 'lng': float(coords[0]),
                           'kind': _guess_kind(name, default=str(props.get('kind') or 'odb'))})
        elif gtype == 'LineString':
            path = [[float(c[1]), float(c[0])] for c in coords if len(c) >= 2]
            if len(path) >= 2:
                lines.append({'name': name or 'Imported cable', 'path': path,
                              'type': _guess_cable_type(name)})
        elif gtype == 'MultiLineString':
            for part in coords:
                path = [[float(c[1]), float(c[0])] for c in part if len(c) >= 2]
                if len(path) >= 2:
                    lines.append({'name': name or 'Imported cable', 'path': path,
                                  'type': _guess_cable_type(name)})

    if not points and not lines:
        raise ImportError_('No point or line features found in this GeoJSON.')
    return {'points': points, 'lines': lines}


def parse_any(filename, data):
    if (filename or '').lower().endswith(('.geojson', '.json')):
        return parse_geojson(data)
    if (filename or '').lower().endswith('.kml'):
        return parse_kml(data)
    # Sniff: a survey file mailed as .txt is still usually one of the two.
    stripped = (data or '').lstrip()
    return parse_geojson(data) if stripped.startswith('{') else parse_kml(data)


def commit_import(isp_id, parsed, dry_run=False):
    """Turn a parsed survey into rows.

    Imported cables are left **unattached** (`from_node_id` pointing at a
    generated endpoint node) rather than guessed onto existing nodes: a wrong
    automatic join is far more expensive to find later than an obvious gap the
    operator connects by hand on the map.
    """
    created_nodes, created_cables = [], []

    for point in parsed.get('points', []):
        node = FiberNode(
            isp_id=isp_id, name=point['name'][:120], kind=point.get('kind') or 'odb',
            latitude=point['lat'], longitude=point['lng'], status='planned',
            notes='Imported from survey file',
        )
        created_nodes.append(node)
        if not dry_run:
            db.session.add(node)

    for line in parsed.get('lines', []):
        path = line['path']
        # Every cable needs an anchor; a bare survey line has none, so give it
        # endpoints the operator can then merge into real plant.
        start = FiberNode(isp_id=isp_id, name=f"{line['name']} start"[:120], kind='joint',
                          latitude=path[0][0], longitude=path[0][1], status='planned',
                          notes='Imported cable endpoint')
        end = FiberNode(isp_id=isp_id, name=f"{line['name']} end"[:120], kind='joint',
                        latitude=path[-1][0], longitude=path[-1][1], status='planned',
                        notes='Imported cable endpoint')
        cable = FiberCable(
            isp_id=isp_id, name=line['name'][:120],
            cable_type=line.get('type') or 'distribution',
            path=serialize_path(path), length_m=round(path_length_m(path), 1),
            status='planned', notes='Imported from survey file',
        )
        created_nodes += [start, end]
        created_cables.append(cable)
        if not dry_run:
            db.session.add_all([start, end])
            db.session.flush()
            cable.from_node_id = start.id
            cable.to_node_id = end.id
            db.session.add(cable)

    if not dry_run:
        db.session.commit()

    return {
        'nodes': len(created_nodes),
        'cables': len(created_cables),
        'total_length_m': round(sum(c.length_m or 0 for c in created_cables), 1),
        'dry_run': dry_run,
    }
