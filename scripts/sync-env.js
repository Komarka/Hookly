const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const outputPath = path.join(rootDir, "env.js");

function parseEnv(source) {
  const result = {};
  const lines = String(source || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

const envSource = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const env = parseEnv(envSource);

const fileContents = `window.HooklyEnv = {
  GROQ_API_KEY: ${JSON.stringify(env.GROQ_API_KEY || "")}
};
`;

fs.writeFileSync(outputPath, fileContents, "utf8");

console.log(`Wrote env.js from ${fs.existsSync(envPath) ? ".env" : "empty defaults"}.`);
