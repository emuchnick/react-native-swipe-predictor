#!/usr/bin/env node
/* eslint-disable  */
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to remove from lib
const dirsToRemove = ["rust", "benchmarks"];

// Function to remove directory recursively
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Removed: ${dirPath}`);
  }
}

// Remove unwanted directories from each target
const targets = ["commonjs", "module", "typescript"];

targets.forEach((target) => {
  dirsToRemove.forEach((dir) => {
    const dirPath = path.join(__dirname, "..", "lib", target, dir);
    removeDir(dirPath);
  });
});

console.log("Post-build cleanup completed");
