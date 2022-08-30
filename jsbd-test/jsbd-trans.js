const fs = require("fs");

const code = fs.readFileSync("./jsbd-test/jsbd-code.js", { encoding: "utf-8" });

const file = require("@babel/core").transform(code, {
  plugins: ["@babel/plugin-syntax-decimal", "./jsbd-test/jsbd-plugins.js"],
});

console.log(file.code);
