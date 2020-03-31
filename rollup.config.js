import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import json from "@rollup/plugin-json";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src/app.js",
  output: {
    file: "public/bundle.js",
    format: "iife", // immediately-invoked function expression — suitable for <script> tags
    sourcemap: true
  },
  plugins: [
    postcss({
      plugins: [autoprefixer()]
    }),
    json(),
    resolve({
      browser: true
    }), // tells Rollup how to find date-fns in node_modules
    commonjs({
      include: "node_modules/**"
    }), // converts date-fns to ES modules
    production && terser() // minify, but only in production
  ]
};
