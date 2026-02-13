// brown.js
// Input:  ./images/*
// Output: ./images_brown/* (png)
// Background: #EDCC9F (remove.bg requires HEX without '#')
// ✅ Skips images already processed (if output png exists)
// ✅ Updates/creates brown_mapping.json every run

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const API_KEY = process.env.REMOVE_BG_API_KEY;
if (!API_KEY) {
  console.error("❌ Missing REMOVE_BG_API_KEY in .env (same folder as brown.js)");
  process.exit(1);
}

const SRC_DIR = path.join(__dirname, "images");
const OUT_DIR = path.join(__dirname, "images_brown");
const MAP_FILE = path.join(__dirname, "brown_mapping.json");

// ✅ Your preferred background color
const BG_HEX = "EDCC9F"; // #EDCC9F without '#'

const ALLOWED = new Set([".png", ".jpg", ".jpeg", ".webp"]);

// Load existing mapping so it doesn't get wiped each run
function loadExistingMapping() {
  try {
    const data = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Save mapping (dedupe by "from")
function saveMapping(list) {
  const map = new Map();
  for (const item of list) {
    if (item?.from && item?.to) map.set(item.from, item.to);
  }
  const merged = [...map.entries()].map(([from, to]) => ({ from, to }));
  fs.writeFileSync(MAP_FILE, JSON.stringify(merged, null, 2));
}

async function removeBgToColor(inputPath, outputPath) {
  const form = new FormData();
  form.append("image_file", fs.createReadStream(inputPath));
  form.append("bg_color", BG_HEX);
  form.append("size", "auto");   // "hd" uses more credits
  form.append("format", "png");  // force png output

  const res = await axios.post("https://api.remove.bg/v1.0/removebg", form, {
    headers: { ...form.getHeaders(), "X-Api-Key": API_KEY },
    responseType: "arraybuffer",
    validateStatus: () => true,
  });

  if (res.status !== 200) {
    const msg = Buffer.from(res.data).toString("utf8");
    throw new Error(`remove.bg failed (${res.status}): ${msg}`);
  }

  fs.writeFileSync(outputPath, res.data);
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ Source folder not found: ${SRC_DIR}`);
    console.error(`✅ Create a folder named "images" in your project root.`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => ALLOWED.has(path.extname(f).toLowerCase()));

  if (!files.length) {
    console.log("⚠️ No images found in ./images (png/jpg/jpeg/webp only).");
    return;
  }

  console.log(`✅ Found ${files.length} images`);
  console.log(`🎨 Background: #${BG_HEX}`);
  console.log(`📁 Output folder: ${OUT_DIR}\n`);

  const existing = loadExistingMapping();
  const newEntries = [];

  for (const file of files) {
    const inputPath = path.join(SRC_DIR, file);

    // Output always png with same base name
    const base = path.parse(file).name;
    const outFile = base + ".png";
    const outputPath = path.join(OUT_DIR, outFile);

    const fromPath = `images/${file}`;
    const toPath = `images_brown/${outFile}`;

    // ✅ skip if already generated
    if (fs.existsSync(outputPath)) {
      console.log(`Skipping: ${file} (already exists)`);
      newEntries.push({ from: fromPath, to: toPath });
      continue;
    }

    try {
      process.stdout.write(`Processing: ${file} -> ${outFile} ... `);
      await removeBgToColor(inputPath, outputPath);
      console.log("OK");
      newEntries.push({ from: fromPath, to: toPath });
    } catch (err) {
      console.log("FAILED");
      console.error("   " + err.message);
    }
  }

  // Merge + save mapping
  saveMapping([...existing, ...newEntries]);

  console.log("\n✅ Done.");
  console.log("🧾 Mapping updated: brown_mapping.json");
  console.log("➡️ Add new images to ./images then run: node brown.js");
}

main();
