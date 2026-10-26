import { createStore } from "./store.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
const directory = path.dirname(fileURLToPath(import.meta.url));
const store = await createStore({
  file: process.env.DATA_FILE || path.join(directory, "data/hotel.json"),
});
if (
  (await store.all("rooms")).length ||
  (await store.all("customers")).length ||
  (await store.all("bookings")).length
)
  throw new Error(
    "Seed stopped: local storage must be empty. Existing records are never overwritten.",
  );
const now = new Date();
const day = (offset) =>
  new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset),
  ).toISOString();
const timestamp = now.toISOString();
const roomIds = Array.from(
  { length: 8 },
  (_, i) => "00000000000000000000010" + i,
);
const guestIds = Array.from(
  { length: 5 },
  (_, i) => "00000000000000000000020" + i,
);
for (let i = 0; i < 8; i++)
  await store.save("rooms", {
    _id: roomIds[i],
    roomNumber: String(101 + i),
    roomType: ["Standard", "Deluxe", "Suite", "Family"][i % 4],
    price: [6500, 8500, 14000, 11000][i % 4],
    capacity: [2, 2, 2, 4][i % 4],
    status: "Available",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
for (const [i, name] of [
  "Amina Hassan",
  "Daniel Otieno",
  "Grace Mwangi",
  "Omar Ali",
  "Sophie Taylor",
].entries())
  await store.save("customers", {
    _id: guestIds[i],
    name,
    email: `guest${i + 1}@example.com`,
    phone: `+25470000000${i}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
for (let i = 0; i < 5; i++)
  await store.save("bookings", {
    _id: "00000000000000000000030" + i,
    room: roomIds[i],
    customer: guestIds[i],
    checkIn: day(i < 3 ? -1 : i),
    checkOut: day(i < 3 ? 2 : i + 3),
    totalPrice: 3 * [6500, 8500, 14000, 11000, 6500][i],
    status: i < 3 ? "Checked In" : "Booked",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
console.log(
  "Fictional demo data added to local file storage. MongoDB was not changed.",
);
