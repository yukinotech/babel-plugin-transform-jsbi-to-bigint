const fs = require("fs");

const code = fs.readFileSync("./code.js", { encoding: "utf-8" });

const file = require("@babel/core").transform(code, {
  plugins: ['./src/index.js'],
});

console.log(file.code)