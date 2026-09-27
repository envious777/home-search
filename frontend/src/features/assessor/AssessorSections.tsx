import type { ReactNode } from "react";
import type { AssessorAnalysis } from "../../types";
import {
  areaDetailTypes,
  assessorSectionOrder,
  assessorViewMetadata,
  currency,
  decimal,
  deedTypes,
  TAX_CHART_GAP,
  TAX_CHART_HEIGHT,
  TAX_CHART_TOP,
  TAX_CHART_WIDTH,
  valueColors,
} from "../../lib/assessor/constants";
import { asTable, count, date, humanize, money, num, pct, splitParcel, text, type Table } from "../../lib/assessor/module";
type Sections = AssessorAnalysis["sections"];

function KeyValues({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stats({ items }: { items: [string, ReactNode, ReactNode?][] }) {
  return (
    <div className="stats">
      {items.map(([label, value, sub]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
          {sub ? <small>{sub}</small> : null}
        </div>
      ))}
    </div>
  );
}

function DataTable({ table }: { table: Table }) {
  return (
    <div className="data-table">
      <table>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column}>{humanize(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.records.map((record, index) => (
            <tr key={index}>
              {table.columns.map((column) => (
                <td key={column}>{record[column] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParcelNumber({ parcel }: { parcel: string | null }) {
  const parts = splitParcel(parcel);
  if (!parts) return null;
  return (
    <div className="parcel" aria-label={`Parcel ${parcel}`}>
      {parts.map(([label, value]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Detail({ records: [r] }: Table) {
  const mailing = [r.mailaddress1, r.mailaddress2].filter(Boolean).join(", ");
  const mailingCity = [r.mailcity, r.mailstate, r.mailzipcode?.slice(0, 5)].filter(Boolean).join(" ");
  const absentee = Boolean(
    r.mailaddress2 && r.locationaddress && !r.mailaddress2.toUpperCase().includes(r.locationaddress.toUpperCase()),
  );
  return (
    <>
      {absentee && <p className="note">Owner mailing address differs from the property address.</p>}
      <ParcelNumber parcel={r.parcelnb} />
      <KeyValues
        items={[
          ["Address", `${text(r.locationaddress)}, ${text(r.locationcity)} ${r.locationzipcode ?? ""}`],
          ["Owner", [r.ownername1, r.ownername2].filter(Boolean).join(" & ") || "—"],
          ["Mailing", mailing ? `${mailing}, ${mailingCity}` : "—"],
          ["Account type", text(r.accttype)],
          ["Subdivision", text(r.subdivisiondescr)],
          ["Legal", text(r.legalsearch)],
          ["Parcel", text(r.parcelnb)],
          ["Tax area", text(r.taxarea)],
          [
            "Mill levy",
            <>
              {text(r.totalmilllevy)}{" "}
              <small>
                (local {text(r.lg_mill_levy)} · school {text(r.school_mill_levy)})
              </small>
            </>,
          ],
        ]}
      />
    </>
  );
}

function Improvement({ records }: Table) {
  return (
    <>
      {records.map((r, index) => (
        <div className="building" key={r.bldgid ?? index}>
          {records.length > 1 && <p className="subhead">Building {r.bldgid}</p>}
          <Stats
            items={[
              ["Beds", count(r.bedrooms)],
              ["Baths", count(r.baths)],
              ["Above grade", `${count(r.sf)} sf`],
              ["Basement", `${count(r.bsmntsf)} sf`, num(r.bsmntsffin) ? `${count(r.bsmntsffin)} finished` : undefined],
              ["Built", text(r.yrblt), r.yrrem ? `remodeled ${r.yrrem}` : undefined],
              ["Stories", count(r.stories)],
            ]}
          />
          <KeyValues
            items={[
              ["Style", `${text(r.bltasdescr)} · ${text(r.occdescr)}`],
              ["Condition", `${text(r.condition)} condition · ${text(r.quality)} quality`],
              ["Effective year", text(r.adjyrblt)],
              ["HVAC", text(r.hvacdescr)],
              ["Exterior", `${text(r.exterior)} · ${text(r.interior)} interior`],
              ["Roof", `${text(r.rooftype)} · ${text(r.roofcover)}`],
              ["Foundation", text(r.foundation)],
              ["Rooms", count(r.rooms)],
              ["Neighborhood", text(r.nbhd)],
            ]}
          />
        </div>
      ))}
    </>
  );
}

function ImprovementDetail({ records }: Table) {
  const grouped = new Map<string, { type: string; descr: string; units: number }>();
  for (const r of records) {
    const key = `${r.detailtype}|${r.detaildescr}`;
    const entry = grouped.get(key) ?? { type: text(r.detailtype), descr: text(r.detaildescr), units: 0 };
    entry.units += num(r.units) ?? 0;
    grouped.set(key, entry);
  }
  return (
    <ul className="features">
      {[...grouped.values()].map((item) => (
        <li key={`${item.type}|${item.descr}`}>
          <span>
            <small>{item.type}</small>
            {item.descr}
          </span>
          <strong>
            {areaDetailTypes.has(item.type) ? `${decimal.format(item.units)} sf` : `× ${decimal.format(item.units)}`}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function ValueDetail({ records }: Table) {
  const total = records.reduce((sum, r) => sum + (num(r.actval) ?? 0), 0);
  const assessed = records.reduce((sum, r) => sum + (num(r.rawassdval) ?? 0), 0);
  const colors = valueColors;
  return (
    <>
      <Stats
        items={[
          ["Actual value", currency.format(total)],
          ["Assessed value", currency.format(assessed)],
          [
            "Ratio",
            records[0]?.ASSESSMENTRATIO ? `${decimal.format((num(records[0].ASSESSMENTRATIO) ?? 0) * 100)}%` : "—",
          ],
        ]}
      />
      <div className="stacked-bar" role="img" aria-label="Actual value by type">
        {records.map((r, i) => (
          <span
            key={i}
            title={`${r.valuetype}: ${money(r.actval)}`}
            style={{ flexGrow: num(r.actval) ?? 0, backgroundColor: colors[i % colors.length] }}
          />
        ))}
      </div>
      <ul className="legend-list">
        {records.map((r, i) => (
          <li key={i}>
            <i style={{ backgroundColor: colors[i % colors.length] }} />
            <span>
              {text(r.valuetype)}
              {r.valuetype === "Land" && num(r.acres) ? (
                <small>
                  {" "}
                  · {count(r.acres)} ac / {count(r.sqft)} sf
                </small>
              ) : null}
            </span>
            <strong>{money(r.actval)}</strong>
            <small>{total ? `${Math.round(((num(r.actval) ?? 0) / total) * 100)}%` : ""}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

function Sales({ records }: Table) {
  const sorted = [...records].sort((a, b) => (b.saledt ?? "").localeCompare(a.saledt ?? ""));
  const market = sorted.filter((r) => (num(r.salep) ?? 0) > 0);
  return (
    <ol className="timeline">
      {sorted.map((r, index) => {
        const price = num(r.salep) ?? 0;
        const previous = price > 0 ? market[market.indexOf(r) + 1] : undefined;
        const change = previous ? price / (num(previous.salep) ?? price) - 1 : null;
        return (
          <li key={r.recptno ?? index} className={price > 0 ? "" : "muted"}>
            <div>
              <strong>{price > 0 ? currency.format(price) : "No consideration"}</strong>
              {change != null && <span className={`delta ${change >= 0 ? "up" : "down"}`}>{pct(change)}</span>}
            </div>
            <small>
              {date(r.saledt)} · {deedTypes[r.deedtype ?? ""] ?? text(r.deedtype)} · #{text(r.recptno)}
            </small>
          </li>
        );
      })}
    </ol>
  );
}

function LandAttributes({ records }: Table) {
  return (
    <div className="chips">
      {records.map((r, i) => (
        <span key={i}>
          <small>{text(r.attribute)}</small>
          {text(r.attributedescr)}
        </span>
      ))}
    </div>
  );
}

function Limit({ records: [r] }: Table) {
  return (
    <KeyValues
      items={[
        ["Tax district", text(r.tad)],
        ["Tax area", text(r.taxarea)],
        ["Account", text(r.accountno)],
        ["Schedule", text(r.schedulenum)],
        ["Parcel", text(r.parcelnb)],
      ]}
    />
  );
}

function TaxHistory({ records }: Table) {
  const years = [...records].sort((a, b) => (num(a.TAX_YEAR) ?? 0) - (num(b.TAX_YEAR) ?? 0));
  const latest = years[years.length - 1];
  const first = years[0];
  const max = Math.max(...years.map((r) => num(r.TOTAL_TAX_AMT) ?? 0), 1);
  const width = TAX_CHART_WIDTH,
    height = TAX_CHART_HEIGHT,
    top = TAX_CHART_TOP,
    gap = TAX_CHART_GAP,
    barWidth = width / years.length;
  const firstTax = num(first.TOTAL_TAX_AMT),
    latestTax = num(latest.TOTAL_TAX_AMT);
  const balance = num(latest.PROPERTY_BAL) ?? 0;
  return (
    <>
      <Stats
        items={[
          [
            `${latest.TAX_YEAR} tax`,
            money(latest.TOTAL_TAX_AMT),
            `${money(latest.FIRST_HALF_TAX_AMT)} + ${money(latest.SECOND_HALF_TAX_AMT)}`,
          ],
          ["Actual value", money(latest.ACTUAL_LAND_VAL), `assessed ${money(latest.ASSESSED_LAND_VAL)}`],
          [
            "Balance due",
            <span className={balance > 0 ? "owed" : "paid"}>{currency.format(balance)}</span>,
            latest.TAX_EXEMPT === "Y" ? "tax exempt" : undefined,
          ],
        ]}
      />
      <KeyValues
        items={[
          ["First half due", date(latest.FIRST_HALF_DUE_DATE)],
          ["Second half due", date(latest.SECOND_HALF_DUE_DATE)],
          ["Paid in full by", date(latest.FULL_DUE_DATE)],
        ]}
      />
      {years.length > 1 && (
        <figure className="chart">
          <figcaption>
            Annual tax {first.TAX_YEAR}–{latest.TAX_YEAR}
            {firstTax && latestTax ? <span className="delta up">{pct(latestTax / firstTax - 1)}</span> : null}
          </figcaption>
          <svg viewBox={`0 0 ${width} ${top + height + 16}`} role="img" aria-label="Annual property tax by year">
            {years.map((r, i) => {
              const value = num(r.TOTAL_TAX_AMT) ?? 0;
              const h = (value / max) * height;
              return (
                <rect
                  key={r.TAX_YEAR}
                  x={i * barWidth + gap / 2}
                  y={top + height - h}
                  width={barWidth - gap}
                  height={h}
                  className={r === latest ? "bar latest" : "bar"}
                >
                  <title>{`${r.TAX_YEAR}: ${currency.format(value)} tax · ${money(r.ACTUAL_LAND_VAL)} value`}</title>
                </rect>
              );
            })}
            <text x={0} y={top + height + 13}>
              {first.TAX_YEAR}
            </text>
            <text x={width} y={top + height + 13} textAnchor="end">
              {latest.TAX_YEAR}
            </text>
            <text x={width} y={10} textAnchor="end" className="max">
              peak {currency.format(max)}
            </text>
          </svg>
        </figure>
      )}
    </>
  );
}

function TaxDistricts({ records }: Table) {
  const latestYear = Math.max(...records.map((r) => num(r.TAX_YEAR) ?? 0));
  const rows = records
    .filter((r) => (num(r.TAX_YEAR) ?? 0) === latestYear)
    .sort((a, b) => (num(b.AMOUNT) ?? 0) - (num(a.AMOUNT) ?? 0));
  const total = rows.reduce((sum, r) => sum + (num(r.AMOUNT) ?? 0), 0);
  const max = num(rows[0]?.AMOUNT) ?? 1;
  return (
    <>
      <p className="subhead">
        {latestYear} · {currency.format(total)} across {rows.length} districts
      </p>
      <ul className="bars">
        {rows.map((r, i) => {
          const amount = num(r.AMOUNT) ?? 0;
          return (
            <li key={i}>
              <div>
                <span>{text(r.NAME)}</span>
                <strong>{currency.format(amount)}</strong>
              </div>
              <div className="track">
                <i style={{ width: `${(amount / max) * 100}%` }} />
              </div>
              <small>
                {text(r.MILL_LEVY)} mills · {total ? Math.round((amount / total) * 100) : 0}% of bill
              </small>
            </li>
          );
        })}
      </ul>
    </>
  );
}

const views: Record<string, { render: (table: Table) => ReactNode }> = {
  detail: { render: Detail },
  improvement: { render: Improvement },
  valueDetail: { render: ValueDetail },
  treasurerPropertyInfo: { render: TaxHistory },
  treasurerTaxDistrict: { render: TaxDistricts },
  sales: { render: Sales },
  improvementDetail: { render: ImprovementDetail },
  landAttributes: { render: LandAttributes },
  limit: { render: Limit },
};
export function AssessorSections({ sections }: { sections: Sections }) {
  const names = Object.keys(sections).sort(
    (a, b) =>
      (assessorSectionOrder.indexOf(a) + 1 || Infinity) - (assessorSectionOrder.indexOf(b) + 1 || Infinity),
  );
  return (
    <div className="assessor-sections">
      {names.map((name) => {
        const section = sections[name];
        const view = views[name];
        const metadata = assessorViewMetadata[name];
        const table = asTable(section.data);
        const title = metadata?.title ?? humanize(name);
        let body: ReactNode;
        if (section.status !== "fulfilled")
          body = <p className="empty">Unavailable{section.error ? `: ${section.error}` : ""}</p>;
        else if (!table || table.records.length === 0) body = <p className="empty">No records.</p>;
        else if (!view) body = <DataTable table={table} />;
        else
          body = (
            <>
              {view.render(table)}
              <details className="raw">
                <summary>View table</summary>
                <DataTable table={table} />
              </details>
            </>
          );
        return (
          <details
            className={`assessor-section ${section.status !== "fulfilled" ? "unavailable" : ""}`}
            key={name}
            open={metadata?.open}
          >
            <summary>
              <span>{title}</span>
              {table && table.records.length > 0 ? (
                <small>
                  {table.records.length} {table.records.length === 1 ? "record" : "records"}
                </small>
              ) : null}
            </summary>
            <div className="section-body">{body}</div>
          </details>
        );
      })}
    </div>
  );
}
