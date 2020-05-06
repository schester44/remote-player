import h from "hyperscript";
import Debug from "debug";

import { createMovie } from "./createMovie";
import { createTicker } from "./createTicker";
import config from "../config";

const debug = Debug("app:createSlide");

export const createSlide = async ({
  // imgIndex is used when there is only 1 slide in the channel.
  // When there is 1 channel, we still create 2 slides so that we can easily transition between them.
  // imgIndex lets us specify 0 for the imgIndex but 1 for the actual slide index ... makes it easier for handling DOM operations while still getting the correct slide stuff
  imgIndex,
  index,
  slide: { slide, template },
  channel,
}) => {
  imgIndex = typeof imgIndex !== "undefined" ? imgIndex : index;

  const src = `${config.baseUrl}/scs:RPC.wdGetSlide,${channel.ref},${channel.version},${imgIndex}`;

  const dom = h(
    `div#slide-${index}.slide`,
    {
      style: {
        position: "relative",
        width: `${channel.width}px`,
        height: `${channel.height}px`,
      },
    },
    h(`img#slide-${index}`, {
      style: {
        width: `${channel.width}px`,
        height: `${channel.height}px`,
      },
      src,
    })
  );

  if (template.ticker || slide.ticker) {
    dom.appendChild(
      await createTicker({
        ticker: slide.ticker,
        slideWidth: slide.width,
        slideHeight: slide.height,
        webDeviceWidth: channel.width,
        webDeviceHeight: channel.height,
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
        webDeviceHeight: channel.height,
      })
    );
  }

  return dom;
};
