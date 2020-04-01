import h from "hyperscript";
import Debug from "debug";

const debug = Debug("app:createMovie");
import playIcon from "../icons/play-circle.svg";

import { scaleX, scaleY, scaleWidth, scaleHeight } from "./normalize";

export const createMovie = ({
  movie,
  slideWidth,
  slideHeight,
  webDeviceWidth,
  webDeviceHeight
}) => {
  debug("creating video with src", movie.src);

  const overlay = h("img", {
    src: playIcon,
    style: {
      display: "none",
      position: "absolute",
      width: "40px",
      height: "40px",
      "pointer-events": "none"
    }
  });

  const video = h("video.video", {
    muted: true,
    autoplay: false,
    controls: true,
    controlsList: "nofullscreen nodownload noremoteplayback",
    loop: true,
    src: movie.src,
    poster: movie.poster,
    oncanplay: ({ target: video }) => {
      video.style.cursor = "pointer";

      if (video.paused) {
        overlay.style.display = "block";
      }
    },
    onclick: ({ target: video }) => {
      if (video.paused) {
        overlay.style.display = "none";
      } else {
        overlay.style.display = "block";
      }
      video.paused ? video.play() : video.pause();
    },
    style: {
      width: `${scaleWidth(movie.width, slideWidth, webDeviceWidth)}px`,
      height: `${scaleHeight(movie.height, slideHeight, webDeviceHeight)}px`
    }
  });

  return h(
    "div",
    {
      style: {
        background: "black",
        position: "absolute",
        top: `${scaleY(movie.y, slideHeight, webDeviceHeight)}px`,
        left: `${scaleX(movie.x, slideWidth, webDeviceWidth)}px`,
        width: `${scaleWidth(movie.width, slideWidth, webDeviceWidth)}px`,
        height: `${scaleHeight(movie.height, slideHeight, webDeviceHeight)}px`,
        display: "flex",
        "align-items": "center",
        "justify-content": "center"
      }
    },
    [overlay, video]
  );
};
