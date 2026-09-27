import { useState } from "react";
import { Button } from "@fluentui/react-components";
import { TextBulletListLtrRegular } from "@fluentui/react-icons";
import type { LayerDefinition } from "../../types";

interface Props {
  layer?: LayerDefinition;
}

export const MapLegends = ({ layer }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!layer?.legend?.length) {
    return null;
  }

  const legendId = `legend-${layer.id}`;

  return (
    <>
      <Button
        className="layer-legend-toggle"
        appearance="subtle"
        size="small"
        icon={<TextBulletListLtrRegular />}
        aria-label={`${isOpen ? "Hide" : "Show"} ${layer.title} legend`}
        aria-expanded={isOpen}
        aria-controls={legendId}
        title={`${isOpen ? "Hide" : "Show"} ${layer.title} legend`}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen && (
        <div className="layer-legend-content" id={legendId}>
          {layer.legend.map((group) => (
            <div className="map-legend-group" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.entries.map((entry) => (
                  <li key={entry.label}>
                    <span
                      className={`map-legend-symbol ${entry.shape}`}
                      style={{ backgroundColor: entry.color }}
                      aria-hidden="true"
                    />
                    <span>{entry.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}