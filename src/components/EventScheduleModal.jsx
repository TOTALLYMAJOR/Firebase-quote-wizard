import { useEffect, useMemo, useState } from "react";
import { currency } from "../lib/quoteCalculator";
import { getQuoteHistory, updateQuoteBookingAssignment } from "../lib/quoteStore";

const STATUS_SET = new Set(["accepted", "booked"]);
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_STAFF_LEADS = ["Chef Toni", "Ervin", "Shift Lead"];
const EMPTY_DAY_CONFLICT = { total: 0, overlap: 0, unknown: 0, capacity: 0 };

function toIsoDate(value) {
  const dt = value instanceof Date ? new Date(value) : new Date(`${String(value || "").trim()}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value) {
  const dt = new Date(`${String(value || "").trim()}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function addDays(date, amount) {
  const dt = new Date(date);
  dt.setDate(dt.getDate() + amount);
  return dt;
}

function addMonths(date, amount) {
  const dt = new Date(date);
  dt.setMonth(dt.getMonth() + amount);
  return dt;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);
}

function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function dayLabel(isoDate) {
  const dt = parseIsoDate(isoDate);
  if (!dt) return "-";
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function monthRangeLabel(anchorDate) {
  return anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function weekRangeLabel(anchorDate) {
  const start = startOfWeek(anchorDate);
  const end = endOfWeek(anchorDate);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function countByStatus(events) {
  return events.reduce(
    (acc, item) => {
      if (item.status === "booked") acc.booked += 1;
      if (item.status === "accepted") acc.accepted += 1;
      return acc;
    },
    { booked: 0, accepted: 0 }
  );
}

function normalizeVenueKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseTimeToMinutes(value) {
  const text = String(value || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(text)) return null;
  const [hRaw, mRaw] = text.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return (h * 60) + m;
}

function toTimeWindow(time, hours) {
  const start = parseTimeToMinutes(time);
  const durationMin = Math.round(toNumber(hours, 0) * 60);
  if (start === null || durationMin <= 0) return null;
  return {
    start,
    end: start + durationMin
  };
}

function windowsOverlap(a, b) {
  if (!a || !b) return false;
  return a.start < b.end && b.start < a.end;
}

function normalizeStaffLeads(input) {
  const source = Array.isArray(input) ? input : [];
  const seen = new Set();
  const leads = source
    .map((item) => String(item || "").trim())
    .filter((item) => Boolean(item) && !seen.has(item))
    .map((item) => {
      seen.add(item);
      return item;
    });
  return leads.length ? leads : DEFAULT_STAFF_LEADS;
}

function addReason(reasonMap, quoteId, reason) {
  const next = reasonMap.get(quoteId) || new Set();
  next.add(reason);
  reasonMap.set(quoteId, next);
}

function summarizeDayConflicts(events, reasonMap) {
  const next = new Map();
  events.forEach((item) => {
    const reasons = reasonMap.get(item.id);
    if (!reasons || reasons.size === 0) return;
    const day = String(item.date || "").trim();
    if (!day) return;
    const summary = next.get(day) || { total: 0, overlap: 0, unknown: 0, capacity: 0 };
    summary.total += 1;
    if (reasons.has("time_overlap")) summary.overlap += 1;
    if (reasons.has("time_unknown")) summary.unknown += 1;
    if (reasons.has("capacity")) summary.capacity += 1;
    next.set(day, summary);
  });
  return next;
}

function buildConflictInsights(events, capacityLimit) {
  const grouped = new Map();
  const reasonsById = new Map();
  const maxCapacity = Math.max(1, toNumber(capacityLimit, 400));

  events.forEach((item) => {
    const date = String(item.date || "").trim();
    if (!date) return;
    const venueKey = normalizeVenueKey(item.venue) || "__no_venue__";
    const key = `${date}::${venueKey}`;
    const bucket = grouped.get(key) || [];
    bucket.push(item);
    grouped.set(key, bucket);
  });

  grouped.forEach((group) => {
    const windows = new Map(
      group.map((item) => [item.id, toTimeWindow(item.time, item.hours)])
    );
    const hasUnknownWindow = group.some((item) => !windows.get(item.id));

    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        const windowA = windows.get(a.id);
        const windowB = windows.get(b.id);
        if (windowA && windowB) {
          if (windowsOverlap(windowA, windowB)) {
            addReason(reasonsById, a.id, "time_overlap");
            addReason(reasonsById, b.id, "time_overlap");
          }
        } else {
          addReason(reasonsById, a.id, "time_unknown");
          addReason(reasonsById, b.id, "time_unknown");
        }
      }
    }

    if (hasUnknownWindow) {
      const totalLoad = group.reduce((sum, item) => sum + Math.max(0, toNumber(item.guests, 0)), 0);
      if (totalLoad > maxCapacity) {
        group.forEach((item) => addReason(reasonsById, item.id, "capacity"));
      }
      return;
    }

    group.forEach((item, idx) => {
      const itemWindow = windows.get(item.id);
      if (!itemWindow) return;
      let concurrentLoad = Math.max(0, toNumber(item.guests, 0));
      group.forEach((other, otherIdx) => {
        if (idx === otherIdx) return;
        const otherWindow = windows.get(other.id);
        if (windowsOverlap(itemWindow, otherWindow)) {
          concurrentLoad += Math.max(0, toNumber(other.guests, 0));
        }
      });
      if (concurrentLoad > maxCapacity) {
        addReason(reasonsById, item.id, "capacity");
      }
    });
  });

  return {
    reasonsById,
    dayConflicts: summarizeDayConflicts(events, reasonsById),
    maxCapacity
  };
}

function reasonLabel(reason) {
  if (reason === "capacity") return "Capacity risk";
  if (reason === "time_overlap") return "Time overlap";
  if (reason === "time_unknown") return "Unknown time overlap";
  return "Conflict";
}

export default function EventScheduleModal({
  open,
  onClose,
  staffLeads = [],
  capacityLimit = 400
}) {
  const todayIso = toIsoDate(new Date());
  const [state, setState] = useState({ loading: false, error: "", source: "", quotes: [] });
  const [viewMode, setViewMode] = useState("month");
  const [anchorIso, setAnchorIso] = useState(todayIso);
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [feedback, setFeedback] = useState("");
  const [assigningId, setAssigningId] = useState("");
  const [dropLaneKey, setDropLaneKey] = useState("");

  const load = async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const result = await getQuoteHistory();
      setState({
        loading: false,
        error: "",
        source: result.source,
        quotes: result.quotes
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to load schedule data."
      }));
    }
  };

  useEffect(() => {
    if (!open) return;
    setFeedback("");
    setDropLaneKey("");
    load();
  }, [open]);

  const anchorDate = parseIsoDate(anchorIso) || parseIsoDate(todayIso) || new Date();

  const scheduledEvents = useMemo(
    () =>
      state.quotes
        .filter((quote) => STATUS_SET.has(String(quote.status || "")))
        .map((quote) => ({
          id: quote.id,
          quoteNumber: quote.quoteNumber || "-",
          status: String(quote.status || ""),
          date: String(quote.event?.date || ""),
          time: String(quote.event?.time || ""),
          hours: Number(quote.event?.hours || 0),
          eventName: quote.event?.name || "-",
          venue: quote.event?.venue || "-",
          customer: quote.customer?.name || quote.customer?.email || "-",
          guests: Number(quote.event?.guests || 0),
          total: Number(quote.totals?.total || 0),
          staffLead: String(quote.booking?.staffLead || "").trim()
        }))
        .filter((item) => parseIsoDate(item.date))
        .sort((a, b) => {
          const dateCmp = a.date.localeCompare(b.date);
          if (dateCmp !== 0) return dateCmp;
          const timeCmp = String(a.time || "").localeCompare(String(b.time || ""));
          if (timeCmp !== 0) return timeCmp;
          return String(a.quoteNumber || "").localeCompare(String(b.quoteNumber || ""));
        }),
    [state.quotes]
  );

  const eventsByDate = useMemo(() => {
    const next = new Map();
    scheduledEvents.forEach((item) => {
      const bucket = next.get(item.date) || [];
      bucket.push(item);
      next.set(item.date, bucket);
    });
    return next;
  }, [scheduledEvents]);

  const { reasonsById, dayConflicts, maxCapacity } = useMemo(
    () => buildConflictInsights(scheduledEvents, capacityLimit),
    [scheduledEvents, capacityLimit]
  );

  const selectedEvents = useMemo(
    () =>
      (eventsByDate.get(selectedIso) || []).map((item) => ({
        ...item,
        conflictReasons: Array.from(reasonsById.get(item.id) || [])
      })),
    [eventsByDate, selectedIso, reasonsById]
  );
  const selectedCounts = countByStatus(selectedEvents);
  const selectedDayConflicts = dayConflicts.get(selectedIso) || EMPTY_DAY_CONFLICT;

  const resolvedStaffLeads = useMemo(() => {
    const base = normalizeStaffLeads(staffLeads);
    const seen = new Set(base);
    const next = [...base];
    scheduledEvents.forEach((event) => {
      const lead = String(event.staffLead || "").trim();
      if (lead && !seen.has(lead)) {
        seen.add(lead);
        next.push(lead);
      }
    });
    return next;
  }, [staffLeads, scheduledEvents]);

  const laneDefinitions = useMemo(
    () => [
      { id: "", label: "Unassigned" },
      ...resolvedStaffLeads.map((lead) => ({ id: lead, label: lead }))
    ],
    [resolvedStaffLeads]
  );

  const laneEvents = useMemo(() => {
    const next = new Map(laneDefinitions.map((lane) => [lane.id, []]));
    selectedEvents.forEach((event) => {
      const key = next.has(event.staffLead) ? event.staffLead : "";
      const bucket = next.get(key) || [];
      bucket.push(event);
      next.set(key, bucket);
    });
    return next;
  }, [laneDefinitions, selectedEvents]);

  const monthCells = useMemo(() => {
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    const cells = [];
    for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
      const iso = toIsoDate(cursor);
      const events = eventsByDate.get(iso) || [];
      const counts = countByStatus(events);
      cells.push({
        iso,
        date: new Date(cursor),
        inMonth: sameMonth(cursor, monthStart),
        counts,
        conflicts: dayConflicts.get(iso) || EMPTY_DAY_CONFLICT
      });
    }
    return cells;
  }, [anchorDate, eventsByDate, dayConflicts]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, idx) => {
      const dt = addDays(start, idx);
      const iso = toIsoDate(dt);
      const events = (eventsByDate.get(iso) || []).map((event) => ({
        ...event,
        conflictReasons: Array.from(reasonsById.get(event.id) || [])
      }));
      return {
        iso,
        date: dt,
        events,
        conflicts: dayConflicts.get(iso) || EMPTY_DAY_CONFLICT
      };
    });
  }, [anchorDate, eventsByDate, reasonsById, dayConflicts]);

  const shift = (amount) => {
    const next = viewMode === "month" ? addMonths(anchorDate, amount) : addDays(anchorDate, amount * 7);
    setAnchorIso(toIsoDate(next));
  };

  const jumpToToday = () => {
    setAnchorIso(todayIso);
    setSelectedIso(todayIso);
  };

  const handleAssignStaff = async (quoteId, staffLead) => {
    const id = String(quoteId || "").trim();
    if (!id) return;
    const nextLead = String(staffLead || "").trim();
    const assignedAtISO = new Date().toISOString();
    const snapshot = state.quotes;

    setAssigningId(id);
    setDropLaneKey("");
    setFeedback("");
    setState((prev) => ({
      ...prev,
      error: "",
      quotes: prev.quotes.map((quote) => {
        if (quote.id !== id) return quote;
        return {
          ...quote,
          booking: {
            ...(quote.booking || {}),
            staffLead: nextLead,
            staffAssignedAtISO: assignedAtISO
          }
        };
      })
    }));

    try {
      await updateQuoteBookingAssignment({ quoteId: id, staffLead: nextLead });
      setFeedback(nextLead ? `Assigned ${nextLead}.` : "Cleared staff assignment.");
    } catch (err) {
      setState((prev) => ({
        ...prev,
        quotes: snapshot,
        error: err?.message || "Failed to update staff assignment."
      }));
    } finally {
      setAssigningId("");
    }
  };

  const handleDragStart = (event, quoteId) => {
    if (assigningId) return;
    event.dataTransfer.setData("text/plain", quoteId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnLane = (event, laneId) => {
    event.preventDefault();
    if (assigningId) return;
    const quoteId = event.dataTransfer.getData("text/plain");
    if (!quoteId) return;
    handleAssignStaff(quoteId, laneId);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card schedule-card">
        <div className="modal-head">
          <h2>Event Schedule</h2>
          <div className="right-actions">
            <button type="button" className="ghost" onClick={load} disabled={state.loading}>
              {state.loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        <p className="source-note">Source: {state.source || "-"}</p>
        <p className="source-note">Capacity threshold: {maxCapacity} guests per venue/time window.</p>
        {state.error && <p className="error-note">{state.error}</p>}
        {feedback && <p className="source-note">{feedback}</p>}

        <div className="schedule-toolbar">
          <div className="right-actions">
            <button type="button" className="ghost compact" onClick={() => shift(-1)}>Prev</button>
            <button type="button" className="ghost compact" onClick={() => shift(1)}>Next</button>
            <button type="button" className="ghost compact" onClick={jumpToToday}>Today</button>
          </div>
          <strong className="schedule-range">
            {viewMode === "month" ? monthRangeLabel(anchorDate) : weekRangeLabel(anchorDate)}
          </strong>
          <div className="right-actions">
            <button
              type="button"
              className={viewMode === "month" ? "cta compact" : "ghost compact"}
              onClick={() => setViewMode("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={viewMode === "week" ? "cta compact" : "ghost compact"}
              onClick={() => setViewMode("week")}
            >
              Week
            </button>
          </div>
        </div>

        <div className="schedule-layout">
          <section className="schedule-grid-panel">
            {viewMode === "month" ? (
              <>
                <div className="schedule-weekday-row">
                  {WEEKDAY_SHORT.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="schedule-month-grid">
                  {monthCells.map((cell) => {
                    const isSelected = cell.iso === selectedIso;
                    const className = [
                      "schedule-day-cell",
                      cell.inMonth ? "in-month" : "out-month",
                      isSelected ? "selected" : "",
                      cell.counts.booked > 0 ? "has-booked" : "",
                      cell.counts.accepted > 0 ? "has-accepted" : "",
                      cell.conflicts.total > 0 ? "has-conflict" : "",
                      cell.conflicts.capacity > 0 ? "has-capacity" : ""
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        className={className}
                        onClick={() => {
                          setSelectedIso(cell.iso);
                          if (!cell.inMonth) setAnchorIso(cell.iso);
                        }}
                      >
                        <span className="schedule-day-num">{cell.date.getDate()}</span>
                        <div className="schedule-day-badges">
                          {cell.counts.booked > 0 && <small className="booked">{cell.counts.booked} booked</small>}
                          {cell.counts.accepted > 0 && <small className="accepted">{cell.counts.accepted} hold</small>}
                          {cell.conflicts.total > 0 && <small className="conflict">{cell.conflicts.total} risk</small>}
                          {cell.conflicts.capacity > 0 && <small className="capacity">{cell.conflicts.capacity} cap</small>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="schedule-week-grid">
                {weekDays.map((day) => {
                  const isSelected = day.iso === selectedIso;
                  return (
                    <article key={day.iso} className={`schedule-week-day ${isSelected ? "selected" : ""}`}>
                      <button
                        type="button"
                        className="schedule-week-head"
                        onClick={() => setSelectedIso(day.iso)}
                      >
                        <strong>{WEEKDAY_SHORT[day.date.getDay()]}</strong>
                        <span>{day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      </button>
                      <div className="schedule-week-events">
                        {day.events.length === 0 && <p className="muted">No events</p>}
                        {day.events.map((item) => (
                          <div
                            key={item.id}
                            className={[
                              "schedule-mini-event",
                              item.status,
                              item.conflictReasons.length ? "has-conflict" : "",
                              item.conflictReasons.includes("capacity") ? "has-capacity" : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <strong>{item.time || "TBD"}</strong>
                            <span>{item.quoteNumber}</span>
                            {item.conflictReasons.length > 0 && (
                              <small>{item.conflictReasons.includes("capacity") ? "capacity risk" : "time conflict"}</small>
                            )}
                          </div>
                        ))}
                        {day.conflicts.total > 0 && (
                          <p className="warning-note schedule-day-risk-note">
                            {day.conflicts.total} conflict event(s)
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="schedule-day-panel">
            <h3>{dayLabel(selectedIso)}</h3>
            <p className="source-note">
              Booked: {selectedCounts.booked} • Accepted: {selectedCounts.accepted}
            </p>
            {selectedDayConflicts.total > 0 && (
              <p className="warning-note">
                Conflict flags: {selectedDayConflicts.total}
                {selectedDayConflicts.overlap > 0 ? ` • overlap ${selectedDayConflicts.overlap}` : ""}
                {selectedDayConflicts.unknown > 0 ? ` • unknown ${selectedDayConflicts.unknown}` : ""}
                {selectedDayConflicts.capacity > 0 ? ` • capacity ${selectedDayConflicts.capacity}` : ""}
              </p>
            )}
            {selectedEvents.length === 0 ? (
              <p className="muted">No accepted/booked events for this day.</p>
            ) : (
              <>
                <div className="schedule-event-list">
                  {selectedEvents.map((item) => (
                    <article
                      key={item.id}
                      className={[
                        "schedule-event-card",
                        item.status,
                        item.conflictReasons.length ? "has-conflict" : "",
                        item.conflictReasons.includes("capacity") ? "has-capacity" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <header>
                        <strong>{item.quoteNumber}</strong>
                        <span>{item.status}</span>
                      </header>
                      <p>{item.eventName}</p>
                      <p>{item.time || "Time TBD"} • {item.venue}</p>
                      <p>{item.customer} • {item.guests || 0} guests</p>
                      <p>Total: {currency(item.total)}</p>
                      <label className="schedule-assignment-field">
                        <span>Staff lead</span>
                        <select
                          value={item.staffLead}
                          onChange={(event) => handleAssignStaff(item.id, event.target.value)}
                          disabled={Boolean(assigningId)}
                        >
                          <option value="">Unassigned</option>
                          {resolvedStaffLeads.map((lead) => (
                            <option key={lead} value={lead}>{lead}</option>
                          ))}
                        </select>
                      </label>
                      {item.conflictReasons.length > 0 && (
                        <p className="schedule-conflict-note">
                          {item.conflictReasons.map((reason) => reasonLabel(reason)).join(" • ")}
                        </p>
                      )}
                    </article>
                  ))}
                </div>

                <section className="schedule-staff-board">
                  <div className="schedule-staff-head">
                    <h4>Staffing Board</h4>
                    <p className="source-note">Drag events into a lane to assign staff lead.</p>
                  </div>
                  <div className="schedule-staff-lanes">
                    {laneDefinitions.map((lane) => {
                      const laneKey = lane.id || "__unassigned__";
                      const laneItems = laneEvents.get(lane.id) || [];
                      const laneClass = [
                        "schedule-staff-lane",
                        lane.id ? "assigned" : "unassigned",
                        dropLaneKey === laneKey ? "drop-target" : ""
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <div
                          key={laneKey}
                          className={laneClass}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (!assigningId) {
                              setDropLaneKey(laneKey);
                              event.dataTransfer.dropEffect = "move";
                            }
                          }}
                          onDragLeave={() => setDropLaneKey((prev) => (prev === laneKey ? "" : prev))}
                          onDrop={(event) => handleDropOnLane(event, lane.id)}
                        >
                          <header>
                            <strong>{lane.label}</strong>
                            <span>{laneItems.length}</span>
                          </header>
                          <div className="schedule-staff-items">
                            {laneItems.length === 0 && <p className="muted">Drop events here</p>}
                            {laneItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={[
                                  "schedule-staff-card",
                                  item.status,
                                  item.conflictReasons.length ? "has-conflict" : "",
                                  item.conflictReasons.includes("capacity") ? "has-capacity" : ""
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                draggable={!assigningId}
                                onDragStart={(event) => handleDragStart(event, item.id)}
                                disabled={Boolean(assigningId)}
                                onClick={() => setSelectedIso(item.date)}
                              >
                                <strong>{item.quoteNumber}</strong>
                                <span>{item.time || "TBD"} • {item.guests || 0} guests</span>
                                {item.conflictReasons.length > 0 && (
                                  <small>
                                    {item.conflictReasons.includes("capacity") ? "capacity risk" : "time conflict"}
                                  </small>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
