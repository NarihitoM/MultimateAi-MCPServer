import esbuild from "esbuild";

const entryPoints = [
  "src/api/sheets.ts",
  "src/api/docs.ts",
  "src/api/notion.ts",
  "src/api/slack.ts",
  "src/api/telegram.ts",
  "src/api/figma.ts",
  "src/api/websearch.ts",
];

await esbuild.build({
  entryPoints,
  bundle: true,
  platform: "node",
  format: "cjs",
  outdir: "api",
  outbase: "src/api",
  packages: "external",
});
