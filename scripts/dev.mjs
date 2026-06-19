import { spawn } from "node:child_process";
import { resolve } from "node:path";

const rootDir = process.cwd();
const viteBin = resolve(rootDir, "node_modules", "vite", "bin", "vite.js");
const backendScript = resolve(rootDir, "scripts", "dev-server.mjs");

const children = [];
let shuttingDown = false;

function startProcess(label, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (label === "backend" && !signal && code === 0) {
      console.log("Backend already available; keeping Vite dev server running.");
      return;
    }

    if (signal || code) {
      console.log(`${label} exited${signal ? ` with signal ${signal}` : ` with code ${code}`}.`);
    }

    shutdown(code ?? 0);
  });

  children.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  while (children.length > 0) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting Dead Reckoning backend at http://127.0.0.1:8787");
startProcess("backend", process.execPath, [backendScript]);

console.log("Starting Vite dev server with hot reload at http://127.0.0.1:5173");
startProcess("vite", process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "5173"]);
