require("dotenv").config({
  path: "../.env",
});

const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");

const cors = require("cors");
const app = express();
const port = 3000;

const MEDIABRIDGE = process.env.BASE_URL;

app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: /localhost/,
  })
);

function getParams(body) {
  let form = "";
  const keys = Object.keys(body);

  keys.forEach((key, index) => {
    form += `${key}=${encodeURIComponent(body[key])}${
      index !== keys.length - 1 ? "&" : ""
    }`;
  });

  return form;
}

app.get("*", async (req, res) => {
  const { url: endpoint, query } = req;

  try {
    let url = `${MEDIABRIDGE}${endpoint}?${getParams(query)}`;

    const data = await axios.get(url).then(({ data }) => data);

    res.send(data);
  } catch (e) {
    res.send(e);
  }
});

app.post("*", async (req, res) => {
  const { url: endpoint, query, body } = req;

  let form = getParams(body);

  const params = getParams(query);

  let url = `${MEDIABRIDGE}${endpoint}${params.length > 0 ? `?${params}` : ""}`;

  try {
    const data = await axios.post(url, form).then(({ data }) => data);

    res.send(data);
  } catch (e) {
    res.send(e);
  }
});

app.listen(port, () => console.log(`app listening on port ${port}!`));
