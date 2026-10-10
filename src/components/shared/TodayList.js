// TodayList.js — a card of colored icon rows, the "what needs a look
// today" pattern instead of a plain data table. Reused across all three
// role homes for whatever their most relevant live feed is (messages,
// follow-ups, pending approvals).
//
// Each item may carry a `data` field holding the original record (the
// notification, follow-up, message, ...). When a row is clicked,
// onItemClick receives that record, or the display item if there is no
// `data`, so the click handler can open the real thing.

import React from "react";
import { Ico } from "./Doodle";

export default function TodayList({
  title,
  actionLabel,
  onAction,
  items,
  emptyIcon = "puzzle",
  emptyTitle,
  emptySub,
  onItemClick,
}) {
  const clickable = typeof onItemClick === "function";

  return (
    <div className="rh-card">
      <div className="rh-card-head">
        <div className="rh-card-title">{title}</div>
        {actionLabel && items?.length > 0 && (
          <button className="rh-card-action" onClick={onAction}>{actionLabel}</button>
        )}
      </div>

      {!items || items.length === 0 ? (
        <div className="rh-empty">
          <div className="rh-empty-icon" style={{ display: "flex", justifyContent: "center" }}>
            <Ico v={emptyIcon} size={56} />
          </div>
          <div className="rh-empty-title">{emptyTitle}</div>
          <div className="rh-empty-sub">{emptySub}</div>
        </div>
      ) : (
        <div className="rh-list">
          {items.map((it, i) => (
            <div
              className={`rh-list-row ${clickable ? "clickable" : ""}`}
              key={it.key ?? i}
              onClick={clickable ? () => onItemClick(it.data ?? it) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onItemClick(it.data ?? it);
                      }
                    }
                  : undefined
              }
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              <div className="rh-list-icon" style={{ background: `${it.color}1f`, color: it.color }}>
                <Ico v={it.icon} size={22} />
              </div>
              <div className="rh-list-text">
                <div className="rh-list-title">{it.title}</div>
                <div className="rh-list-meta">{it.meta}</div>
              </div>
              {it.badge && (
                <span className="rh-list-badge" style={{ background: `${it.color}1f`, color: it.color }}>
                  {it.badge}
                </span>
              )}
              {it.action && (
                <button
                  className="rh-list-btn"
                  onClick={(e) => { e.stopPropagation(); it.action.onClick(); }}
                >
                  {it.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}