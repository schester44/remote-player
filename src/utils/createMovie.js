import h from "hyperscript";
import Debug from "debug";

const debug = Debug("app:createMovie");

import { scaleX, scaleY, scaleWidth, scaleHeight } from "./normalize";

export const createMovie = ({
  movie,
  slideWidth,
  slideHeight,
  webDeviceWidth,
  webDeviceHeight
}) => {
  debug("creating video with src", movie.src);

  return h("video.video", {
    muted: true,
    autoplay: true,
    controls: false,
    loop: true,
    src: movie.src,
    style: {
      position: "absolute",
      top: `${scaleY(movie.y, slideHeight, webDeviceHeight)}px`,
      left: `${scaleX(movie.x, slideWidth, webDeviceWidth)}px`,
      width: `${scaleWidth(movie.width, slideWidth, webDeviceWidth)}px`,
      height: `${scaleHeight(movie.height, slideHeight, webDeviceHeight)}px`
    }
  });
};
