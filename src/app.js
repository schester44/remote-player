import qs from "query-string";
import Debug from "debug";
import { getChannelByDevice } from "./models/channel";
import { getSyncAux } from "./models/syncAux";
import { getUserStyles } from "./utils/styles";
import { updatePageTitle } from "./utils";

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
    Promise.all([getChannelByDevice(deviceId), getSyncAux()])
      .then(([channel, touchpointsBySlide]) =>
        wd.play({ channel, touchpointsBySlide })
      )
      .catch((e) => wd.showError(e.message));
  }
}
