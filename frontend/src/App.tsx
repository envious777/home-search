import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  FluentProvider,
  makeStyles,
  tokens,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  DeleteRegular,
  HeartRegular,
  MapRegular,
  SearchRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from "@fluentui/react-icons";
import arcgisLightCss from "@arcgis/core/assets/esri/themes/light/main.css?url";
import arcgisDarkCss from "@arcgis/core/assets/esri/themes/dark/main.css?url";
import { AssessorSections } from "./features/assessor/AssessorSections";
import { MapLegends } from "./features/map/MapLegends";
import { MapViewPanel } from "./features/map/MapView";
import { layers } from "./lib/map/constants";
import { analyzeAddress } from "./lib/assessor/client";
import { extractBuildingInfo } from "./lib/assessor/module";
import { toAddressQuery } from "./lib/address/module";
import { loadSaved, removeLocation, saveLocation } from "./lib/storage/module";
import { THEME_KEY } from "./lib/storage/constants";
import type { AssessorAnalysis, LayerDefinition, SelectedLocation } from "./types";
import "./styles.css";

type Theme = "light" | "dark";
const initialTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const useStyles = makeStyles({
  root: { minHeight: "100vh", backgroundColor: "var(--bg)", color: tokens.colorNeutralForeground1 },
});
const App = () => {
  const classes = useStyles();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.classList.toggle("calcite-mode-dark", theme === "dark");
    document.body.classList.toggle("calcite-mode-light", theme === "light");
    let link = document.getElementById("arcgis-theme") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "arcgis-theme";
      link.rel = "stylesheet";
      document.head.prepend(link);
    }
    link.href = theme === "dark" ? arcgisDarkCss : arcgisLightCss;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  const [active, setActive] = useState(() => new Set(layers.slice(0, 2).map((layer) => layer.id)));
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [saved, setSaved] = useState(loadSaved);
  const [analysis, setAnalysis] = useState<AssessorAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const toggleLayer = (id: string) =>
    setActive((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selectLocation = async (location: Omit<SelectedLocation, "id" | "savedAt">) => {
    const next = {
      ...location,
      id: `${location.canonicalAddress}:${location.latitude.toFixed(5)}:${location.longitude.toFixed(5)}`,
      savedAt: new Date().toISOString(),
    };
    setSelected(next);
    setLoading(true);
    try {
      const params = toAddressQuery(location.canonicalAddress, location.city);
      setAnalysis(await analyzeAddress(params));
    } catch {
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };
  const activeLayers = layers.filter((layer) => active.has(layer.id));
  const buildingInfo = extractBuildingInfo(analysis);
  return (
    <FluentProvider theme={theme === "dark" ? webDarkTheme : webLightTheme}>
      <div className={classes.root}>
        <header className="topbar">
          <div className="brand">
            <MapRegular />
            <div>
              <strong>HOME SEARCH</strong>
              <span>Larimer County</span>
            </div>
          </div>
          <Button
            appearance="subtle"
            icon={theme === "dark" ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </header>
        <main className="workspace">
          <section className="map-column">
            <div className="map-heading">
              <div>
                <p className="eyebrow">PROPERTY EXPLORER</p>
                <h1>Find your place in Larimer County.</h1>
              </div>
              <div className="legend"></div>
            </div>
            <MapViewPanel
              activeLayers={activeLayers}
              selected={selected}
              saved={saved}
              buildingInfo={buildingInfo}
              onSelect={selectLocation}
            />
          </section>
          <aside className="sidebar">
            <div className="panel search-panel">
              <span className="panel-label">
                <SearchRegular /> QUICK SEARCH
              </span>
              <p className="hint">
                Use the search box on the map (top-right) for address suggestions across Larimer County.
              </p>
            </div>
            <div className="panel">
              <div className="panel-title">
                <span>Operational layers</span>
                <span className="count">{activeLayers.length}/4 on</span>
              </div>
              {layers.map((layer: LayerDefinition) => (
                <div className="layer-item" key={layer.id}>
                  <label className="layer-row">
                    <Checkbox checked={active.has(layer.id)} onChange={() => toggleLayer(layer.id)} />
                    <span className="layer-swatch" style={{ backgroundColor: layer.color }} />
                    <span className="layer-copy">
                      <strong>{layer.title}</strong>
                      <small>{layer.description}</small>
                    </span>
                  </label>
                  <MapLegends layer={layer} />
                </div>
              ))}
            </div>
            <div className="panel saved-panel">
              <div className="panel-title">
                <span>
                  <HeartRegular /> Saved locations
                </span>
                <span className="count">{saved.length}</span>
              </div>
              {saved.length === 0 ? (
                <p className="empty">Save a selected address here for quick return visits.</p>
              ) : (
                <div className="saved-list">
                  {saved.map((item) => (
                    <div className="saved-row" key={item.id}>
                      <button onClick={() => selectLocation(item)}>
                        <strong>{item.canonicalAddress}</strong>
                        <small>
                          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        </small>
                      </button>
                      <Button
                        appearance="subtle"
                        icon={<DeleteRegular />}
                        aria-label={`Delete ${item.canonicalAddress}`}
                        onClick={() => setSaved(removeLocation(item.id))}
                      />
                    </div>
                  ))}
                </div>
              )}
              {selected && (
                <Button
                  appearance="primary"
                  icon={<ArrowDownloadRegular />}
                  onClick={() => setSaved(saveLocation(selected))}
                >
                  Save selected location
                </Button>
              )}
            </div>
          </aside>
          <section className="assessor-panel">
            <div className="panel-title">
              <span>Assessor analysis</span>
              {loading ? (
                <span className="badge loading">loading</span>
              ) : analysis?.partial ? (
                <span className="badge partial">partial</span>
              ) : analysis ? (
                <span className="badge ready">ready</span>
              ) : null}
            </div>
            {!analysis && !loading ? (
              <p className="empty">Select a geocoded address to load Larimer County property facts.</p>
            ) : loading ? (
              <p className="empty">Checking property records...</p>
            ) : (
              <>
                <div className="account">
                  <small>ASSESSOR ACCOUNT</small>
                  <strong>{analysis?.accountno ?? "Not found"}</strong>
                </div>
                {analysis && <AssessorSections sections={analysis.sections} />}
              </>
            )}
          </section>
        </main>
      </div>
    </FluentProvider>
  );
};
export default App;
