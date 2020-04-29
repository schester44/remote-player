import axios from "axios";
import config from "../config";

export const getChannelByDevice = async (deviceId) => {
  const response = await axios
    .post(
      `${config.apiEndpoint}/scs:RPC.wdGetCurrentChannel`,
      `devid=${deviceId}`
    )
    .then(({ data }) => data);

  if (response.indexOf("ERR: unknown device") > -1) {
    throw new Error("The device is not configured correctly.");
  }

  if (response.indexOf("ERR:") > -1) {
    const [, error] = response.split("ERR:");

    throw new Error(error);
  }

  const channelInfo = response.split(" ");

  if (!channelInfo || !channelInfo[4]) {
    throw new Error("Missing channel info");
  }

  const [width, height] = channelInfo[4].split("-");

  const channel = {
    ref: channelInfo[0],
    width: parseFloat(width),
    height: parseFloat(height),
    version: channelInfo[1],
    slideDelays: channelInfo[3].split(","),
    slideCount: parseInt(channelInfo[2]) + 1,
  };

  return channel;
};
