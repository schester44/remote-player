import axios from "axios";
import qs from "query-string";
import config from "../config";
import { buildTemplate } from "./template";
import { toInt } from "../utils/normalize";

export function buildSlide(items) {
  const slide = {
    type: "slide",
    id: items[3],
    delay: items[2],
    name: items[4],
    width: toInt(items[5], 1920),
    height: toInt(items[6], 1080),
    iframe: items[7],
    activeStart: items[42],
    activeEnd: items[43],
    transition: items[52],

    // todo: what is video type for
    videoType: items[54],
    campaignID: items[63],
    campaign: items[64],
    universalTextField: items[87],
    universalMediaSlot: items[85],
    fullScreenVideo: items[86],
  };

  if (items[53] === "0" && items[55]) {
    const fileName = items[55].replace(".mpg", ".lh264");

    const src = `${config.baseUrl}/__--IW-media/${fileName}`;
    const poster = `${config.baseUrl}/__--IW-media/${items[55].replace(
      ".mpg",
      ".jpg"
    )}`;

    slide.movie = {
      src,
      poster,
      x: toInt(items[57]),
      y: toInt(items[58]),
      z: toInt(items[62]),
      width: toInt(items[60]),
      height: toInt(items[59]),
      opacity: items[61] === "" ? 100 : parseFloat(items[61]),
    };
  }

  if (items[69] === "0" && (items[68] || items[67])) {
    slide.ticker = {
      type: items[66],
      feedUrl: items[67],
      text: items[68],
      textColor: items[70],
      bgColor: items[71],
      fontSize: items[75] || 26,
      speed: items[76],
      x: toInt(items[72]),
      y: toInt(items[73]),
      z: toInt(items[81]),
      width: toInt(items[74]),
    };
  }

  return slide;
}

export const getSlideByChannelVersion = async ({ channel, index }) => {
  const data = qs.stringify({
    channelReference: channel.ref,
    versionID: channel.version,
    slideIndex: index,
  });

  const response = await axios
    .post(`${config.apiEndpoint}/scs:RPC.wdGetCCHD`, data, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    .then(({ data }) => data);

  const slideDetails = response.split("\r");

  return {
    index,
    slide: buildSlide(slideDetails[0].split("	")),
    // Split by TAB
    template: buildTemplate(slideDetails[1].split("	")),
    channel,
  };
};
