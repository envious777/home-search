import { useEffect, useRef, useState } from "react";
import ArcGISMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import GroupLayer from "@arcgis/core/layers/GroupLayer";
import MapImageLayer from "@arcgis/core/layers/MapImageLayer";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import PolygonSymbol3D from "@arcgis/core/symbols/PolygonSymbol3D";
import ExtrudeSymbol3DLayer from "@arcgis/core/symbols/ExtrudeSymbol3DLayer";
import SunLighting from "@arcgis/core/views/3d/environment/SunLighting";
import LocatorSearchSource from "@arcgis/core/widgets/Search/LocatorSearchSource";
import Search from "@arcgis/core/widgets/Search";
import type { BuildingInfo, LayerDefinition, SelectedLocation } from "../../types";
import {
  DEFAULT_SUN_HOUR,
  ACTIVE_PIN_COLOR,
  BUILDING_COLOR,
  GEOCODER_URL,
  layers,
  MAP_CENTER,
  MAP_INITIAL_ZOOM,
  MAX_SUN_HOUR,
  MIN_SUN_HOUR,
  SAVED_PIN_COLOR,
  TIMELAPSE_END_YEAR,
  TIMELAPSE_FRAME_MS,
  TIMELAPSE_START_YEAR,
  imageryYears,
} from "../../lib/map/constants";
import {
  buildingFootprint,
  buildingHeightMeters,
  imageryForYear,
  larimerCountyExtent,
  pinSymbol,
} from "../../lib/map/module";

type MapLocation = { latitude: number; longitude: number; canonicalAddress: string; city?: string };
type AnyView = MapView | SceneView;

interface Props {
  activeLayers: LayerDefinition[];
  selected: MapLocation | null;
  saved: SelectedLocation[];
  buildingInfo: BuildingInfo | null;
  onSelect: (value: {
    latitude: number;
    longitude: number;
    canonicalAddress: string;
    city: string;
    attributes: Record<string, unknown>;
  }) => void;
}

export const MapViewPanel = ({ activeLayers, selected, saved, buildingInfo, onSelect }: Props) => {
  const [basemap, setBasemap] = useState<"streets-navigation-vector" | "satellite">("streets-navigation-vector");
  const [sunHour, setSunHour] = useState(DEFAULT_SUN_HOUR);
  const [shadowsEnabled, setShadowsEnabled] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
  const [timelapseEnabled, setTimelapseEnabled] = useState(false);
  const [timelapseYear, setTimelapseYear] = useState(TIMELAPSE_END_YEAR);
  const [timelapsePlaying, setTimelapsePlaying] = useState(false);
  const imageryLayerRefs = useRef(new Map<string, MapImageLayer>());
  const node = useRef<HTMLDivElement>(null);
  const viewRef = useRef<AnyView | null>(null);
  const savedLayerRef = useRef<GraphicsLayer | null>(null);
  const buildingLayerRef = useRef<GraphicsLayer | null>(null);
  const layerRefs = useRef(new Map<string, FeatureLayer | GroupLayer>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!node.current) {
      return;
    }

    const map = new ArcGISMap({ basemap, ...(shadowsEnabled ? { ground: "world-elevation" } : {}) });
    let view: AnyView;
    if (shadowsEnabled) {
      const initialDate = new Date();
      initialDate.setHours(sunHour, 0, 0, 0);
      view = new SceneView({
        container: node.current,
        map,
        center: MAP_CENTER,
        zoom: MAP_INITIAL_ZOOM,
        environment: { lighting: new SunLighting({ date: initialDate, directShadowsEnabled: true }) },
      });
    } else {
      view = new MapView({ container: node.current, map, center: MAP_CENTER, zoom: MAP_INITIAL_ZOOM });
    }
    const savedLayer = new GraphicsLayer({ title: "Saved locations" });
    map.add(savedLayer);
    savedLayerRef.current = savedLayer;
    if (shadowsEnabled) {
      const buildingLayer = new GraphicsLayer({
        title: "Building footprint (estimated)",
        elevationInfo: { mode: "relative-to-ground" },
      });
      map.add(buildingLayer);
      buildingLayerRef.current = buildingLayer;
    } else {
      buildingLayerRef.current = null;
    }
    const search = new Search({
      view,
      includeDefaultSources: false,
      locationEnabled: false,
      sources: [
        new LocatorSearchSource({
          url: GEOCODER_URL,
          countryCode: "USA",
          filter: { geometry: larimerCountyExtent },
          singleLineFieldName: "SingleLine",
          name: "Larimer County addresses",
          placeholder: "Search an address in Larimer County",
        }),
      ],
    });
    view.ui.add(search, "top-right");
    search.on("select-result", (event) => {
      const result = event.result;
      const point = result.feature.geometry as Point;
      const attributes = result.feature.attributes ?? {};
      const city = String(attributes.City ?? attributes.city ?? result.name.split(",")[1]?.trim() ?? "");
      onSelectRef.current({
        latitude: point.latitude ?? 0,
        longitude: point.longitude ?? 0,
        canonicalAddress: result.name,
        city,
        attributes,
      });
    });
    viewRef.current = view;
    setViewVersion((current) => current + 1);
    return () => {
      view.destroy();
      viewRef.current = null;
      layerRefs.current.clear();
      imageryLayerRefs.current.clear();
      savedLayerRef.current = null;
      buildingLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadowsEnabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!shadowsEnabled || !(view instanceof SceneView)) {
      return;
    }
    const date = new Date();
    date.setHours(sunHour, 0, 0, 0);
    view.environment.lighting = new SunLighting({ date, directShadowsEnabled: true });
  }, [sunHour, shadowsEnabled, viewVersion]);

  useEffect(() => {
    const layer = buildingLayerRef.current;
    if (!layer) {
      return;
    }
    layer.removeAll();
    if (!selected || !buildingInfo) {
      return;
    }
    // Footprint area = total finished sf spread across stories; use a rectangular approximation for a cuboid.
    const footprint = buildingFootprint(selected, buildingInfo);
    const heightMeters = buildingHeightMeters(buildingInfo);
    layer.add(
      new Graphic({
        geometry: footprint,
        symbol: new PolygonSymbol3D({
          symbolLayers: [
            new ExtrudeSymbol3DLayer({
              size: heightMeters,
              castShadows: true,
              material: { color: BUILDING_COLOR },
            }),
          ],
        }),
      }),
    );
  }, [selected, buildingInfo, viewVersion]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const activeIds = new Set(activeLayers.map((layer) => layer.id));
    layerRefs.current.forEach((layer, id) => {
      layer.visible = activeIds.has(id);
    });
    activeLayers.forEach((definition) => {
      if (!layerRefs.current.has(definition.id)) {
        if (definition.pointTable || definition.imageLayers) {
          // Export images in the view's spatial reference so they line up with the gage points.
          const imageLayers = (definition.imageLayers ?? []).map(
            (image) =>
              new MapImageLayer({
                url: image.url,
                title: image.title,
                imageFormat: "png32",
                sublayers: image.sublayerIds.map((id) => ({ id, visible: true, popupEnabled: false })),
              }),
          );
          const group = new GroupLayer({ title: definition.title, visible: true, layers: imageLayers });
          layerRefs.current.set(definition.id, group);
          view.map?.add(group);
          if (!definition.pointTable) {
            return;
          }
          const graphicsLayer = new GraphicsLayer({ title: `${definition.title} gages` });
          group.add(graphicsLayer);
          const { latitudeField, longitudeField, dateField, displayField, popupFields } = definition.pointTable;
          const fields = [displayField, latitudeField, longitudeField, dateField, ...popupFields.map((field) => field.fieldName)];
          const params = new URLSearchParams({
            where: "1=1",
            outFields: [...new Set(fields)].join(","),
            returnGeometry: "false",
            orderByFields: `${dateField} DESC`,
            resultRecordCount: "2000",
            f: "json",
          });
          void fetch(`${definition.url}/query?${params}`)
            .then(async (response) => {
              if (!response.ok) {
                throw new Error(`Floodwarning query failed (${response.status})`);
              }
              const result = await response.json();
              if (result.error) {
                throw new Error(result.error.message ?? "Floodwarning query failed");
              }
              if (layerRefs.current.get(definition.id) !== group) {
                return;
              }
              const latestBySensor = new Map<string, Record<string, unknown>>();
              for (const feature of result.features ?? []) {
                const attributes = feature.attributes as Record<string, unknown>;
                const sensorName = String(attributes[displayField] ?? "");
                const latitude = Number(attributes[latitudeField]);
                const longitude = Number(attributes[longitudeField]);
                if (!sensorName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                  continue;
                }
                if (!latestBySensor.has(sensorName)) {
                  latestBySensor.set(sensorName, attributes);
                }
              }
              latestBySensor.forEach((attributes) => {
                graphicsLayer.add(
                  new Graphic({
                    geometry: new Point({
                      latitude: Number(attributes[latitudeField]),
                      longitude: Number(attributes[longitudeField]),
                    }),
                    attributes,
                    symbol: {
                      type: "simple-marker",
                      style: "circle",
                      color: definition.color,
                      size: 10,
                      outline: { color: "#FFFFFF", width: 1.5 },
                    },
                    popupTemplate: {
                      title: `{${displayField}}`,
                      content: [{ type: "fields", fieldInfos: popupFields }],
                    },
                  }),
                );
              });
            })
            .catch((error: unknown) => console.error(`Unable to load ${definition.title}`, error));
          return;
        }
        const layer = new FeatureLayer({
          url: definition.url,
          visible: true,
          outFields: ["*"],
          title: definition.title,
          popupTemplate: {
            title: definition.title,
            content: [{ type: "fields", fieldInfos: [{ fieldName: "*", label: "Attributes" }] }],
          },
        });
        layerRefs.current.set(definition.id, layer);
        view.map?.add(layer);
      }
    });
    const savedLayer = savedLayerRef.current;
    if (savedLayer && view.map) {
      view.map.reorder(savedLayer, view.map.layers.length - 1);
    }
  }, [activeLayers, viewVersion]);

  useEffect(() => {
    const view = viewRef.current;
    if (view?.map) {
      view.map.basemap = basemap;
    }
  }, [basemap, viewVersion]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view?.map) {
      return;
    }
    const layers = imageryLayerRefs.current;
    if (!timelapseEnabled) {
      layers.forEach((layer) => (layer.visible = false));
      return;
    }
    // Larimer caches tiles in State Plane (2876), so use dynamic export to let the server reproject to the view.
    const { url } = imageryForYear(timelapseYear);
    let active = layers.get(url);
    if (!active) {
      active = new MapImageLayer({ url, title: "Historical imagery", imageFormat: "jpg" });
      layers.set(url, active);
      view.map.add(active, 0);
    }
    active.visible = true;
    view.map.reorder(active, 0);
    const target = active;
    let cancelled = false;
    // Keep the previous year on screen until the new one has drawn to avoid flashing the basemap.
    void view
      .whenLayerView(target)
      .then((layerView) => reactiveUtils.whenOnce(() => !layerView.updating))
      .then(() => {
        if (cancelled) {
          return;
        }
        layers.forEach((layer) => {
          if (layer !== target) {
            layer.visible = false;
          }
        });
      })
      .catch((error: unknown) => console.error("Unable to load historical imagery", error));
    return () => {
      cancelled = true;
    };
  }, [timelapseEnabled, timelapseYear, viewVersion]);

  useEffect(() => {
    if (!timelapseEnabled || !timelapsePlaying) {
      return;
    }
    const timer = window.setInterval(() => {
      setTimelapseYear((current) => imageryYears.find((year) => year > current) ?? imageryYears[0]);
    }, TIMELAPSE_FRAME_MS);
    return () => window.clearInterval(timer);
  }, [timelapseEnabled, timelapsePlaying]);

  useEffect(() => {
    const layer = savedLayerRef.current;
    if (!layer) {
      return;
    }
    const isScene = viewRef.current instanceof SceneView;
    layer.removeAll();
    saved.forEach((item) => {
      const isSelected =
        selected?.canonicalAddress === item.canonicalAddress &&
        selected.latitude === item.latitude &&
        selected.longitude === item.longitude;
      if (isSelected) {
        return;
      }
      layer.add(
        new Graphic({
          geometry: new Point({ longitude: item.longitude, latitude: item.latitude }),
          symbol: pinSymbol(SAVED_PIN_COLOR, 18, isScene),
          attributes: { address: item.canonicalAddress },
          popupTemplate: { title: "Saved · {address}" },
        }),
      );
    });
  }, [saved, selected, viewVersion]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selected) {
      return;
    }
    view.graphics.removeAll();
    const point = new Point({ longitude: selected.longitude, latitude: selected.latitude });
    view.graphics.add(
      new Graphic({
        geometry: point,
        symbol: pinSymbol(ACTIVE_PIN_COLOR, 26, view instanceof SceneView),
        attributes: { address: selected.canonicalAddress },
        popupTemplate: { title: "{address}" },
      }),
    );
    view.goTo({ target: point, zoom: 16 });
  }, [selected, viewVersion]);
  const sunTimeLabel = new Date(2000, 0, 1, sunHour).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const shownImageryYear = imageryForYear(timelapseYear).year;
  return (
    <div className="map-shell">
      <div ref={node} className="map-canvas" role="application" aria-label="Larimer County map" />
      <div className="basemap-switcher" role="group" aria-label="Basemap">
        <button
          className={basemap === "streets-navigation-vector" ? "active" : ""}
          type="button"
          onClick={() => setBasemap("streets-navigation-vector")}
        >
          Streets
        </button>
        <button
          className={basemap === "satellite" ? "active" : ""}
          type="button"
          onClick={() => setBasemap("satellite")}
        >
          Satellite
        </button>
      </div>
      <div className="sun-control" role="group" aria-label="Sun Shadows">
        <label htmlFor="shadow-toggle">
          <input
            id="shadow-toggle"
            type="checkbox"
            checked={shadowsEnabled}
            onChange={(event) => setShadowsEnabled(event.target.checked)}
          />{" "}
          Sun Shadows (3D)
        </label>
        {shadowsEnabled && (
          <>
            <span className="sun-time">{sunTimeLabel}</span>
            <input
              aria-label="Sun time"
              type="range"
              min={MIN_SUN_HOUR}
              max={MAX_SUN_HOUR}
              step={1}
              value={sunHour}
              onChange={(event) => setSunHour(Number(event.target.value))}
            />
          </>
        )}
      </div>
      <div className="timelapse-control" role="group" aria-label="Imagery Timelapse">
        <label htmlFor="timelapse-toggle">
          <input
            id="timelapse-toggle"
            type="checkbox"
            checked={timelapseEnabled}
            onChange={(event) => {
              setTimelapseEnabled(event.target.checked);
              if (!event.target.checked) {
                setTimelapsePlaying(false);
              }
            }}
          />{" "}
          Imagery Timelapse
        </label>
        {timelapseEnabled && (
          <>
            <button
              type="button"
              className="timelapse-play"
              aria-label={timelapsePlaying ? "Pause timelapse" : "Play timelapse"}
              onClick={() => setTimelapsePlaying((current) => !current)}
            >
              {timelapsePlaying ? "Pause" : "Play"}
            </button>
            <input
              aria-label="Imagery year"
              type="range"
              min={TIMELAPSE_START_YEAR}
              max={TIMELAPSE_END_YEAR}
              step={1}
              value={timelapseYear}
              onChange={(event) => {
                setTimelapsePlaying(false);
                setTimelapseYear(Number(event.target.value));
              }}
            />
            <span className="timelapse-year">
              {timelapseYear}
              {shownImageryYear !== timelapseYear && (
                <span className="timelapse-fallback"> (showing {shownImageryYear})</span>
              )}
            </span>
          </>
        )}
      </div>
      <div className="map-note">
        Estimated building shadow from assessor stories · select a result to inspect the property
      </div>
    </div>
  );
}
