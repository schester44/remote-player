import h from "hyperscript";
import Debug from "debug";

const debug = Debug("app:create:createTicker");

import {
  scaleX,
  scaleY,
  scaleText,
  scaleHeight,
  scaleWidth
} from "./normalize";

export const createTicker = async ({
  ticker,
  slideWidth,
  slideHeight,
  webDeviceWidth,
  webDeviceHeight
}) => {
  debug("ticker", {
    ticker,
    slideWidth,
    slideHeight,
    webDeviceWidth,
    webDeviceHeight
  });

  const width = scaleWidth(ticker.width, slideWidth, webDeviceWidth);
  const duration = width / (ticker.speed * 4);

  const $tickerText = h(
    "div.ticker",
    {
      style: {
        "animation-duration": `${duration}s`
      }
    },
    ticker.text
  );

  const style = {
    position: "absolute",
    overflow: "hidden",
    background:
      ticker.bgColor.length > 0 ? `#${ticker.bgColor}` : "transparent",
    color: `#${ticker.textColor || '000'}`,
    left: `${scaleX(ticker.x, slideWidth, webDeviceWidth)}px`,
    top: `${scaleY(ticker.y, slideHeight, webDeviceHeight)}px`,
    width: `${width}px`,
    "z-index": `${ticker.z || 6}`,
    "font-size": `${scaleText(ticker.fontSize, slideHeight, webDeviceHeight)}px`
  };

  return h("div.rss", { style }, $tickerText);
};
