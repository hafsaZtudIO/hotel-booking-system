import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStore } from "./store.js";
import { createApp } from "./app.js";

test("hotel workflows, date conflicts, persistence and validation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "haven-test-"));
  const file = path.join(directory, "hotel.json");
  const store = await createStore({ file });
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (p, method = "GET", body) => {
    const r = await fetch(base + p, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    assert.equal((await call("/health")).status, 200);
    const guest = (
      await call("/customers", "POST", {
        name: "Test Guest",
        email: "test@example.com",
        phone: "+254700000000",
      })
    ).data;
    assert.ok(guest._id);
    assert.equal(
      (
        await call("/customers", "POST", {
          name: "Duplicate",
          email: "TEST@example.com",
          phone: "123",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/customers", "POST", {
          name: "Invalid",
          email: "bad",
          phone: "123",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/rooms", "POST", {
          roomNumber: "X",
          roomType: "Suite",
          price: -1,
          capacity: 2,
        })
      ).status,
      400,
    );
    const room = (
      await call("/rooms", "POST", {
        roomNumber: "101",
        roomType: "Deluxe",
        price: 8500,
        capacity: 2,
      })
    ).data;
    const room2 = (
      await call("/rooms", "POST", {
        roomNumber: "102",
        roomType: "Suite",
        price: 10000,
        capacity: 3,
      })
    ).data;
    const booking = {
      customer: guest._id,
      room: room._id,
      checkIn: "2027-01-01",
      checkOut: "2027-01-04",
      status: "Booked",
      totalPrice: 1,
    };
    const saved = await call("/bookings", "POST", booking);
    assert.equal(saved.status, 201);
    assert.equal(saved.data.totalPrice, 25500);
    assert.equal(saved.data.customer.name, "Test Guest");
    assert.equal((await call("/bookings", "POST", booking)).status, 409);
    assert.equal(
      (await call("/bookings", "POST", { ...booking, checkOut: "2026-12-31" }))
        .status,
      400,
    );
    assert.equal(
      (await call("/bookings", "POST", { ...booking, checkIn: "2027-02-30" }))
        .status,
      400,
    );
    assert.equal(
      (await call("/bookings", "POST", { ...booking, customer: "missing" }))
        .status,
      404,
    );
    const adjacent = await call("/bookings", "POST", {
      ...booking,
      checkIn: "2027-01-04",
      checkOut: "2027-01-05",
    });
    assert.equal(adjacent.status, 201);
    assert.equal((await call("/rooms/" + room._id, "DELETE")).status, 409);
    assert.equal((await call("/customers/" + guest._id, "DELETE")).status, 409);
    const moved = await call("/bookings/" + saved.data._id, "PUT", {
      ...booking,
      room: room2._id,
    });
    assert.equal(moved.data.totalPrice, 30000);
    assert.equal((await call("/bookings", "POST", booking)).status, 201);
    await call("/bookings/" + saved.data._id, "PUT", {
      ...booking,
      room: room2._id,
      status: "Cancelled",
    });
    const concurrent = await Promise.all([
      call("/bookings", "POST", { ...booking, room: room2._id }),
      call("/bookings", "POST", { ...booking, room: room2._id }),
    ]);
    assert.deepEqual(concurrent.map((x) => x.status).sort(), [201, 409]);
    await call("/rooms/" + room2._id, "PUT", { ...room2, price: 12000 });
    const active = concurrent.find((x) => x.status === 201).data;
    const statusUpdate = await call("/bookings/" + active._id, "PUT", {
      ...booking,
      room: room2._id,
      status: "Checked In",
    });
    assert.equal(statusUpdate.data.totalPrice, 30000);
    const persisted = await createStore({ file });
    assert.equal((await persisted.all("rooms")).length, 2);
    assert.equal((await persisted.get("rooms", room2._id)).price, 12000);
    for (const b of (await call("/bookings")).data)
      assert.equal((await call("/bookings/" + b._id, "DELETE")).status, 200);
    assert.equal((await call("/rooms/" + room._id, "DELETE")).status, 200);
    assert.equal((await call("/customers/" + guest._id, "DELETE")).status, 200);
    assert.equal((await call("/bookings/missing")).status, 404);
    assert.equal((await call("/unknown")).status, 404);
  } finally {
    await new Promise((r) => server.close(r));
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'haven-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});

