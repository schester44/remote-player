import h from "hyperscript";
import Debug from "debug";
import { scaleWidth, scaleHeight, scaleX, scaleY } from "../utils/normalize";

const debug = Debug("app:create:createTouchPoint");

export const createTouchPoint = ({
  touchpoint,
  slideWidth,
  slideHeight,
  webDeviceWidth,
  webDeviceHeight,
}) => {
  const $elem = h("div.touchpoint", {
    onclick: () => {
      window.open(touchpoint.action);
    },
    style: {
      background: window._RP_DEBUG_ENABLED
        ? "rgba(255, 0, 0, 0.5)"
        : "transparent",
      cursor: "pointer",
      position: "absolute",
      width: `${scaleWidth(touchpoint.width, slideWidth, webDeviceWidth)}px`,
      height: `${scaleHeight(
        touchpoint.height,
        slideHeight,
        webDeviceHeight
      )}px`,

      top: `${scaleY(touchpoint.y, slideHeight, webDeviceHeight)}px`,
      left: `${scaleX(touchpoint.x, slideWidth, webDeviceWidth)}px`,
      "z-index": `${touchpoint.z}`,
    },
  });

  return $elem;
};
