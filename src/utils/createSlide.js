import h from "hyperscript";
import Debug from "debug";

import { createMovie } from "./createMovie";
import { createTicker } from "./createTicker";
import config from "../config";

const debug = Debug("app:createSlide");

export const createSlide = async ({
  index,
  slide: { slide, template },
  channel
}) => {
  // TODO: Replace this url with a placeholder or something.. this is for the industryweapon account.
  const src = `${config.baseUrl}/scs:RPC.wdGetSlide,${channel.ref},${channel.version},${index}`;

  const dom = h(
    `div#slide-${index}.slide`,
    {
      style: {
        position: "relative",
        width: `${channel.width}px`,
        height: `${channel.height}px`
      }
    },
    h(`img#slide-${index}`, {
      style: {
        width: `${channel.width}px`,
        height: `${channel.height}px`
      },
      src
    })
  );

  if (template.ticker || slide.ticker) {
    dom.appendChild(
      await createTicker({
        ticker: slide.ticker,
        slideWidth: slide.width,
        slideHeight: slide.height,
        webDeviceWidth: channel.width,
        webDeviceHeight: channel.height
      })
    );
  }

  if (slide.movie) {
    // Add Video
    debug("adding video to slide", index);

    dom.appendChild(
      createMovie({
        movie: slide.movie,
        slideWidth: slide.width,
        slideHeight: slide.height,
        webDeviceWidth: channel.width,
        webDeviceHeight: channel.height
      })
    );
  }

  return dom;
};
