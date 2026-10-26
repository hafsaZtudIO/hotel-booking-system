import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createStore } from "./store.js";
import { createApp } from "./app.js";
const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(directory, ".env"), quiet: true });
try {
  const uri =
    process.env.DB_MODE === "file" ? undefined : process.env.MONGODB_URI;
  const store = await createStore({
    uri,
    file: process.env.DATA_FILE || path.join(directory, "data/hotel.json"),
  });
  const port = process.env.PORT || 5000;
  createApp(store).listen(port, () =>
    console.log(
      `Haven Hotel running at http://localhost:${port} (${uri ? "MongoDB" : "local file storage"})`,
    ),
  );
} catch (error) {
  console.error("Unable to start the hotel server:", error.message);
  process.exit(1);
}
