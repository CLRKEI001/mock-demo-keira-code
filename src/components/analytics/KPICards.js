import React, { useEffect, useState } from "react";

// Animated count up hook
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

// This draws a circular progress ring using SVG.
// The maths works like this:
// — A circle has a circumference of 2 * PI * radius
// — strokeDasharray sets the total length of the dashed stroke to exactly
//   the full circumference, making the entire circle one long dash
// — strokeDashoffset shifts that dash backwards by a calculated amount
//   so only the percentage portion of the circle is visible
// — The circle is rotated -90deg so it starts at the top instead of the right
// — transition: stroke-dashoffset 1.2s ease animates the ring filling up
//   smoothly when the component first renders
function CircleRing({ value, max, color, size = 90, stroke = 8 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? value / max : 0;
  const offset = circumference - pct * circumference;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(0,0,0,0.07)"
        strokeWidth={stroke}
      />
      {/* Foreground ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.2s ease" }}
      />
    </svg>
  );
}

// This draws a semicircle (half ring) instead of a full circle.
// Instead of using a <circle> element it uses a <path> element with
// an Arc command (A) to draw exactly half a circle.
// The d attribute describes the path:
// M 6 ${size/2}           — Move to the left starting point
// A radius radius          — Draw an arc with this radius
// 0 0 1                   — Rotation=0, large-arc-flag=0, sweep-flag=1 (clockwise)
// ${size-6} ${size/2}     — End point on the right side
// circumference here is Math.PI * radius (half of the full 2*PI*radius)
// because we only draw half the circle.
// The same strokeDasharray/strokeDashoffset trick as CircleRing is used
// to control how much of the half-circle arc is filled.
function GaugeMeter({ value, color, size = 90 }) {
  const radius = (size - 12) / 2;
  const circumference = Math.PI * radius; // half circle
  const pct = value / 100;
  const offset = circumference - pct * circumference;
  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
      {/* Background arc */}
      <path
        d={`M 6 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2}`}
        fill="none"
        stroke="rgba(0,0,0,0.07)"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* Foreground arc */}
      <path
        d={`M 6 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1.2s ease" }}
      />
    </svg>
  );
}

const COLORS = {
  teal: "#009B8D",
  pink: "#E8175D",
  purple: "#6B2F8A",
  orange: "#F26522",
};

// ─── MAIN KPI CARDS COMPONENT ───────────────────────────────────────────────
// Replace your existing <div className="stats-grid"> block with this component
// Props:
//   total      - number - total children screened
//   flagged    - number - number of flagged children
//   onTrack    - number - number on track
//   avgScore   - number - average score as a percentage (0-100)
//   t          - object - translation strings from your T object

// trendData is accepted (Overview passes it) but no longer drawn.
export default function KpiCards({ total, flagged, onTrack, avgScore, t }) {
  const animatedTotal = useCountUp(total);
  const animatedFlagged = useCountUp(flagged);
  const animatedOnTrack = useCountUp(onTrack);
  const animatedAvg = useCountUp(avgScore);

  return (
    <div className="stats-grid">

      {/* CARD 1 — Total Screened with sparkline */}
      <div className="stat-card c1" style={cardStyle}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"}}>
          <div>
            <div className="stat-label" style={labelStyle}>{t.totalScreened}</div>
            <div className="stat-value" style={{ ...valueStyle, color: COLORS.teal, fontSize: "clamp(28px, 8vw, 52px)" }}>
              {animatedTotal}
            </div>
          </div>
          
        </div>
      </div>

      {/* CARD 2 — Flagged with circular ring */}
      <div className="stat-card c2" style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="stat-label" style={labelStyle}>{t.flagged}</div>
            <div className="stat-value" style={{ ...valueStyle, color: COLORS.pink }}>
              {animatedFlagged}
            </div>
            <div className="stat-change down" style={{ ...changeStyle, color: COLORS.pink }}>
              {flagged} {t.requireFollowUp}
            </div>
          </div>
          <div style={{ position: "relative", width: 90, height: 90 }}>
            <CircleRing value={flagged} max={total} color={COLORS.pink} />
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 13, fontWeight: 600, color: COLORS.pink
            }}>
              {total > 0 ? Math.round((flagged / total) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* CARD 3 — On Track with circular ring */}
      <div className="stat-card c3" style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="stat-label" style={labelStyle}>{t.onTrack}</div>
            <div className="stat-value" style={{ ...valueStyle, color: COLORS.teal }}>
              {animatedOnTrack}
            </div>
            <div className="stat-change" style={{ ...changeStyle, color: COLORS.teal }}>
              {onTrack} / {total}
            </div>
          </div>
          <div style={{ position: "relative", width: 90, height: 90 }}>
            <CircleRing value={onTrack} max={total} color={COLORS.teal} />
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 13, fontWeight: 600, color: COLORS.teal
            }}>
              {total > 0 ? Math.round((onTrack / total) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* CARD 4 — Avg Score with gauge meter */}
      <div className="stat-card c4" style={cardStyle}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="stat-label" style={{ ...labelStyle, textAlign: "center", marginBottom: 4 }}>
            {t.avgScore}
          </div>
          <GaugeMeter value={avgScore} color={COLORS.orange} size={100} />
          <div style={{ marginTop: -8, fontSize: 26, fontWeight: 700, color: COLORS.orange }}>
            {animatedAvg}<span style={{ fontSize: 14 }}>%</span>
          </div>
        </div>
      </div>

    </div>
  );
}

// Shared inline styles
const cardStyle = {
  borderRadius: 14,
  padding: "18px 20px",
  background: "#fff",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  borderTop: "3px solid transparent",
  overflow: "visible",
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#888",
  marginBottom: 6,
};

const valueStyle = {
  fontSize: "clamp(24px, 5vw, 36px)",
  fontWeight: 700,
  lineHeight: 1,
  marginBottom: 6,
};

const changeStyle = {
  fontSize: 12,
  color: "#888",
};