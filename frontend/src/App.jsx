import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Link,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  FiGrid,
  FiHome,
  FiUsers,
  FiCalendar,
  FiPlus,
  FiSearch,
  FiArrowUpRight,
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiMenu,
} from "react-icons/fi";
import "./index.css";
const API = import.meta.env.VITE_API_URL || "/api";
const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);
const date = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const statuses = ["Booked", "Checked In", "Checked Out", "Cancelled"];
async function request(path, method = "GET", body) {
  const r = await fetch(`${API}/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error(
      "Unable to reach the hotel server. Start the backend and try again.",
    );
  }
  if (!r.ok) throw new Error(data.message || "Request failed.");
  return data;
}
function Badge({ children }) {
  return (
    <span
      className={"badge " + String(children).toLowerCase().replaceAll(" ", "-")}
    >
      {children}
    </span>
  );
}
function useData() {
  const [data, setData] = useState({ rooms: [], customers: [], bookings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rooms, customers, bookings] = await Promise.all(
        ["rooms", "customers", "bookings"].map((p) => request(p)),
      );
      setData({ rooms, customers, bookings });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all(["rooms", "customers", "bookings"].map((p) => request(p)))
      .then(([rooms, customers, bookings]) => {
        if (active) setData({ rooms, customers, bookings });
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return { ...data, loading, error, reload };
}
function Notice({ loading, error, reload }) {
  return loading ? (
    <div className="notice" role="status">
      Loading your hotel…
    </div>
  ) : error ? (
    <div className="notice error" role="alert">
      {error}
      <button className="btn secondary" onClick={reload}>
        Try again
      </button>
    </div>
  ) : null;
}
function Heading({ title, text, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">THOUGHTFUL HOSPITALITY, EVERY DAY</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function Empty({ kind }) {
  return (
    <div className="empty">
      <FiCalendar />
      <h3>No {kind === "customers" ? "guests" : kind} yet</h3>
      <p>Add your first record to get started.</p>
      <Link className="btn primary" to={`/${kind}/new`}>
        <FiPlus /> Add{" "}
        {kind === "customers"
          ? "guest"
          : kind === "rooms"
            ? "room"
            : "reservation"}
      </Link>
    </div>
  );
}
function BookingTable({ bookings, actions }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Guest</th>
            <th>Room</th>
            <th>Stay</th>
            <th>Amount</th>
            <th>Status</th>
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b._id}>
              <td>
                <div className="guest-cell">
                  <span className="guest-avatar">
                    {(b.customer?.name || "?")
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    <strong>{b.customer?.name || "Deleted guest"}</strong>
                    <small>{b.customer?.email || "—"}</small>
                  </span>
                </div>
              </td>
              <td>
                <strong>{b.room?.roomNumber || "—"}</strong>
                <small>{b.room?.roomType}</small>
              </td>
              <td>
                {date(b.checkIn)}
                <small>to {date(b.checkOut)}</small>
              </td>
              <td>{money(b.totalPrice)}</td>
              <td>
                <Badge>{b.status}</Badge>
              </td>
              {actions && <td>{actions(b)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Dashboard() {
  const d = useData();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const occupied = new Set(
    d.bookings
      .filter(
        (b) =>
          ["Booked", "Checked In"].includes(b.status) &&
          b.checkIn.slice(0, 10) <= today &&
          b.checkOut.slice(0, 10) > today,
      )
      .map((b) => b.room?._id),
  ).size;
  const percent = d.rooms.length
    ? Math.round((occupied / d.rooms.length) * 100)
    : 0;
  const revenue = d.bookings
    .filter((b) => b.status !== "Cancelled")
    .reduce((n, b) => n + b.totalPrice, 0);
  const arrivals = d.bookings.filter(
    (b) => b.checkIn.slice(0, 10) === today && b.status === "Booked",
  ).length;
  return (
    <>
      <Heading
        title="A warm welcome back."
        text="Here’s what’s happening at your hotel today."
        action={
          <Link className="btn primary" to="/bookings/new">
            <FiPlus /> New reservation
          </Link>
        }
      />
      <Notice {...d} />
      {!d.loading && !d.error && (
        <>
          <section className="welcome-banner">
            <div>
              <span className="banner-label">
                <i className="online-dot" /> YOUR DAY, BEAUTIFULLY ORGANIZED
              </span>
              <h2>
                Great stays.
                <br />
                Even better experiences.
              </h2>
              <p>
                A clear view of your property, so you can focus on your guests.
              </p>
              <Link to="/rooms">
                Explore your rooms <FiArrowUpRight />
              </Link>
            </div>
            <div className="hotel-art" aria-hidden="true">
              <div className="sun" />
              <div className="building">
                <div className="roof">HAVEN</div>
                <div className="windows">
                  {Array.from({ length: 12 }, (_, i) => (
                    <i key={i} />
                  ))}
                </div>
                <div className="door" />
              </div>
              <div className="plant plant-one">♣</div>
              <div className="plant plant-two">♣</div>
              <div className="ground" />
            </div>
          </section>
          <section className="stats-grid">
            {[
              [
                FiHome,
                "Total rooms",
                d.rooms.length,
                `${Math.max(0, d.rooms.length - occupied)} unoccupied today`,
                "teal",
              ],
              [
                FiCalendar,
                "Reservations",
                d.bookings.length,
                `${arrivals} arrivals expected today`,
                "blue",
              ],
              [
                FiUsers,
                "Registered guests",
                d.customers.length,
                "Every guest, thoughtfully welcomed",
                "gold",
              ],
              [
                FiArrowUpRight,
                "Reservation value",
                money(revenue),
                "All non-cancelled reservations",
                "rose",
              ],
            ].map(([Icon, label, value, detail, color]) => (
              <article className="stat-card" key={label}>
                <div className="stat-top">
                  <span>{label}</span>
                  <span className={"stat-icon " + color}>
                    <Icon />
                  </span>
                </div>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </section>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Recent reservations</h2>
                  <p>The latest activity at your property.</p>
                </div>
                <Link className="text-link" to="/bookings">
                  View all <FiArrowUpRight />
                </Link>
              </div>
              <BookingTable bookings={d.bookings.slice(0, 5)} />
              {!d.bookings.length && <Empty kind="bookings" />}
            </section>
            <section className="panel occupancy">
              <div className="panel-heading">
                <div>
                  <h2>Room occupancy</h2>
                  <p>A snapshot of today.</p>
                </div>
                <span className="pill">Today</span>
              </div>
              <div className="donut" style={{ "--occupancy": percent + "%" }}>
                <div>
                  <strong>{percent}%</strong>
                  <span>occupied</span>
                </div>
              </div>
              <div className="legend">
                <span>
                  <i />
                  Occupied<strong>{occupied}</strong>
                </span>
                <span>
                  <i />
                  Unoccupied
                  <strong>{Math.max(0, d.rooms.length - occupied)}</strong>
                </span>
              </div>
              <Link className="btn secondary full" to="/rooms">
                Manage rooms <FiArrowUpRight />
              </Link>
            </section>
          </div>
          <section className="quick-links">
            <div>
              <span className="eyebrow">THE LITTLE THINGS, SIMPLIFIED</span>
              <h2>Ready for your next guest?</h2>
            </div>
            <Link to="/customers/new">
              <FiUsers /> Register a guest <FiArrowUpRight />
            </Link>
            <Link to="/rooms/new">
              <FiHome /> Add a room <FiArrowUpRight />
            </Link>
          </section>
        </>
      )}
    </>
  );
}
function Listing({ kind }) {
  const d = useData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title =
    kind === "customers"
      ? "Guests"
      : kind === "rooms"
        ? "Rooms & suites"
        : "Reservations";
  const label =
    kind === "customers" ? "guest" : kind === "rooms" ? "room" : "reservation";
  const items = d[kind].filter(
    (x) =>
      JSON.stringify(x).toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All" || x.status === filter),
  );
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await request(`${kind}/${deleting._id}`, "DELETE");
      setDeleting(null);
      await d.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const actions = (x) => (
    <div className="row-actions">
      <Link aria-label={`Edit ${label}`} to={`/${kind}/edit/${x._id}`}>
        <FiEdit2 />
      </Link>
      <button
        aria-label={`Delete ${label}`}
        onClick={() => {
          setError("");
          setDeleting(x);
        }}
      >
        <FiTrash2 />
      </button>
    </div>
  );
  return (
    <>
      <Heading
        title={title}
        text={
          kind === "rooms"
            ? "A space for every stay. Manage your rooms and nightly rates."
            : kind === "customers"
              ? "Keep your guest details organized and close at hand."
              : "From first arrival to fond farewell. Every stay in one place."
        }
        action={
          <Link className="btn primary" to={`/${kind}/new`}>
            <FiPlus /> New {label}
          </Link>
        }
      />
      <Notice {...d} />
      {!d.loading && !d.error && (
        <section className="panel">
          <div className="list-toolbar">
            <h2>
              All {title.toLowerCase()}{" "}
              <span className="count">{d[kind].length}</span>
            </h2>
            <div className="list-controls">
              <label className="search">
                <FiSearch />
                <input
                  aria-label={`Search ${title}`}
                  placeholder={`Search ${title.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {kind !== "customers" && (
                <select
                  aria-label="Filter status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    "All",
                    ...(kind === "rooms" ? ["Available", "Booked"] : statuses),
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {!d[kind].length ? (
            <Empty kind={kind} />
          ) : !items.length ? (
            <div className="empty">
              <h3>No matches found</h3>
              <p>Try another search or status.</p>
            </div>
          ) : kind === "bookings" ? (
            <BookingTable bookings={items} actions={actions} />
          ) : kind === "customers" ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Guest name</th>
                    <th>Email address</th>
                    <th>Phone number</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <div className="guest-cell">
                          <span className="guest-avatar">
                            {c.name.slice(0, 2).toUpperCase()}
                          </span>
                          <strong>{c.name}</strong>
                        </div>
                      </td>
                      <td>{c.email}</td>
                      <td>{c.phone}</td>
                      <td>{actions(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="room-grid">
              {items.map((r, i) => (
                <article className="room-card" key={r._id}>
                  <div className={"room-visual room-tone-" + (i % 3)}>
                    <span className="room-number">{r.roomNumber}</span>
                    <FiHome />
                    <Badge>{r.status}</Badge>
                  </div>
                  <div className="room-info">
                    <span className="eyebrow">ROOM {r.roomNumber}</span>
                    <h3>{r.roomType}</h3>
                    <p>
                      <FiUsers /> Up to {r.capacity} guests
                    </p>
                    <div className="room-bottom">
                      <span>
                        <strong>{money(r.price)}</strong>
                        <small> / night</small>
                      </span>
                      {actions(r)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="table-footer">
            Showing {items.length} of {d[kind].length} {title.toLowerCase()}
          </div>
        </section>
      )}
      {deleting && (
        <div className="modal-overlay">
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">Delete this {label}?</h2>
            <p>
              This permanently removes{" "}
              {deleting.name || deleting.roomNumber || "this reservation"}. This
              action cannot be undone.
            </p>
            {error && (
              <div role="alert" className="notice error">
                {error}
              </div>
            )}
            <div className="form-actions">
              <button
                autoFocus
                disabled={busy}
                className="btn secondary"
                onClick={() => setDeleting(null)}
              >
                Keep {label}
              </button>
              <button disabled={busy} className="btn danger" onClick={remove}>
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function Editor({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const d = useData();
  const [values, setValues] = useState(
    kind === "rooms"
      ? {
          roomNumber: "",
          roomType: "Standard",
          price: "",
          capacity: 2,
          status: "Available",
        }
      : kind === "customers"
        ? { name: "", email: "", phone: "" }
        : {
            customer: "",
            room: "",
            checkIn: "",
            checkOut: "",
            status: "Booked",
          },
  );
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!id) return;
    let active = true;
    request(`${kind}/${id}`)
      .then((x) => {
        if (active) {
          setValues({
            ...x,
            customer: x.customer?._id,
            room: x.room?._id,
            checkIn: x.checkIn?.slice(0, 10),
            checkOut: x.checkOut?.slice(0, 10),
          });
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [kind, id]);
  const label =
    kind === "rooms" ? "room" : kind === "customers" ? "guest" : "reservation";
  const update = (e) =>
    setValues({ ...values, [e.target.name]: e.target.value });
  const field = (name, label, type = "text", extra = {}) => (
    <label className="field">
      {label}
      <input
        name={name}
        type={type}
        value={values[name] ?? ""}
        onChange={update}
        required
        {...extra}
      />
    </label>
  );
  const select = (name, label, options) => (
    <label className="field">
      {label}
      <select name={name} value={values[name] ?? ""} onChange={update} required>
        <option value="" disabled>
          Select {label.toLowerCase()}
        </option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const room = d.rooms.find((r) => r._id === values.room);
  const nights =
    Math.max(
      0,
      Math.round(
        (new Date(values.checkOut) - new Date(values.checkIn)) / 86400000,
      ),
    ) || 0;
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (kind === "bookings" && !nights) {
      setError("Check-out must be after check-in.");
      return;
    }
    setSaving(true);
    try {
      await request(
        `${kind}${id ? "/" + id : ""}`,
        id ? "PUT" : "POST",
        values,
      );
      navigate("/" + kind);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={"/" + kind}>
        <FiArrowLeft /> Back to{" "}
        {kind === "customers"
          ? "guests"
          : kind === "bookings"
            ? "reservations"
            : "rooms"}
      </Link>
      <Heading
        title={`${id ? "Edit" : "New"} ${label}`}
        text={`Enter the ${label} details below. Keep every stay organized.`}
      />
      <Notice {...d} />
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {loaded && !d.loading && !d.error && (
        <div className="editor-layout">
          <form className="panel editor-form" onSubmit={submit}>
            <div className="panel-heading">
              <h2>{label.charAt(0).toUpperCase() + label.slice(1)} details</h2>
              <span className="pill">
                {id ? "Update record" : "New record"}
              </span>
            </div>
            <div className="fields">
              {kind === "rooms" ? (
                <>
                  {field("roomNumber", "Room number", "text", {
                    maxLength: 20,
                  })}
                  {select(
                    "roomType",
                    "Room type",
                    [
                      ...new Set([
                        "Standard",
                        "Deluxe",
                        "Suite",
                        "Family",
                        "Presidential",
                        values.roomType,
                      ]),
                    ]
                      .filter(Boolean)
                      .map((v) => [v, v]),
                  )}
                  {field("price", "Nightly rate (USD)", "number", {
                    min: 1,
                    step: "0.01",
                  })}
                  {field("capacity", "Guest capacity", "number", {
                    min: 1,
                    max: 30,
                  })}
                </>
              ) : kind === "customers" ? (
                <>
                  {field("name", "Full name", "text", { maxLength: 100 })}
                  {field("email", "Email address", "email")}
                  {field("phone", "Phone number", "tel", { maxLength: 30 })}
                </>
              ) : (
                <>
                  {select(
                    "customer",
                    "Guest",
                    d.customers.map((c) => [c._id, c.name]),
                  )}
                  {select(
                    "room",
                    "Room",
                    d.rooms.map((r) => [
                      r._id,
                      `${r.roomNumber} · ${r.roomType} · ${money(r.price)}/night`,
                    ]),
                  )}
                  {field("checkIn", "Check-in date", "date")}
                  {field("checkOut", "Check-out date", "date", {
                    min: values.checkIn || undefined,
                  })}
                  {select(
                    "status",
                    "Reservation status",
                    statuses.map((v) => [v, v]),
                  )}
                  <div className="price-summary">
                    <span>
                      {nights} night{nights !== 1 ? "s" : ""} ×{" "}
                      {money(room?.price)}
                    </span>
                    <strong>{money(nights * (room?.price || 0))}</strong>
                    <small>
                      Total is calculated from the room rate on save.
                    </small>
                  </div>
                  {(!d.rooms.length || !d.customers.length) && (
                    <p className="form-hint">
                      Create a <Link to="/customers/new">guest</Link> and a{" "}
                      <Link to="/rooms/new">room</Link> before making a
                      reservation.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="form-actions">
              <Link className="btn secondary" to={"/" + kind}>
                Cancel
              </Link>
              <button
                className="btn primary"
                disabled={
                  saving ||
                  (kind === "bookings" &&
                    (!d.rooms.length || !d.customers.length))
                }
              >
                <FiCheck /> {saving ? "Saving…" : `Save ${label}`}
              </button>
            </div>
          </form>
          <aside className="editor-note">
            <span className="sparkle">✧</span>
            <h2>
              Details make
              <br />
              the difference.
            </h2>
            <p>
              {kind === "bookings"
                ? "Choose your guest, room, and dates. We check for overlapping reservations before confirming the stay."
                : kind === "rooms"
                  ? "Keep rates and capacity up to date to make every reservation effortless."
                  : "A complete guest profile makes check-in smoother and every welcome more personal."}
            </p>
            <div className="note-line" />
            <small>THOUGHTFUL HOSPITALITY, EVERY DAY.</small>
          </aside>
        </div>
      )}
    </>
  );
}
function Shell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (open ? "open" : "")}>
        <Link className="brand" to="/" onClick={() => setOpen(false)}>
          <span className="brand-mark">
            H<span>✦</span>
          </span>
          <span>
            Haven<span className="brand-sub">HOTEL MANAGEMENT</span>
          </span>
        </Link>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {[
            ["/", FiGrid, "Overview"],
            ["/bookings", FiCalendar, "Reservations"],
            ["/rooms", FiHome, "Rooms & suites"],
            ["/customers", FiUsers, "Guests"],
          ].map(([to, Icon, text]) => (
            <NavLink
              key={to}
              end={to === "/"}
              to={to}
              onClick={() => setOpen(false)}
            >
              <Icon />
              {text}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="sparkle">✧</span>
          <h3>A little more hospitality.</h3>
          <p>Thoughtful stays start with a well-managed day.</p>
          <Link to="/bookings/new" onClick={() => setOpen(false)}>
            Create a reservation <FiArrowUpRight />
          </Link>
        </div>
        <div className="property">
          <span className="property-icon">
            <FiHome />
          </span>
          <div>
            Haven Hotel<small>Property workspace</small>
          </div>
          <i className="online-dot" />
        </div>
      </aside>
      {open && (
        <button
          className="backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="menu-button"
              aria-label="Toggle menu"
              onClick={() => setOpen(!open)}
            >
              <FiMenu />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>Haven Hotel</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="today">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <span className="avatar">HM</span>
            <span className="manager">
              Hotel manager<small>Front office</small>
            </span>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/home" element={<Dashboard />} />
            {["rooms", "customers", "bookings"].flatMap((kind) => [
              <Route
                key={kind}
                path={"/" + kind}
                element={<Listing key={kind} kind={kind} />}
              />,
              <Route
                key={kind + "new"}
                path={`/${kind}/new`}
                element={<Editor key={kind + "new"} kind={kind} />}
              />,
              <Route
                key={kind + "edit"}
                path={`/${kind}/edit/:id`}
                element={<Editor key={kind + "edit"} kind={kind} />}
              />,
            ])}
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found</h1>
                  <Link to="/" className="btn primary">
                    Back to overview
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer>
          HAVEN <span>Made for exceptional hospitality.</span>
          <span>Hotel management system</span>
        </footer>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

