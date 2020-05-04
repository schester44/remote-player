import qs from "query-string";
import { getChannelByDevice } from "./models/channel";
import Debug from "debug";
import WebDevice from "./WebDevice";

import "./styles/index.css";

const debug = Debug("app");

const {
  t: transition,
  p: playbackType,
  s: defaultDuration,
  d: deviceId,
  r: isRefreshEnabled,
} = qs.parse(document.location.search);

const $root = document.getElementById("root");

const wd = new WebDevice({
  transition,
  playbackType,
  defaultDuration,
  isRefreshEnabled: isRefreshEnabled === "1",
});

const url =
  window.location != window.parent.location
    ? document.referrer
    : document.location.href;

debug("url", url, window.location, document.location.href, document.referrer);

const validHost =
  url === document.location.href ||
  url.indexOf("https://cchdrsrc.channelshd.com") === 0;

if (process.env.NODE_ENV !== "development" && !validHost) {
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
