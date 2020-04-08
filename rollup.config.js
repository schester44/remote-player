require("dotenv").config();

import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import json from "@rollup/plugin-json";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";
import svg from "rollup-plugin-svg";
import babel from "rollup-plugin-babel";
import replace from "@rollup/plugin-replace";

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

const devEnvVariables = {
  ACCOUNT: process.env.ACCOUNT,
  API_ENDPOINT: process.env.API_ENDPOINT,
  BASE_URL: process.env.BASE_URL
};

const prodEnvVariables = {
  ACCOUNT:
    '<$CALLEXTERNAL module="readfile" parameters="account" var=text><$PRINT value=text>',
  API_ENDPOINT: "",
  BASE_URL: ""
};

const envKeys = () => {
  const envRaw = production ? prodEnvVariables : devEnvVariables;

  return Object.keys(envRaw).reduce(
    (envValues, envValue) => ({
      ...envValues,
      [`process.env.${envValue}`]: JSON.stringify(envRaw[envValue])
    }),
    {}
  );
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
    replace(envKeys()),
    babel({
      exclude: [/\/core-js\//],
      babelrc: false,
      presets: [
        [
          "@babel/preset-env",
          {
            corejs: 3,
            modules: false,
            useBuiltIns: "usage",
            targets: {
              ie: "11"
            }
          }
        ]
      ]
    }),
    production && terser() // minify, but only in production
  ]
};
