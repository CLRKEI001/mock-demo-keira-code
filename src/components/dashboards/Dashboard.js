import React, { useState } from "react";
import { useAnalyticsData } from "../../services/analyticsData";
import Sidebar from "../shared/Sidebar";
import Overview from "../analytics/Overview";
import ChildrenTable from "../analytics/ChildrenTable";
import ScreenerResults from "../screener/ScreenerResults";
import FlagsAlerts from "../analytics/FlagsAlerts";
import SummaryReport from "../analytics/SummaryReport";

// NOTE: this used to auto-insert 15 fake "Child PB-001"..."Child PB-015"
// rows into the real `children` table the first time anyone opened this
// page with an empty table — leftover demo/seed behaviour from before
// real teachers were using the app. That's genuinely destructive (it
// silently wrote fake records into a live database) and it's exactly
// where the "Child PB-00x" rows cluttering the PuzzleBox Screener's child
// picker and Screening History came from. Removed — this page now only
// ever reads real data. If the table happens to be empty, it just shows
// an empty dashboard, same as every other page in the app already does.

export default function Dashboard({ user }) {
  const [activePage, setActivePage] = useState("overview");
  const [lang, setLang] = useState("en");

  // One shared, real-data source for every analytics page — the same one the
  // Admin, Psychologist and Educator dashboards use, so all of them agree.
  const { loading, error, reload, allChildren, screenedChildren, sessions } = useAnalyticsData();

  const langLabels = { en: "EN", af: "AF", xh: "XH" };

  const titles = {
    en: { overview: "Overview", children: "Student Records", results: "Screener Results", flags: "Flags & Alerts", report: "Summary Report" },
    af: { overview: "Oorsig", children: "Leerlingsrekords", results: "Sifterresultate", flags: "Vlae & Waarskuwings", report: "Opsommingsverslag" },
    xh: { overview: "Inkcazelo", children: "Iirekhodi zabaFundi", results: "Iziphumo", flags: "Izikhombisi", report: "Ingxelo Efuphi" },
  };

  const subs = {
    en: { overview: "Eastern Cape pilot · All screened children", children: "All screened participants", results: "Latest screening sessions", flags: "Children requiring follow-up", report: "Exportable summary for funders" },
    af: { overview: "Oos-Kaap loodsprojek · Alle gesifde kinders", children: "Alle deelnemers", results: "Laaste sifsessies", flags: "Kinders wat opvolg benodig", report: "Uitvoerbare opsomming vir befondsers" },
    xh: { overview: "Umzekelo weMpuma Koloni · Bonke abantwana", children: "Bonke abathathi-nxaxheba", results: "Iiseshoni zokugqibela", flags: "Abantwana abafuna ukulandelwa", report: "Ingxelo yabaxhasi" },
  };

  return (
    <div className="dashboard-layout">
      <Sidebar activePage={activePage} setActivePage={setActivePage} lang={lang} user={user} />
      <div className="main-content page-fade">
        <div className="topbar">
          <div className="topbar-left">
            <div className="page-title">{titles[lang][activePage]}</div>
            <div className="page-sub">{subs[lang][activePage]}</div>
          </div>
          <div className="topbar-right">
            <div className="lang-switcher">
              {Object.entries(langLabels).map(([code, label]) => (
                <button key={code} className={`lang-btn ${lang === code ? "active" : ""}`} onClick={() => setLang(code)}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: "#FFF3F3", color: "#991040", fontSize: 12, fontWeight: 600 }}>
            {error} <button className="btn btn-ghost btn-sm" onClick={reload} style={{ marginLeft: 8 }}>Retry</button>
          </div>
        )}
        {loading ? (
          <div className="card"><div className="empty-state"><div className="empty-state-title">Loading…</div></div></div>
        ) : (
          <>
            {activePage === "overview" && <Overview children={screenedChildren} sessions={sessions} lang={lang} />}
            {activePage === "children" && <ChildrenTable children={allChildren} lang={lang} />}
            {activePage === "results" && <ScreenerResults lang={lang} sessions={sessions} />}
            {activePage === "flags" && <FlagsAlerts children={screenedChildren} lang={lang} />}
            {activePage === "report" && <SummaryReport children={screenedChildren} lang={lang} />}
          </>
        )}
      </div>
    </div>
  );
}