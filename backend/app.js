import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const statuses = ["Booked", "Checked In", "Checked Out", "Cancelled"];
const active = (b) => ["Booked", "Checked In"].includes(b.status);
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const text = (v, name, max = 100) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    fail(`${name} is required (maximum ${max} characters).`);
  return v.trim();
};
const numeric = (v, name, min = 1, max = 100000000) => {
  if (
    v === "" ||
    v === null ||
    typeof v === "boolean" ||
    !Number.isFinite(Number(v)) ||
    Number(v) < min ||
    Number(v) > max
  )
    fail(`${name} must be between ${min} and ${max}.`);
  return Number(v);
};
export function createApp(store) {
  const app = express();
  app.use(
    cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  let queue = Promise.resolve();
  const serialized = (fn) => (req, res, next) => {
    const task = queue.then(() => fn(req, res));
    queue = task.catch(() => {});
    task.catch(next);
  };
  async function populated(b) {
    return {
      ...b,
      customer: await store.get("customers", String(b.customer)),
      room: await store.get("rooms", String(b.room)),
    };
  }
  async function output(kind, x) {
    if (kind === "bookings") return populated(x);
    if (kind === "rooms") {
      const now = new Date();
      const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const occupied = (await store.all("bookings")).some(
        (b) =>
          String(b.room) === String(x._id) &&
          active(b) &&
          Date.parse(b.checkIn) <= today &&
          Date.parse(b.checkOut) > today,
      );
      return { ...x, status: occupied ? "Booked" : "Available" };
    }
    return x;
  }
  async function validated(kind, body, id) {
    if (kind === "rooms") {
      const roomNumber = text(body.roomNumber, "Room number", 20);
      const roomType = text(body.roomType, "Room type", 60);
      const price = numeric(body.price, "Nightly rate");
      const capacity = numeric(body.capacity, "Capacity", 1, 30);
      if (!Number.isInteger(capacity)) fail("Capacity must be a whole number.");
      const status = body.status || "Available";
      if (!["Available", "Booked"].includes(status))
        fail("Invalid room status.");
      if (
        (await store.all(kind)).some(
          (x) =>
            String(x._id) !== id &&
            x.roomNumber.toLowerCase() === roomNumber.toLowerCase(),
        )
      )
        fail("This room number already exists.", 409);
      return { roomNumber, roomType, price, capacity, status };
    }
    if (kind === "customers") {
      const name = text(body.name, "Full name");
      const phone = text(body.phone, "Phone number", 30);
      const email = text(body.email, "Email", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Enter a valid email address.");
      if (
        (await store.all(kind)).some(
          (x) => String(x._id) !== id && x.email.toLowerCase() === email,
        )
      )
        fail("This email address is already registered.", 409);
      return { name, phone, email };
    }
    const customer = text(body.customer, "Guest identifier");
    const room = text(body.room, "Room identifier");
    if (!(await store.get("customers", customer)))
      fail("Guest not found.", 404);
    const selected = await store.get("rooms", room);
    if (!selected) fail("Room not found.", 404);
    const checkDate = (v) => {
      if (
        typeof v !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        !Number.isFinite(Date.parse(v)) ||
        new Date(v).toISOString().slice(0, 10) !== v
      )
        fail("Enter valid check-in and check-out dates.");
      return new Date(v).toISOString();
    };
    const checkIn = checkDate(body.checkIn);
    const checkOut = checkDate(body.checkOut);
    const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
    if (nights <= 0) fail("Check-out must be after check-in.");
    const status = body.status || "Booked";
    if (!statuses.includes(status)) fail("Invalid reservation status.");
    const bookings = await store.all("bookings");
    if (
      active({ status }) &&
      bookings.some(
        (b) =>
          String(b._id) !== id &&
          String(b.room) === room &&
          active(b) &&
          Date.parse(b.checkIn) < Date.parse(checkOut) &&
          Date.parse(b.checkOut) > Date.parse(checkIn),
      )
    )
      fail(
        "This room already has a reservation for the selected dates. Please choose another room or dates.",
        409,
      );
    const old = id ? await store.get("bookings", id) : null;
    const sameStay =
      old &&
      String(old.room) === room &&
      Date.parse(old.checkIn) === Date.parse(checkIn) &&
      Date.parse(old.checkOut) === Date.parse(checkOut);
    return {
      customer,
      room,
      checkIn,
      checkOut,
      status,
      totalPrice: sameStay
        ? old.totalPrice
        : Math.round(nights * selected.price * 100) / 100,
    };
  }
  for (const kind of ["rooms", "customers", "bookings"]) {

    for (const base of [`/api/${kind}`]) {
      app.get(base, async (_req, res) => {
        const items = await store.all(kind);
        res.json(await Promise.all(items.map((x) => output(kind, x))));
      });
      app.get(base + "/:id", async (req, res) => {
        const x = await store.get(kind, req.params.id);
        if (!x) fail("Record not found.", 404);
        res.json(await output(kind, x));
      });
      app.post(
        base,
        serialized(async (req, res) => {
          const value = await validated(kind, req.body);
          const now = new Date().toISOString();
          const x = await store.save(kind, {
            ...value,
            _id: new mongoose.Types.ObjectId().toString(),
            createdAt: now,
            updatedAt: now,
          });
          res.status(201).json(await output(kind, x));
        }),
      );
      app.put(
        base + "/:id",
        serialized(async (req, res) => {
          const old = await store.get(kind, req.params.id);
          if (!old) fail("Record not found.", 404);
          const value = await validated(kind, req.body, req.params.id);
          const x = await store.save(kind, {
            ...old,
            ...value,
            updatedAt: new Date().toISOString(),
          });
          res.json(await output(kind, x));
        }),
      );
      app.delete(
        base + "/:id",
        serialized(async (req, res) => {
          if (!(await store.get(kind, req.params.id)))
            fail("Record not found.", 404);
          if (
            kind !== "bookings" &&
            (await store.all("bookings")).some(
              (b) =>
                String(b[kind === "rooms" ? "room" : "customer"]) ===
                req.params.id,
            )
          )
            fail(
              "This record is linked to reservations. Remove those reservations first to preserve guest history.",
              409,
            );
          await store.remove(kind, req.params.id);
          res.json({ message: "Record deleted successfully." });
        }),
      );
    }
  }
  app.use("/api", (_req, res) =>
    res.status(404).json({ message: "API endpoint not found." }),
  );
  const frontend = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../frontend/dist",
  );
  if (existsSync(frontend)) {
    app.use(express.static(frontend));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(frontend, "index.html")),
    );
  }
  app.use((err, _req, res, _next) => {
    const status =
      err.status ||
      (["ValidationError", "CastError"].includes(err.name)
        ? 400
        : err.code === 11000
          ? 409
          : 500);
    res
      .status(status)
      .json({
        message:
          status === 500
            ? "The server could not complete the request. Please try again."
            : err.message,
      });
  });
  return app;
}

