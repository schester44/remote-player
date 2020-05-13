import h from "hyperscript";
import Debug from "debug";

import playIcon from "../icons/play-circle.svg";
import { emitter } from "../emitter";

import { scaleX, scaleY, scaleWidth, scaleHeight } from "./normalize";

const debug = Debug("app:create:createMovie");

export const createMovie = ({
  movie,
  slideWidth,
  slideHeight,
  webDeviceWidth,
  webDeviceHeight,
}) => {
  debug("creating video with src", movie.src);

  const overlay = h("img.video-playicon", {
    src: playIcon,
  });

  const loader = h("div.loader");

  const video = h("video.video", {
    autoplay: false,
    src: movie.src,
    controls: false,
    poster: movie.poster,
    onpause: () => {
      debug("video:paused");

      emitter.emit("video:paused", { element: video });
      overlay.style.display = "block";
    },
    onloadstart: ({ target: video }) => {
      video.parentNode.appendChild(loader);

      debug("video onLoadStart");
      emitter.emit("video:loading");
    },
    onended: ({ target: video }) => {
      // resets the video and shows the poster.
      video.load();
      debug("video onEnded");

      if (loader.parentNode === video.parentNode) {
        video.parentNode.removeChild(loader);
      }

      emitter.emit("video:ended");
    },
    oncanplay: ({ target: video }) => {
      debug("video onCanPlay");
      emitter.emit("video:playable");

      if (video.paused) {
        if (loader.parentNode === video.parentNode) {
          video.parentNode.removeChild(loader);
        }
        video.style.cursor = "pointer";
        overlay.style.display = "block";
      }
    },
    onclick: ({ target: video }) => {
      debug("video state", video.paused, video.readyState);

      if (video.paused) {
        video.play();

        emitter.emit("video:played", {
          element: video,
          duration: video.duration,
        });

        overlay.style.display = "none";
      } else {
        video.pause();
      }
    },
    style: {
      width: `${scaleWidth(movie.width, slideWidth, webDeviceWidth)}px`,
      height: `${scaleHeight(movie.height, slideHeight, webDeviceHeight)}px`,
    },
  });

  // TODO: This could probably be handled better somehow instead of binding a listener for every video
  emitter.on("volume-change", ({ value }) => {
    debug("volume level set to", value / 100);

    video.volume = value / 100;
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
      },
    },
    [overlay, video]
  );
};
