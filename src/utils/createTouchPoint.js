import h from "hyperscript";
import { scaleWidth, scaleHeight, scaleX, scaleY } from "../utils/normalize";

export const createTouchPoint = ({
  touchpoint,
  slideWidth,
  slideHeight,
  webDeviceWidth,
  webDeviceHeight,
}) => {
  const $elem = h("div.touchpoint", {
    onclick: () => {
      // T = "target url" -- which has no real meaning other than we want the URL to open in the iframe instead of a new window
      if (touchpoint.type === "T") {
        window.location.href = touchpoint.action;
      } else {
        // This should be an action type of "U" which means URL.. which means open in a new window
        window.open(touchpoint.action);
      }
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
      "z-index": "30",
    },
  });

  return $elem;
};
