const fs = require("fs");

fs.readFileSync("./code.js", { encoding: "utf-8" });

require("@babel/core").transform(code, {
  plugins: ["transform-jsbi-to-bigint"],
});
