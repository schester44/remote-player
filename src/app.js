import qs from "query-string";
import { getChannelByDevice } from "./models/channel";

import WebDevice from "./WebDevice";

import "./styles/index.css";

const {
  t: transition,
  p: playbackType,
  s: defaultDuration,
  d: deviceId,
  r: isRefreshEnabled,
} = qs.parse(document.location.search);

const wd = new WebDevice({
  transition,
  playbackType,
  defaultDuration,
  isRefreshEnabled: isRefreshEnabled === "1",
});

if (!deviceId) {
  wd.showError("The URL you entered is invalid. It is missing a device ID.");
} else {
  getChannelByDevice(deviceId)
    .then((channel) => wd.play(channel))
    .catch((e) => wd.showError(e.message));
}
