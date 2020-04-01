require("dotenv").config();

import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import json from "@rollup/plugin-json";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";
import svg from "rollup-plugin-svg";
import injectProcessEnv from "rollup-plugin-inject-process-env";

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

const devEnvVariables = {
  ACCOUNT: "industryweapon",
  API_ENDPOINT: "http://localhost:3000",
  BASE_URL: "https://industryweapon-iwiwws01.iwhd.us"
};

const prodEnvVariables = {
  ACCOUNT:
    '<$CALLEXTERNAL module="readfile" parameters="account" var=text><$PRINT value=text>',
  API_ENDPOINT: "",
  BASE_URL: ""
};

export default {
  input: "src/app.js",
  output: {
    file: "public/bundle.js",
    format: "iife", // immediately-invoked function expression — suitable for <script> tags
    sourcemap: true
  },
  plugins: [
    svg({ base64: true }),
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
    injectProcessEnv(production ? prodEnvVariables : devEnvVariables),
    production && terser() // minify, but only in production
  ]
};
