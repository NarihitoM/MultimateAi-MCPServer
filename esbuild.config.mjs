import esbuild from "esbuild";

const entryPoints = [
  "api/sheets.ts",
  "api/docs.ts",
  "api/notion.ts",
  "api/slack.ts",
  "api/telegram.ts",
  "api/figma.ts",
  "api/websearch.ts",
];

await esbuild.build({
  entryPoints,
  bundle: true,
  platform: "node",
  format: "cjs",
  outdir: "dist/api",
  outbase: "api",
  packages: "external",
});
