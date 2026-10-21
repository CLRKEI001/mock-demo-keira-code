import React, { useState, useEffect, useCallback } from "react";
import Doodle from "../shared/Doodle";
import { supabase } from "../../services/supabaseClient";
import { mapMessageRow } from "../../utils/mappers";
import { DOMAIN_BENCHMARK, isActiveFlag, isReferred } from "../../services/analyticsData";

// Score bands used by the "Domain Score" filter. They line up with the shared
// benchmark: below CRITICAL is critical, CRITICAL..benchmark-1 is a concern,
// benchmark and above is good. The dropdown labels are built from the same
// numbers so they can never disagree with the code.
const CRITICAL = 40;
const BENCH = DOMAIN_BENCHMARK;
const MESSAGE_TYPE = "diagnosis_report";

const T = {
  en: {
    activeFlags: "Active Flags", total: "total", referred: "Referred", cases: "cases",
    resolved: "Resolved", flagTypes: "Weak Domains", noFlags: "No flags raised",
    noFlagsSub: "No screened child currently has developmental concerns flagged",
    requiresFollowUp: "Requires follow-up", referredPsych: "Referred to psychologist",
    cognitive: "Cognitive", motor: "Fine Motor", language_score: "Language", social: "Social", emotion: "Emotion", moral: "Moral",
    devConcerns: "Developmental Concerns", progressing: "Progressing", onTrack: "On Track",
    flaggedOn: "Flagged on", school: "School", score: "Score",
    sendMessage: "Send Diagnosis to Teacher", sending: "Sending...", sent: "Message Sent ✓",
    msgTitle: "Send Diagnosis Report to Teacher",
    teacherEmail: "Teacher Email Address", teacherName: "Teacher Name",
    childName: "Child", diagnosis: "Diagnosis Summary", language: "Message Language",
    send: "Send Report", cancel: "Cancel", done: "Done",
    diagPlaceholder: "Enter the diagnosis summary for the teacher to share with the parent...",
    msgSuccess: "Message saved successfully. Teacher will be notified.",
    viewMessages: "View Sent Messages", hideMessages: "Hide Messages",
    noMessages: "No messages sent yet", sentOn: "Sent on", to: "To",
    lang_en: "English", lang_af: "Afrikaans", lang_xh: "isiXhosa",
    sendFailed: "The message could not be sent. Please check the details and try again.",
    emailInvalid: "Please enter a valid teacher email address.",
    studentFilters: "Student Filters", statusFilter: "Show", statusActive: "Active flags", statusReferred: "Referred", statusResolved: "Resolved", statusAll: "All flagged",
    domainScore: "Domain Score", allScores: "All Scores",
    scoreLow: `Below ${CRITICAL}% — Critical`, scoreMid: `${CRITICAL}–${BENCH - 1}% — Concern`, scoreHigh: `${BENCH}% and above — Good`,
    pickDomainFirst: "Choose a weak domain first", weakDomain: "Weak Domain", allDomains: "All Domains",
    sortScores: "Sort Scores", sortHigh: "Highest → Lowest", sortLow: "Lowest → Highest",
    resetFilters: "Reset filters", noMatch: "No children match these filters",
    summary: "Summary", notScoredYet: "n/a",
    diagTemplate: "Dear Teacher,\n\nPlease be advised that [CHILD] has been assessed using the PuzzleBox Screener and the results indicate Developmental Concerns.\n\nThe child scored [SCORE] of the available points overall. This is not a clinical diagnosis — please share this information with the parent and recommend they seek further professional assessment.\n\nKind regards,\nThe Puzzle Project Psychologist",
  },
  af: {
    activeFlags: "Aktiewe Vlae", total: "totaal", referred: "Verwys", cases: "gevalle",
    resolved: "Opgelos", flagTypes: "Swak Domeine", noFlags: "Geen vlae",
    noFlagsSub: "Geen gesifde kind het tans ontwikkelingsbekommernisse nie",
    requiresFollowUp: "Vereis opvolg", referredPsych: "Verwys na sielkundige",
    cognitive: "Kognitief", motor: "Fyn Motories", language_score: "Taal", social: "Sosiaal", emotion: "Emosie", moral: "Moreel",
    devConcerns: "Ontwikkelingsbekommernisse", progressing: "Vordering", onTrack: "Op Koers",
    flaggedOn: "Gevlag op", school: "Skool", score: "Punt",
    sendMessage: "Stuur Diagnose na Onderwyser", sending: "Stuur...", sent: "Gestuur ✓",
    msgTitle: "Stuur Diagnose na Onderwyser",
    teacherEmail: "Onderwyser E-pos", teacherName: "Onderwyser Naam",
    childName: "Kind", diagnosis: "Diagnose Opsomming", language: "Boodskaptaal",
    send: "Stuur Verslag", cancel: "Kanselleer", done: "Klaar",
    diagPlaceholder: "Voer die diagnose-opsomming in...",
    msgSuccess: "Boodskap suksesvol gestoor.",
    viewMessages: "Sien Gestuurde Boodskappe", hideMessages: "Verberg Boodskappe",
    noMessages: "Nog geen boodskappe", sentOn: "Gestuur op", to: "Aan",
    lang_en: "Engels", lang_af: "Afrikaans", lang_xh: "isiXhosa",
    sendFailed: "Die boodskap kon nie gestuur word nie. Kontroleer asseblief die besonderhede en probeer weer.",
    emailInvalid: "Voer asseblief 'n geldige onderwyser e-posadres in.",
    studentFilters: "Leerlingfilters", statusFilter: "Wys", statusActive: "Aktiewe vlae", statusReferred: "Verwys", statusResolved: "Opgelos", statusAll: "Alle gevlagde",
    domainScore: "Domeinpunt", allScores: "Alle Punte",
    scoreLow: `Onder ${CRITICAL}% — Krities`, scoreMid: `${CRITICAL}–${BENCH - 1}% — Bekommernis`, scoreHigh: `${BENCH}% en hoër — Goed`,
    pickDomainFirst: "Kies eers 'n swak domein", weakDomain: "Swak Domein", allDomains: "Alle Domeine",
    sortScores: "Sorteer Punte", sortHigh: "Hoogste → Laagste", sortLow: "Laagste → Hoogste",
    resetFilters: "Herstel filters", noMatch: "Geen kinders pas by hierdie filters nie",
    summary: "Opsomming", notScoredYet: "n.v.t.",
    diagTemplate: "Geagte Onderwyser,\n\nHierby word u in kennis gestel dat [CHILD] geassesseer is met die PuzzleBox Sifter en die resultate dui op Ontwikkelingsbekommernisse.\n\nDie kind het [SCORE] van die beskikbare punte behaal. Dit is nie 'n kliniese diagnose nie — deel hierdie inligting met die ouer en beveel verdere professionele assessering aan.\n\nVriendelike groete,\nDie Puzzle Project Sielkundige",
  },
  xh: {
    activeFlags: "Izikhombisi Ezisebenzayo", total: "iyonke", referred: "Zathunyelwa", cases: "amatyala",
    resolved: "Zixazululiwe", flagTypes: "Imimandla Ebuthathaka", noFlags: "Akukho zikhombisi",
    noFlagsSub: "Akukho mntwana uhloliweyo ukhombiswe ngeengxaki zentlalo okwangoku",
    requiresFollowUp: "Ifuna ukulandelwa", referredPsych: "Ithunyelwe kwisazi sengqondo",
    cognitive: "Ukucinga", motor: "Amandla", language_score: "Ulwimi", social: "Uluntu", emotion: "Imvakalelo", moral: "Isimo",
    devConcerns: "Iingxaki Zentlalo", progressing: "Inkqubela", onTrack: "Esendleleni",
    flaggedOn: "Ikhombiwe ngo", school: "Isikolo", score: "Amanqaku",
    sendMessage: "Thumela Ukuhlolwa", sending: "Ithumela...", sent: "Uthunyelwe ✓",
    msgTitle: "Thumela Ingxelo Kumfundisi",
    teacherEmail: "I-Imeyile", teacherName: "Igama loMfundisi",
    childName: "Umntwana", diagnosis: "Isishwankathelo", language: "Ulwimi",
    send: "Thumela", cancel: "Rhoxisa", done: "Kwenzekile",
    diagPlaceholder: "Faka isishwankathelo...",
    msgSuccess: "Umyalezo ugcinwe ngempumelelo.",
    viewMessages: "Jonga Imiyalezo", hideMessages: "Fihla Imiyalezo",
    noMessages: "Akukho myalezo", sentOn: "Ithunyelwe ngo", to: "Ku",
    lang_en: "IsiNgesi", lang_af: "IsiBhulu", lang_xh: "IsiXhosa",
    sendFailed: "Umyalezo awuthunyelwanga. Nceda ukhangele iinkcukacha uphinde uzame.",
    emailInvalid: "Nceda ufake idilesi yeimeyile esebenzayo.",
    studentFilters: "Izihluzi Zabafundi", statusFilter: "Bonisa", statusActive: "Izikhombisi ezisebenzayo", statusReferred: "Zithunyelwe", statusResolved: "Zixazululiwe", statusAll: "Zonke ezikhombisiweyo",
    domainScore: "Amanqaku oMmandla", allScores: "Onke Amanqaku",
    scoreLow: `Ngaphantsi kwe-${CRITICAL}% — Inkxalabo enkulu`, scoreMid: `${CRITICAL}–${BENCH - 1}% — Inkxalabo`, scoreHigh: `${BENCH}% nangaphezulu — Kulungile`,
    pickDomainFirst: "Khetha kuqala ummandla obuthathaka", weakDomain: "Ummandla Obuthathaka", allDomains: "Yonke Imimandla",
    sortScores: "Cwangcisa Amanqaku", sortHigh: "Aphezulu → Asezantsi", sortLow: "Asezantsi → Aphezulu",
    resetFilters: "Seta kwakhona izihluzi", noMatch: "Akukho bantwana bahambelana nezi zihluzi",
    summary: "Isishwankathelo", notScoredYet: "n/a",
    diagTemplate: "Mfundisi Ohloniphekileyo,\n\nNdicela ukukwazisa ukuba [CHILD] uhlolwe ngeSixhobo se-PuzzleBox kwaye iziphumo zibonisa Iingxaki Zentlalo.\n\nUmntwana ufumene [SCORE] kumanqaku akhoyo iyonke. Oku akukhonto ngokwezonyango — nceda yabelane ngolu lwazi nomzali uze ucebise uhlolo oluqhubelekileyo.\n\nNgobubele,\nIsazi sengqondo se-Puzzle Project",
  }
};

const domainColors = {
  cognitive: "#009B8D", motor: "#6B2F8A", language_score: "#F26522", social: "#E8175D", emotion: "#378ADD", moral: "#639922"
};
const DOMAIN_KEYS = ["cognitive", "motor", "language_score", "social", "emotion", "moral"];
const scoreOf = (child, key) => (typeof child[key] === "number" ? child[key] : null);
const isWeak = (child, key) => { const v = scoreOf(child, key); return v !== null && v < BENCH; };
const fmtScore = (v) => (typeof v === "number" ? `${v}%` : "–");

export default function FlagsAlerts({ children, lang }) {
  const t = T[lang] || T.en;
  const [selectedChild, setSelectedChild] = useState(null);
  const [msgLang, setMsgLang] = useState("en");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sentId, setSentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showMessages, setShowMessages] = useState(false);
  const [success, setSuccess] = useState("");

  // FILTER STATES
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [selectedScore, setSelectedScore] = useState("all");
  const [sortOrder, setSortOrder] = useState("lowest");

  // Sent diagnosis messages come from the database (not just this session).
  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("message_type", MESSAGE_TYPE)
      .order("sent_at", { ascending: false });
    if (error) { console.error("Error loading sent messages:", error); return; }
    setMessages((data || []).map(mapMessageRow));
  }, []);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Everything that has ever been flagged by the (shared) analytics definition.
  const everFlagged = children.filter(c => c.flagged);
  const activeCount = everFlagged.filter(isActiveFlag).length;
  const referredCount = everFlagged.filter(isReferred).length;
  const resolvedCount = everFlagged.filter(c => c.resolved).length;

  const scoreKey = selectedDomain === "all" ? "total" : selectedDomain;
  const scoreFilterOn = selectedDomain !== "all" && selectedScore !== "all";

  const filteredChildren = everFlagged
    .filter(child => {
      const statusMatch =
        selectedStatus === "all" ? true
        : selectedStatus === "referred" ? isReferred(child)
        : selectedStatus === "resolved" ? !!child.resolved
        : isActiveFlag(child);

      const domainMatch = selectedDomain === "all" ? true : isWeak(child, selectedDomain);

      // The score filter only makes sense for one domain at a time.
      let scoreMatch = true;
      if (scoreFilterOn) {
        const score = scoreOf(child, selectedDomain);
        scoreMatch = score === null ? false
          : selectedScore === "low" ? score < CRITICAL
          : selectedScore === "mid" ? score >= CRITICAL && score < BENCH
          : score >= BENCH;
      }
      return statusMatch && domainMatch && scoreMatch;
    })
    .sort((a, b) => {
      const av = scoreOf(a, scoreKey);
      const bv = scoreOf(b, scoreKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;   // children without a score go last
      if (bv === null) return -1;
      return sortOrder === "highest" ? bv - av : av - bv;
    });

  const domainLabels = {
    cognitive: t.cognitive, motor: t.motor, language_score: t.language_score,
    social: t.social, emotion: t.emotion, moral: t.moral
  };

  const domainFlagCounts = {};
  filteredChildren.forEach(c => {
    DOMAIN_KEYS.forEach(k => {
      if (isWeak(c, k)) domainFlagCounts[k] = (domainFlagCounts[k] || 0) + 1;
    });
  });

  const fillTemplate = (child, code) =>
    (T[code] || T.en).diagTemplate
      // Student number, not the real name: admins can read every message.
      .replace("[CHILD]", child.studentNumber || child.name)
      .replace("[SCORE]", typeof child.total === "number" ? `${child.total}%` : "—");

  const openMessageModal = (child) => {
    setSelectedChild(child);
    setSentId(null);
    setSuccess("");
    setSendError("");
    // The teacher who ran the latest screening is the natural recipient.
    setTeacherEmail(child.screeningTeacherEmail || child.teacherEmail || "");
    setTeacherName(child.screeningTeacherName || "");
    setMsgLang("en");
    setDiagnosis(fillTemplate(child, "en"));
  };

  const handleLangChange = (newLang) => {
    setMsgLang(newLang);
    if (!selectedChild) return;
    setDiagnosis(fillTemplate(selectedChild, newLang));
  };

  const resetFilters = () => {
    setSelectedStatus("active");
    setSelectedDomain("all");
    setSelectedScore("all");
    setSortOrder("lowest");
  };

  const sendMessage = async () => {
    const email = teacherEmail.trim().toLowerCase();
    if (!email || !diagnosis) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setSendError(t.emailInvalid); return; }
    setSending(true);
    setSendError("");
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          screening_id: selectedChild.screeningId || null,
          child_id: selectedChild.id,
          child_name: selectedChild.studentNumber || selectedChild.name,
          child_score: selectedChild.rawScore ?? null,
          child_status: selectedChild.status,
          school: selectedChild.school,
          // teacher_email anchors the row; recipient_* is what the teacher's
          // inbox filters on (recipient_role = 'teacher' AND recipient_email = their email).
          teacher_email: email,
          teacher_name: teacherName,
          recipient_role: "teacher",
          recipient_email: email,
          recipient_name: teacherName || null,
          message_type: MESSAGE_TYPE,
          diagnosis,
          language: msgLang,
          sent_by: "Psychologist",
          domains: Object.fromEntries(DOMAIN_KEYS.map(k => [k, selectedChild[k] ?? null])),
        })
        .select()
        .single();

      if (error) throw error;

      setSentId(data.id);
      setSuccess(t.msgSuccess);
      setShowMessages(true);
      loadMessages();
    } catch (err) {
      console.error("Error sending message:", err);
      setSendError(`${t.sendFailed}${err && err.message ? " (" + err.message + ")" : ""}`);
    }
    setSending(false);
  };

  // Nothing flagged at all: a plain empty state (no filters to show).
  if (everFlagged.length === 0) {
    return (
      <div className="page-fade">
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Doodle name="tick" size={64} /></div>
            <div className="empty-state-title">{t.noFlags}</div>
            <div className="empty-state-sub">{t.noFlagsSub}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade">

      {/* SUMMARY STATS (real counts, not affected by the filters below) */}
      <div className="three-col" style={{ marginBottom: 20 }}>
        <div className="stat-card c4" style={{ marginBottom: 0 }}>
          <div className="stat-label">{t.activeFlags}</div>
          <div className="stat-value">{activeCount}</div>
          <div className="stat-change down">{activeCount} {t.total}</div>
        </div>
        <div className="stat-card c2" style={{ marginBottom: 0 }}>
          <div className="stat-label">{t.referred}</div>
          <div className="stat-value">{referredCount}</div>
          <div className="stat-change">{referredCount} {t.cases}</div>
        </div>
        <div className="stat-card c1" style={{ marginBottom: 0 }}>
          <div className="stat-label">{t.resolved}</div>
          <div className="stat-value">{resolvedCount}</div>
          <div className="stat-change">{resolvedCount} {t.cases}</div>
        </div>
      </div>

      <div className="top-filter-bar">

        <div className="filter-heading">{t.studentFilters}</div>

        {/* STATUS */}
        <div className="filter-group">
          <label>{t.statusFilter}</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="active">{t.statusActive}</option>
            <option value="referred">{t.statusReferred}</option>
            <option value="resolved">{t.statusResolved}</option>
            <option value="all">{t.statusAll}</option>
          </select>
        </div>

        {/* DOMAIN */}
        <div className="filter-group">
          <label>{t.weakDomain}</label>
          <select
            value={selectedDomain}
            onChange={(e) => { setSelectedDomain(e.target.value); if (e.target.value === "all") setSelectedScore("all"); }}
          >
            <option value="all">{t.allDomains}</option>
            {DOMAIN_KEYS.map(k => <option key={k} value={k}>{domainLabels[k]}</option>)}
          </select>
        </div>

        {/* SCORE (per domain) */}
        <div className="filter-group">
          <label>{t.domainScore}</label>
          <select
            value={selectedScore}
            onChange={(e) => setSelectedScore(e.target.value)}
            disabled={selectedDomain === "all"}
            title={selectedDomain === "all" ? t.pickDomainFirst : undefined}
          >
            <option value="all">{selectedDomain === "all" ? t.pickDomainFirst : t.allScores}</option>
            <option value="low">{t.scoreLow}</option>
            <option value="mid">{t.scoreMid}</option>
            <option value="high">{t.scoreHigh}</option>
          </select>
        </div>

        {/* SORT */}
        <div className="filter-group">
          <label>{t.sortScores}</label>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="highest">{t.sortHigh}</option>
            <option value="lowest">{t.sortLow}</option>
          </select>
        </div>

      </div>

        {/* FLAGGED CHILDREN LIST */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">{t.activeFlags}</div>
            <span className="card-badge badge-pink">{filteredChildren.length} {t.total}</span>
          </div>
          {filteredChildren.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{t.noMatch}</div>
              <button className="btn btn-teal" style={{ marginTop: 16 }} onClick={resetFilters}>{t.resetFilters}</button>
            </div>
          ) : (
          <div className="flag-list">
            {filteredChildren.map((child, i) => (
              <div className="flag-item" key={child.id || i}>
                <div className="flag-icon" style={{ background: "var(--pink-lt)", color: "var(--pink)" }}><Doodle name="flag" size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div className="flag-name">{child.name}</div>
                  <div className="flag-meta">
                    {child.school}
                  </div>

                  {selectedDomain !== "all" && (
                    <div
                      style={{
                        marginTop: 6,
                        display: "inline-block",
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: "var(--pink-lt)",
                        color: "var(--pink)",
                        fontWeight: 800,
                        fontSize: 12
                      }}
                    >
                      {domainLabels[selectedDomain]} {t.score}:
                      {" "}
                      {fmtScore(child[selectedDomain])}
                    </div>
                  )}
                  <div className="flag-meta">{t.flaggedOn} {child.date}</div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => openMessageModal(child)}
                  style={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  <Doodle name="envelope" size={16} inline /> {t.send}
                </button>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* DOMAIN WEAKNESS */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">{t.flagTypes}</div>
            <span className="card-badge badge-orange">{t.summary}</span>
          </div>
          <div className="bar-chart">
            {Object.entries(domainFlagCounts).map(([key, count]) => (
              <div className="bar-row" key={key}>
                <div className="bar-label">{domainLabels[key] || key}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(count / filteredChildren.length) * 100}%`, background: domainColors[key] || "var(--pink)" }}></div>
                </div>
                <div className="bar-pct">{count}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowMessages(!showMessages)}
              style={{ width: "100%", marginBottom: 12 }}
            >
              {showMessages ? t.hideMessages : t.viewMessages} ({messages.length})
            </button>
            {showMessages && (
              messages.length === 0
                ? <div style={{ fontSize: 12, color: "var(--ink-faint)", textAlign: "center", padding: 12 }}>{t.noMessages}</div>
                : messages.map((m, i) => (
                  <div key={m.id || i} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{m.childName}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{t.to}: {m.recipientEmail || m.teacherEmail}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{t.sentOn} {m.sentAt ? new Date(m.sentAt).toLocaleDateString("en-ZA") : ""}</div>
                  </div>
                ))
            )}
          </div>
        </div>
     

      {/* SEND MESSAGE MODAL */}
      {selectedChild && !sentId && (
        <div className="modal-overlay" onClick={() => setSelectedChild(null)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t.msgTitle}</div>
              <button className="modal-close" onClick={() => setSelectedChild(null)}>✕</button>
            </div>

            {/* CHILD SUMMARY BAR */}
            <div style={{ padding: "12px 16px", background: "var(--pink-lt)", borderRadius: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--pink)" }}>{selectedChild.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-mid)" }}>{selectedChild.school} · {t.score}: {fmtScore(selectedChild.total)}</div>
              </div>
              <span className="pill pill-pink"><Doodle name="flag" size={16} inline /> {t.requiresFollowUp}</span>
            </div>

            {/* DOMAIN SCORES */}
            <div style={{ marginBottom: 20 }}>
              {DOMAIN_KEYS.map(k => (
                <div className="domain-bar" key={k}>
                  <div className="domain-bar-header">
                    <span>{domainLabels[k]}</span>
                    <span style={{ color: isWeak(selectedChild, k) ? "var(--pink)" : "var(--teal)" }}>
                      {fmtScore(selectedChild[k])}
                    </span>
                  </div>
                  <div className="domain-bar-track">
                    <div className="domain-bar-fill" style={{
                      width: `${selectedChild[k] || 0}%`,
                      background: isWeak(selectedChild, k) ? "var(--pink)" : domainColors[k]
                    }}></div>
                  </div>
                </div>
              ))}
            </div>

            {/* TEACHER DETAILS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--ink-mid)", display: "block", marginBottom: 6 }}>
                  {t.teacherName}
                </label>
                <input
                  style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                  placeholder="e.g. Ms Nkosi"
                  value={teacherName}
                  onChange={e => setTeacherName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--ink-mid)", display: "block", marginBottom: 6 }}>
                  {t.teacherEmail}
                </label>
                <input
                  style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                  placeholder="teacher@school.co.za"
                  value={teacherEmail}
                  onChange={e => setTeacherEmail(e.target.value)}
                  type="email"
                />
              </div>
            </div>

            {/* LANGUAGE SELECTOR */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--ink-mid)", display: "block", marginBottom: 8 }}>
                {t.language}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {["en", "af", "xh"].map(code => (
                  <button
                    key={code}
                    className={`lang-btn ${msgLang === code ? "active" : ""}`}
                    onClick={() => handleLangChange(code)}
                  >
                    {t[`lang_${code}`]}
                  </button>
                ))}
              </div>
            </div>

            {/* DIAGNOSIS TEXT */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--ink-mid)", display: "block", marginBottom: 8 }}>
                {t.diagnosis}
              </label>
              <textarea
                style={{ width: "100%", padding: 12, border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, fontFamily: "inherit", minHeight: 160, resize: "vertical", outline: "none", lineHeight: 1.6 }}
                placeholder={t.diagPlaceholder}
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
              />
            </div>

            {sendError && (
              <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "var(--pink-lt)", color: "var(--pink)", fontSize: 13, fontWeight: 700 }}>
                <Doodle name="warning" size={16} inline /> {sendError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setSelectedChild(null)}>{t.cancel}</button>
              <button
                className="btn btn-primary"
                onClick={sendMessage}
                disabled={sending || !teacherEmail.trim() || !diagnosis}
              >
                {sending ? t.sending : <><Doodle name="envelope" size={16} inline /> {t.send}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {sentId && (
        <div className="modal-overlay" onClick={() => setSentId(null)}>
          <div className="modal" style={{ maxWidth: 420, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 52, marginBottom: 16 }}><Doodle name="tick" size={64} /></div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 900, color: "var(--ink)", marginBottom: 8 }}>{t.sent}</div>
            <div style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 24, lineHeight: 1.6 }}>{success}</div>
            <div style={{ padding: "12px 16px", background: "var(--teal-lt)", borderRadius: 12, fontSize: 12, color: "var(--teal)", fontWeight: 600, marginBottom: 20, textAlign: "left" }}>
              <div><Doodle name="envelope" size={16} inline /> {t.to}: {teacherEmail}</div>
              <div><Doodle name="user" size={16} inline /> {selectedChild?.name}</div>
              <div><Doodle name="globe" size={16} inline /> {t[`lang_${msgLang}`]}</div>
            </div>
            <button
              className="btn btn-teal"
              onClick={() => { setSentId(null); setSelectedChild(null); }}
              style={{ width: "100%" }}
            >
              {t.done}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}