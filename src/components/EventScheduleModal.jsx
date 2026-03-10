import { useEffect, useMemo, useState } from "react";
import { currency } from "../lib/quoteCalculator";
import { getQuoteHistory } from "../lib/quoteStore";

const STATUS_SET = new Set(["accepted", "booked"]);
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function EventScheduleModal({ open, onClose }) {
  const todayIso = toIsoDate(new Date());
  const [state, setState] = useState({ loading: false, error: "", source: "", quotes: [] });
  const [viewMode, setViewMode] = useState("month");
  const [anchorIso, setAnchorIso] = useState(todayIso);
  const [selectedIso, setSelectedIso] = useState(todayIso);

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
    if (open) {
      load();
    }
  }, [open]);

  if (!open) return null;

  const anchorDate = parseIsoDate(anchorIso) || parseIsoDate(todayIso) || new Date();
  const selectedDate = parseIsoDate(selectedIso) || anchorDate;

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
          eventName: quote.event?.name || "-",
          venue: quote.event?.venue || "-",
          customer: quote.customer?.name || quote.customer?.email || "-",
          guests: Number(quote.event?.guests || 0),
          total: Number(quote.totals?.total || 0)
        }))
        .filter((item) => parseIsoDate(item.date))
        .sort((a, b) => {
          const dateCmp = a.date.localeCompare(b.date);
          if (dateCmp !== 0) return dateCmp;
          return String(a.time || "").localeCompare(String(b.time || ""));
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

  const selectedEvents = eventsByDate.get(selectedIso) || [];
  const selectedCounts = countByStatus(selectedEvents);

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
        counts
      });
    }
    return cells;
  }, [anchorDate, eventsByDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, idx) => {
      const dt = addDays(start, idx);
      const iso = toIsoDate(dt);
      const events = eventsByDate.get(iso) || [];
      const counts = countByStatus(events);
      return { iso, date: dt, events, counts };
    });
  }, [anchorDate, eventsByDate]);

  const shift = (amount) => {
    const next = viewMode === "month" ? addMonths(anchorDate, amount) : addDays(anchorDate, amount * 7);
    setAnchorIso(toIsoDate(next));
  };

  const jumpToToday = () => {
    setAnchorIso(todayIso);
    setSelectedIso(todayIso);
  };

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
        {state.error && <p className="error-note">{state.error}</p>}

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
                      cell.counts.accepted > 0 ? "has-accepted" : ""
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
                          <div key={item.id} className={`schedule-mini-event ${item.status}`}>
                            <strong>{item.time || "TBD"}</strong>
                            <span>{item.quoteNumber}</span>
                          </div>
                        ))}
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
            {selectedEvents.length === 0 ? (
              <p className="muted">No accepted/booked events for this day.</p>
            ) : (
              <div className="schedule-event-list">
                {selectedEvents.map((item) => (
                  <article key={item.id} className={`schedule-event-card ${item.status}`}>
                    <header>
                      <strong>{item.quoteNumber}</strong>
                      <span>{item.status}</span>
                    </header>
                    <p>{item.eventName}</p>
                    <p>{item.time || "Time TBD"} • {item.venue}</p>
                    <p>{item.customer} • {item.guests || 0} guests</p>
                    <p>Total: {currency(item.total)}</p>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
