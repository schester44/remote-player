import qs from "query-string";
import { getChannelByDevice } from "./models/channel";
import Debug from "debug";
import WebDevice from "./WebDevice";
import Logger from "./Logger";
import { updatePageTitle } from "./utils";
import { getUserStyles } from "./utils/styles";

import "./styles/index.css";

const debug = Debug("app");

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
} = qs.parse(document.location.search);

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
    getChannelByDevice(deviceId)
      .then((channel) => wd.play(channel))
      .catch((e) => wd.showError(e.message));
  }
}
