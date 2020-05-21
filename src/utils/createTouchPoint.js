import h from "hyperscript";
import { scaleWidth, scaleHeight, scaleX, scaleY } from "../utils/normalize";
import { emitter } from "../emitter";

export const createTouchPoint = ({
  touchpoint,
  slideWidth,
  slideHeight,
  webDeviceWidth,
  webDeviceHeight,
}) => {
  const $elem = h("div.touchpoint", {
    onclick: () => {
      switch (touchpoint.type) {
        case "T":
          window.location.href = touchpoint.action;
          break;
        case "U":
          window.open(touchpoint.action);
          break;
        case "S":
          emitter.emit("slide:play", { id: touchpoint.action });
          break;
        default:
          break;
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
