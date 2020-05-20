import qs from "query-string";
import Debug from "debug";
import { getChannelByDevice } from "./models/channel";
import { getSyncAux } from "./models/syncAux";
import { getUserStyles } from "./utils/styles";
import { updatePageTitle } from "./utils";
import h from "hyperscript";

import WebDevice from "./WebDevice";
import Logger from "./Logger";

import "./styles/index.css";

const {
  t: transition,
  p: playbackType,
  s: defaultDuration,
  d: deviceId,
  r: isRefreshEnabled,
  pos: playerPosition,
  border: playerBorder,
  ga: googleAnalyticsId,
  name: deviceName,
  debug: debugEnabled,
} = qs.parse(document.location.search);

const debug = Debug("app:setup");

if (debugEnabled === "true") {
  window._RP_DEBUG_ENABLED = true;
  localStorage.setItem("debug", "app*");

  debug("DEBUG ENABLED");
}

debug("player position", playerPosition);
debug("player border", playerBorder);

let userStyles = getUserStyles({ playerPosition, playerBorder });

const logger = new Logger({ googleAnalyticsId });

if (deviceName) {
  updatePageTitle(deviceName);
}

const wd = new WebDevice({
  transition,
  playbackType,
  defaultDuration,
  userStyles,
  logger,
  isRefreshEnabled: isRefreshEnabled === "1",
  isResponsive: !!process.env.IS_RESPONSIVE || !!process.env.IS_TEAMS,
});

const url =
  window.location != window.parent.location
    ? document.referrer
    : document.location.href;

const validHost =
  url === document.location.href ||
  url.indexOf("https://cchdrsrc.channelshd.com") === 0;

if (
  process.env.IS_TEAMS &&
  process.env.NODE_ENV !== "development" &&
  !validHost
) {
  wd.showError("Industry Weapon");
} else {
  if (!deviceId) {
    wd.showError("The URL you entered is invalid. It is missing a device ID.");
  } else {
    const $root = document.getElementById("root");

    const tryPlayingChannel = async () => {
      Promise.all([getChannelByDevice(deviceId), getSyncAux()])
        .then(([channel, touchpoints]) => {
          $root.classList.remove("app-loaded");

          const $error = document.getElementById("error");

          if ($error) {
            $root.removeChild($error);
          }

          wd.play({ channel, touchpoints });
        })
        .catch((e) => {
          waitThenTryAgain();
        });
    };

    const waitThenTryAgain = () => {
      let count = 30;

      const $error = document.getElementById("error");

      if ($error) {
        $root.removeChild($error);
      }

      const updateMsg = h(
        "p",
        { style: { margin: "8px 0" } },
        `Checking status again in ${count} seconds`
      );

      $root.classList.add("app-loaded");

      $root.appendChild(
        h(
          "div#error",
          {
            style: {
              "font-family": "sans-serif",
              height: "100vh",
              width: "100vw",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              "flex-direction": "column",
            },
          },
          [
            h("h1.msg", "This player is still processing"),
            updateMsg,
            h(
              "p",
              {
                style: {
                  "font-size": "12px",
                  color: "rgba(140, 140, 140, 1)",
                },
              },
              "This process can take up to 30 minutes. Please check back later."
            ),
          ]
        )
      );

      let timer = setInterval(() => {
        updateMsg.innerText = `Checking status again in ${count} ${
          count === 1 ? "second" : "seconds"
        }`;

        if (count <= 0) {
          window.clearInterval(timer);

          tryPlayingChannel();
        }

        count--;
      }, 1000);
    };

    tryPlayingChannel();
  }
}
