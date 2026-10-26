import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import Room from "./models/Room.js";
import Customer from "./models/Customer.js";
import Booking from "./models/Booking.js";
const models = { rooms: Room, customers: Customer, bookings: Booking };
export async function createStore({
  uri,
  file = path.resolve("data/hotel.json"),
} = {}) {
  if (uri) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    return {
      all: async (k) => models[k].find().sort({ createdAt: -1 }).lean(),
      get: async (k, id) =>
        mongoose.isValidObjectId(id) ? models[k].findById(id).lean() : null,
      save: async (k, x) => {
        const { id, ...value } = x;
        void id;
        return models[k]
          .findByIdAndUpdate(x._id, value, {
            new: true,
            upsert: true,
            runValidators: true,
          })
          .lean();
      },
      remove: async (k, id) => models[k].findByIdAndDelete(id),
    };
  }
  let state = { rooms: [], customers: [], bookings: [] };
  try {
    state = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  async function persist(next) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file + ".tmp", JSON.stringify(next, null, 2));
    await rename(file + ".tmp", file);
    state = next;
  }
  return {
    all: async (k) =>
      structuredClone(state[k]).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    get: async (k, id) =>
      structuredClone(state[k].find((x) => x._id === id) || null),
    save: async (k, x) => {
      const next = structuredClone(state);
      const i = next[k].findIndex((v) => v._id === x._id);
      if (i < 0) next[k].push(x);
      else next[k][i] = x;
      await persist(next);
      return structuredClone(x);
    },
    remove: async (k, id) => {
      const next = structuredClone(state);
      next[k] = next[k].filter((x) => x._id !== id);
      await persist(next);
    },
  };
}
