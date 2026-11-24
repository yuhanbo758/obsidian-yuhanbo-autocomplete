const { transformSync } = require("esbuild");

module.exports = {
  process(source, filename) {
    return transformSync(source, {
      loader: filename.endsWith(".tsx") ? "tsx" : "ts",
      format: "cjs",
      sourcefile: filename,
      sourcemap: "inline",
      target: "node24",
    });
  },
};
