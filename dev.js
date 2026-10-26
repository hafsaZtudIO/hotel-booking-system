import { spawn } from "node:child_process";
const processes = [
  spawn(process.execPath, ["--watch", "backend/server.js"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { cwd: "frontend", stdio: "inherit" },
  ),
];
// Run the backend and frontend together; close both when either exits.
processes[1].on("error", console.error);
for (const child of processes)
  child.on("exit", (code) => {
    for (const other of processes) if (other !== child) other.kill();
    process.exit(code || 0);
  });
process.on("SIGINT", () => {
  for (const child of processes) child.kill();
  process.exit();
});
