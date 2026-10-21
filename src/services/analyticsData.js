// analyticsData.js
//
// The analytics pages (Overview, Student Records, Screener Results,
// Flags & Alerts, Summary Report) were built before the PuzzleBox Screener
// existed, so they read the legacy `children.total / status / cognitive…`
// columns and the `screening_sessions` table — which only ever held demo
// data. Real screenings live in `puzzlebox_screenings`. This module is the
// single bridge: it loads both, and DERIVES the fields the analytics pages
// already understand from each child's most recent real screening, so every
// page agrees with what teachers and psychologists actually did.
//
// Scores: a percentage here is "points earned out of the maximum possible".
// The maximum is PER QUESTION, from the snapshot's scoringType: "binary"
// questions are 0/1 (max 1); "age_table", "checklist" and "scale3" questions
// are 0/1/2 (max 2). So a child who passes everything is 100%. The status
// (On Track / Progressing / Developmental Concerns) is NOT derived from that
// percentage — it comes from the age-specific interpretation band stored on
// the screening, or from the psychologist's verdict once reviewed. A
// screening with no band (e.g. an unsupported age) and no verdict is
// "Not Scored" rather than being silently called Progressing.

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "../services/supabaseClient";
import { mapChildRow, mapFollowUpRow, indexFollowUps } from "../utils/mappers";

// Only screenings the teacher actually submitted — never in-progress drafts.
const SUBMITTED = ["awaiting_review", "reviewed", "completed"];

// The old six "domains" → which PuzzleBox section domains feed each one.
// Matched on each section's own `domain` field (saved in the screening's
// snapshot), not on its id: section ids are database UUIDs, so they can't be
// relied on to read "sec_puzzle" etc.
const DOMAIN_SECTIONS = {
  cognitive: ["cognitive"],
  motor: ["fine_motor"],
  language_score: ["language"],
  social: ["social"],
  emotion: ["emotional"],
  moral: ["moral"],
};

export const STATUS = {
  ON_TRACK: "On Track",
  PROGRESSING: "Progressing",
  CONCERNS: "Developmental Concerns",
  NOT_SCORED: "Not Scored",
};

const BAND_STATUS = {
  on_track: STATUS.ON_TRACK,
  progressing: STATUS.PROGRESSING,
  concerns: STATUS.CONCERNS,
};

// ONE benchmark for every screen, the PDF and the Excel export. Scores are
// now a true % of the maximum, so the interpretation bands sit at roughly
// 57-61% (Progressing starts at raw 25/44 at age 5, 27/44 at age 6) and
// 68-75% (On Track starts at 30/44 and 33/44). 60% is the middle of the
// Progressing band's lower edge: a domain average at or above it is
// "at benchmark". (The old 50 only made sense on the doubled-denominator
// scale; 70 in the PDF was a different, unrelated guess.)
export const DOMAIN_BENCHMARK = 60;

// A child "needs follow-up" when the latest screening says Developmental
// Concerns (band, or the psychologist's verdict once reviewed) and nobody has
// marked them resolved. EVERY page/report must use this one definition.
export const isActiveFlag = (c) => !!c && !!c.flagged && !c.resolved;
export const isReferred = (c) => !!c && (!!c.referred || c.followUpStage === "fu5");

// Mean of a numeric field, ignoring missing/null values (e.g. a domain the
// questionnaire has no questions for, or a child that could not be scored).
export function avgOf(list, key) {
  const vals = (list || []).map((c) => c[key]).filter((v) => typeof v === "number" && !Number.isNaN(v));
  return vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : null;
}

export function statusForScreening(s) {
  if (s.status === "reviewed" && s.review_verdict === "concerns") return STATUS.CONCERNS;
  if (s.status === "reviewed" && s.review_verdict === "fine") {
    // The psychologist cleared the child; keep "Progressing" if that's the band, otherwise On Track.
    return s.interpretation_band === "progressing" ? STATUS.PROGRESSING : STATUS.ON_TRACK;
  }
  return BAND_STATUS[s.interpretation_band] || STATUS.NOT_SCORED;
}

// A screening that has neither an interpretation band nor a verdict cannot be
// given a meaningful percentage either (age-based items are unscorable).
const isScored = (s) => !!s.interpretation_band || !!s.review_verdict;

// Maximum points a snapshot question can earn.
const maxForQuestion = (q) => (q && q.scoringType === "binary" ? 1 : 2);

const pct = (earned, possible) => (possible > 0 ? Math.round((earned / possible) * 100) : 0);

// Points earned / possible, overall and per legacy domain, from the
// screening's own saved snapshot (so edits to the live questionnaire later
// don't rewrite history).
function scoreBreakdown(screening) {
  const sections = screening.content_snapshot?.sections || [];
  const responses = screening.responses || {};
  const bySection = {};
  let earned = 0;
  let possible = 0;
  for (const sec of sections) {
    let se = 0;
    let sp = 0;
    for (const q of sec.questions || []) {
      sp += maxForQuestion(q);
      const r = responses[q.id];
      if (r && typeof r.score === "number") se += r.score;
    }
    bySection[sec.id] = { earned: se, possible: sp, domain: sec.domain };
    earned += se;
    possible += sp;
  }
  const domains = {};
  for (const [key, sectionDomains] of Object.entries(DOMAIN_SECTIONS)) {
    let de = 0;
    let dp = 0;
    Object.values(bySection).forEach((sec) => {
      if (sectionDomains.includes(sec.domain)) {
        de += sec.earned;
        dp += sec.possible;
      }
    });
    // null (not 0) when the questionnaire has no questions for this domain,
    // so averages skip it instead of being dragged to 0.
    domains[key] = dp > 0 ? pct(de, dp) : null;
  }
  // Fall back to the stored raw score if the snapshot is missing.
  if (!possible && typeof screening.raw_score === "number") earned = screening.raw_score;
  return { earned, possible, total: pct(earned, possible), domains };
}

// Calendar date in South Africa (UTC+2), not UTC: a screening finished at
// 00:30 SAST on 1 Sep must not be counted in August.
const dateOnly = (iso) => {
  if (!iso) return null;
  const str = String(iso);
  if (str.length <= 10) return str;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str.slice(0, 10);
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
};

// One analytics "session" row per submitted screening.
// followUpByChildId maps child id -> follow-up stage ("fu1".."fu6").
export function buildSessions(childrenById, followUpByChildId, screenings) {
  return screenings
    .filter((s) => SUBMITTED.includes(s.status))
    .map((s) => {
      const child = childrenById[s.child_id] || {};
      const b = scoreBreakdown(s);
      const scored = isScored(s);
      return {
        id: s.id,
        screeningId: s.id,
        childId: s.child_id,
        // child_name on a screening is the student number; prefer the
        // child's name as this viewer is allowed to see it.
        childName: child.name || s.child_name,
        studentNumber: child.studentNumber || s.child_name,
        school: s.school || child.school,
        age: s.child_age ?? child.age,
        language: child.language,
        gender: child.gender,
        score: scored ? b.total : null,
        rawScore: s.raw_score ?? b.earned,
        maxScore: b.possible,
        date: dateOnly(s.completed_at || s.created_at),
        examiner: s.teacher_name || s.teacher_email || child.examiner,
        status: statusForScreening(s),
        stage: s.status === "awaiting_review" ? "stage3" : "stage4",
        screeningStatus: s.status,
        reviewVerdict: s.review_verdict,
        reviewNotes: s.review_notes,
        followUpStage: followUpByChildId[s.child_id] || "fu1",
        ...b.domains,
      };
    });
}

// One row per CHILD: the legacy fields are overwritten from that child's most
// recent submitted screening. Children with no submitted screening keep their
// own record but get no score ("not screened yet").
export function buildChildren(childRows, screenings, followUpByChildId = {}) {
  const latest = {};
  screenings
    .filter((s) => SUBMITTED.includes(s.status))
    .forEach((s) => {
      const cur = latest[s.child_id];
      const when = s.completed_at || s.created_at;
      if (!cur || when > (cur.completed_at || cur.created_at)) latest[s.child_id] = s;
    });

  const rows = childRows.map((row) => {
    const base = mapChildRow(row);
    const s = latest[row.id];
    const followUpStage = followUpByChildId[row.id] || null;
    // Most recent activity = last submitted screening, else when the child was added.
    const lastActivityAt = (s && (s.completed_at || s.created_at)) || row.created_at || "";
    if (!s) return { ...base, screened: false, total: null, lastActivityAt, followUpStage };
    const b = scoreBreakdown(s);
    const status = statusForScreening(s);
    return {
      ...base,
      screened: true,
      scored: isScored(s),
      total: isScored(s) ? b.total : null,
      status,
      flagged: status === STATUS.CONCERNS,
      date: dateOnly(s.completed_at || s.created_at),
      examiner: s.teacher_name || s.teacher_email || base.examiner,
      // Who ran the latest screening (message recipients default to this).
      screeningTeacherEmail: s.teacher_email || null,
      screeningTeacherName: s.teacher_name || null,
      rawScore: s.raw_score ?? b.earned,
      maxScore: b.possible,
      screeningId: s.id,
      screeningStatus: s.status,
      reviewVerdict: s.review_verdict,
      lastActivityAt,
      followUpStage,
      ...b.domains,
    };
  });

  // Newest first, everywhere the analytics pages list children.
  return rows.sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)));
}

const FU_TYPES = { fu1: "fu1", fu2: "fu2", fu3: "fu3", fu4: "fu4", fu5: "fu5", fu6: "fu6" };
const normaliseFuType = (t) => {
  if (!t) return "fu1";
  if (FU_TYPES[t]) return t;
  // legacy values such as "followUp2"
  const m = /^followUp(\d)$/.exec(t);
  return m && FU_TYPES["fu" + m[1]] ? "fu" + m[1] : "fu1";
};

// Reads every row of a query, a page at a time, so nothing is silently cut
// off at the API's row limit (1000). `build` must return a fresh query with a
// deterministic order each time it is called.
const PAGE = 500;
async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { data: rows, error: null };
}

// Loads everything and stays live. Returns:
//   loading / error  – load state (error is a message string or "")
//   reload           – force a refresh
//   allChildren      – every child record (with derived scores where screened)
//   screenedChildren – only children with a submitted screening
//   sessions         – one row per submitted screening (newest first)
//   followUps        – { byId, byName } latest follow-up per child (see mappers.indexFollowUps)
export function useAnalyticsData() {
  const [childRows, setChildRows] = useState([]);
  const [screenings, setScreenings] = useState([]);
  const [followUpRows, setFollowUpRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    const [c, s, f] = await Promise.all([
      // children_named adds the real name for psychologists (admins get null
      // and see the student number) — see supabase/database/01.
      fetchAll(() => supabase.from("children_named").select("*").order("created_at", { ascending: true }).order("id", { ascending: true })),
      fetchAll(() =>
        supabase
          .from("puzzlebox_screenings")
          .select("id, child_id, child_name, school, child_age, teacher_email, teacher_name, status, responses, content_snapshot, raw_score, interpretation_band, review_verdict, review_notes, completed_at, created_at")
          .in("status", SUBMITTED)
          .order("completed_at", { ascending: false })
          .order("id", { ascending: true })
      ),
      fetchAll(() => supabase.from("follow_ups").select("*").order("created_at", { ascending: true }).order("id", { ascending: true })),
    ]);
    // A newer load has started, or we were unmounted: drop this result.
    if (!mounted.current || mine !== seq.current) return;
    const problems = [];
    if (c.error) { console.error("Error loading children:", c.error); problems.push("children"); }
    if (s.error) { console.error("Error loading screenings:", s.error); problems.push("screenings"); }
    if (f.error) { console.error("Error loading follow-ups:", f.error); problems.push("follow-ups"); }
    if (!c.error) setChildRows(c.data || []);
    if (!s.error) setScreenings(s.data || []);
    if (!f.error) setFollowUpRows(f.data || []);
    setError(problems.length ? "Could not load " + problems.join(", ") + "." : "");
    setLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    let timer = null;
    // Several tables can change at once (and each screening save touches more
    // than one), so coalesce bursts of events into one refresh.
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 400);
    };
    load();
    const channel = supabase
      .channel("analytics-data-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "children" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "puzzlebox_screenings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, refresh)
      .subscribe();
    return () => {
      mounted.current = false;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return useMemo(() => {
    const followUps = indexFollowUps(followUpRows.map(mapFollowUpRow));
    const fuByChild = {};
    Object.entries(followUps.byId).forEach(([id, fu]) => {
      fuByChild[id] = normaliseFuType(fu.followUpType);
    });
    const allChildren = buildChildren(childRows, screenings, fuByChild);
    const childrenById = Object.fromEntries(childRows.map((r) => [r.id, mapChildRow(r)]));
    const sessions = buildSessions(childrenById, fuByChild, screenings);
    return {
      loading,
      error,
      reload: load,
      allChildren,
      screenedChildren: allChildren.filter((c) => c.screened),
      sessions,
      followUps,
    };
  }, [childRows, screenings, followUpRows, loading, error, load]);
}