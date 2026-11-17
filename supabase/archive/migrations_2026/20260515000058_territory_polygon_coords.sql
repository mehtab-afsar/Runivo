-- Add polygon_coords JSONB + owner_name to territory_polygons.
-- A BEFORE INSERT OR UPDATE trigger derives geom + geom_simplified from polygon_coords,
-- so the JS client only needs to send the raw coordinate array.

ALTER TABLE territory_polygons
  ADD COLUMN IF NOT EXISTS owner_name     TEXT,
  ADD COLUMN IF NOT EXISTS polygon_coords JSONB NOT NULL DEFAULT '[]';

-- Derive PostGIS geometry from polygon_coords on every insert/update.
-- polygon_coords must be a closed GeoJSON ring: [[lng,lat], ..., [lng,lat]]
-- (first point == last point, minimum 4 elements).
CREATE OR REPLACE FUNCTION tp_derive_geom()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_array_length(NEW.polygon_coords) < 4 THEN
    RAISE EXCEPTION 'territory_polygons: polygon_coords must have >= 4 points';
  END IF;

  NEW.geom = ST_SetSRID(
    ST_GeomFromGeoJSON(
      json_build_object(
        'type',        'Polygon',
        'coordinates', json_build_array(NEW.polygon_coords)
      )::text
    ),
    4326
  );
  NEW.geom_simplified = ST_SimplifyPreserveTopology(NEW.geom, 0.0001);
  RETURN NEW;
END;
$$;

-- Only fire when polygon_coords is supplied or changed (skip freshness-only updates)
CREATE TRIGGER tp_geom_trigger
  BEFORE INSERT OR UPDATE OF polygon_coords
  ON territory_polygons
  FOR EACH ROW EXECUTE FUNCTION tp_derive_geom();
