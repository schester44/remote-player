import h from "hyperscript";

import { getSlideByChannelVersion } from "./models/slide";
import Debug from "debug";
import rafscroll from "@braid/rafscroll";
import { createSlide } from "./utils/createSlide";

import refreshIcon from "./icons/refresh.svg";
import pauseIcon from "./icons/pause-circle.svg";
import volume2Icon from "./icons/volume-2.svg";
import volume1Icon from "./icons/volume-1.svg";
import volumeIcon from "./icons/volume.svg";

import prevIcon from "./icons/skip-back.svg";
import nextIcon from "./icons/skip-forward.svg";
import playIcon from "./icons/play-circle.svg";
import { emitter } from "./emitter";
import { nowInMS, getLastIndex } from "./utils";

const debug = Debug("app");

export default class WebDevice {
  constructor({
    transition,
    playbackType,
    defaultDuration,
    isRefreshEnabled,
    isResponsive,
    root,
  }) {
    this.channels = {};
    this.slidesByChannel = {};
    this.currentSlideIndex = 0;
    this.activeChannel = undefined;

    // Slide transition keeps track of when the timer was first initialized. Using it, plus a combination of this.slideDuration, we're able to determine how much time is left before the slide paginates.
    this.slideTransitionTime = undefined;
    this.slideTransitionTimeout = undefined;
    // timeUntilTransition tracks how much time was left until the slide was supposed to transition. This is used when we pause the slide transition such as when a long video is played.
    this.timeUntilTransition = undefined;
    this.loadingVideoCount = 0;
    this.activeVideosPlaying = 0;

    this.isScrolling = false;
    this.isPaused = false;
    this.isLoaded = false;
    this.isVolumeControlsVisible = false;

    this.transition = transition === "v" ? "v" : "h";
    this.slideDuration = defaultDuration || 3;
    this.isRefreshEnabled = !!isRefreshEnabled;
    this.isResponsive = !!isResponsive;

    // Original value, do not change
    this._slideDuration = defaultDuration;

    this.playbackType = playbackType === "0" ? "auto" : "click";

    debug("transition type", this.playbackType);

    if (isNaN(this.slideDuration) || parseInt(this.slideDuration) < 3) {
      this.slideDuration = 3;
    }

    this.slideDuration = parseInt(this.slideDuration, 10);

    this.$root = root || document.getElementById("root");

    this.$player = h("div#player");

    this.$root.appendChild(this.$player);
    this.scroller = rafscroll(this.$player);

    if (this.transition === "h") {
      this.$root.classList.add("horizontal-transition");
    }

    this.registerEventHandlers();

    debug("player element added to root");
  }

  registerEventHandlers() {
    // Close the volume slider on outside click
    document.addEventListener("click", (e) => {
      if (!this.isVolumeControlsVisible) return;
      if (this.volumeControl.contains(e.target)) return;

      this.volumeControl.classList.remove("open");
    });

    emitter.on("video:loading", () => {
      this.loadingVideoCount++;

      this.stopPaginationTimer();
    });

    // Start the timer if all videos have been loaded or put into an error state
    emitter.on("video:error", () => {
      if (this.loadingVideoCount <= 0) return;
      this.loadingVideoCount--;

      if (this.loadingVideoCount === 0 && !this.isPaused) {
        this.startPaginationTimer({ duration: this.slideDuration * 1000 });
      }
    });

    // When a video is playable, if all videos have loaded then start the timer
    emitter.on("video:playable", () => {
      this.loadingVideoCount--;

      if (this.loadingVideoCount <= 0 && !this.isPaused) {
        this.startPaginationTimer({ duration: this.slideDuration * 1000 });
      }
    });
    // Pause slide pagination when a video exceeds the length of the slide duration.
    emitter.on("video:played", ({ duration: videoDuration }) => {
      this.activeVideosPlaying++;

      this.showVolumeButton();

      // Only disable pagination if playbackType is auto.
      if (this.playbackType !== "auto") return;

      // If there's no slideTransitionTime then there _shouldnt_ be a timer.
      // Without a transitionTime, its impossible to compute when the slide will change
      if (!this.slideTransitionTime) return;

      this.timeUntilTransition =
        this.slideDuration * 1000 - (nowInMS() - this.slideTransitionTime);

      debug("video playing, paused slide transition for", videoDuration);

      if (videoDuration * 1000 > this.timeUntilTransition) {
        this.stopPaginationTimer();
      }
    });

    // If a video canceled the slide transition, on pause, we need to re-enable that transition
    emitter.on("video:paused", () => {
      this.activeVideosPlaying--;

      if (!this.timeUntilTransition) return;

      this.startPaginationTimer({ duration: this.timeUntilTransition });
    });

    // When a video finishes playing, if we've previously disabled pagination then we need to enable pagination again.
    emitter.on("video:ended", () => {
      this.activeVideosPlaying--;

      if (this.activeVideosPlaying <= 0) {
        this.hideVolumeButton();
      }

      // if playbackType !== auto then there is no pagination to re-enable. If the user manually paused the slide, then we shouldn't override their action either.
      // if there is no timeUntilTransition then we never paused the transition
      if (
        this.isPaused ||
        this.playbackType !== "auto" ||
        !this.timeUntilTransition
      )
        return;

      // when the video has ended, we're going to paginate immediately so no need to keep this value around
      this.timeUntilTransition = undefined;

      // play the next slide once the video has ended
      this.playNextSlide();
    });
  }

  stopPaginationTimer() {
    this.slideTransitionTime = undefined;
    window.clearTimeout(this.slideTransitionTimeout);
  }

  startPaginationTimer({ duration }) {
    // There isn't a pagination timer when the playback type is "click"
    if (this.playbackType === "click") return;

    debug(`startPaginationTimer`, duration);

    this.stopPaginationTimer();

    this.slideTransitionTime = nowInMS();

    this.slideTransitionTimeout = window.setTimeout(() => {
      debug("slide transitioned");
      this.playNextSlide();
    }, duration);
  }

  createControls() {
    if (this.playbackType === "auto") {
      this.addPauseControl();
    }

    if (this.isRefreshEnabled) {
      this.addRefreshControls();
    }

    this.addVolumeControls();
    this.addPaginationControls();

    debug("controls created");
  }

  addPauseControl() {
    const pauseButton = h(
      "div.bottom-nav-button#pause-btn",
      {
        style: {
          right: "50px",
        },
        onclick: () => {
          this.togglePause();
        },
      },
      h("img#pause-icon", { src: pauseIcon })
    );

    this.$root.appendChild(pauseButton);
  }

  addPaginationControls() {
    const prevPageControl = h(
      "div.control .control-left",
      {
        onclick: () => {
          if (this.isScrolling) return;

          this.stopPaginationTimer();
          this.playPrevSlide();
        },
      },
      h("img.control-icon", { src: prevIcon })
    );

    const nextPageControl = h(
      "div.control .control-right",
      {
        onclick: () => {
          if (this.isScrolling) return;

          this.stopPaginationTimer();
          this.playNextSlide();
        },
      },
      h("img.control-icon", { src: nextIcon })
    );

    this.$root.appendChild(prevPageControl);
    this.$root.appendChild(nextPageControl);
  }

  addVolumeControls() {
    const $volumeIcon = h("img#volume-icon", { src: volume2Icon });

    this.volumeControl = h(
      "div#volume-btn",
      {
        style: {
          right: this.isRefreshEnabled ? "150px" : "100px",
        },
        onclick: ({ target }) => {
          const control = document.getElementById("volume-btn");
          const isOpen = control.classList.contains("open");

          // Only close the slider if we're interacting with the icon.
          // This allows for a bigger button surface area when opening the volume slider.
          if (this.isVolumeControlsVisible && target !== $volumeIcon) {
            return;
          }

          if (isOpen) {
            this.isVolumeControlsVisible = false;
            control.classList.remove("open");
          } else {
            this.isVolumeControlsVisible = true;
            control.classList.add("open");
          }
        },
      },
      [
        h("input#volume-slider", {
          oninput: ({ target: slider }) => {
            const value = parseInt(slider.value, 10);

            if (value > 1 && value <= 50) {
              $volumeIcon.src = volume1Icon;
            }

            if (value === 0) {
              $volumeIcon.src = volumeIcon;
            }

            if (value > 50) {
              $volumeIcon.src = volume2Icon;
            }

            emitter.emit("volume-change", { value });
          },
          type: "range",
          min: 0,
          max: 100,
          value: 100,
        }),
        $volumeIcon,
      ]
    );

    this.$root.appendChild(this.volumeControl);
  }

  addRefreshControls() {
    const refreshButton = h(
      "div.bottom-nav-button#refresh-btn",
      {
        style: {
          right: this.playbackType === "auto" ? "100px" : "50px",
        },
        onclick: () => {
          window.location.reload();
        },
      },
      h("img#refresh-icon", { src: refreshIcon })
    );

    this.$root.appendChild(refreshButton);
  }

  playPrevSlide() {
    const slides = this.slidesByChannel[this.activeChannel];

    if (this.currentSlideIndex === 0) {
      this.currentSlideIndex = slides.length - 1;
    } else {
      this.currentSlideIndex--;
    }

    debug("playPrevSlide", this.currentSlideIndex);
    this.playSlide({ index: this.currentSlideIndex, direction: "prev" });
  }

  playNextSlide() {
    const slides = this.slidesByChannel[this.activeChannel];

    if (this.currentSlideIndex === slides.length - 1) {
      this.currentSlideIndex = 0;
    } else {
      this.currentSlideIndex++;
    }

    debug("playNextSlide", this.currentSlideIndex);

    this.playSlide({ index: this.currentSlideIndex, direction: "next" });
  }

  addActiveSlideToDOM({ firstLoad, direction }) {
    const { dom: $slide, slide } = this.slidesByChannel[this.activeChannel][
      this.currentSlideIndex
    ];

    if (firstLoad || direction === "next") {
      this.$player.appendChild($slide);
    } else {
      this.$player.insertBefore($slide, this.$player.childNodes[0]);

      if (this.transition === "h") {
        // after a successful scrollLeft, we remove the previously active item and set the scrollLeft to 0.
        // So scrollLeft goes from 0 -> campaign width -> 0
        // when we prepend an item to the DOM, this throws things off because we're at 0, prepending an item adds it to the DOM at the 0 pixel, so we need to change the player's scrollLeft to account for the newly prepended item.
        this.$player.scrollLeft = this.channels[this.activeChannel].width;
      } else {
        this.$player.scrollTop = this.channels[this.activeChannel].height;
      }
    }
  }

  setupNextSlideTransition({ firstLoad }) {
    const { slide } = this.slidesByChannel[this.activeChannel][
      this.currentSlideIndex
    ];

    // When _slideDuration === "d", we're wanting to use the pre-configured slide duration/delay (from CCHD).
    // So, we need to change the slideDuration value on every pagination
    if (this._slideDuration === "d" && !isNaN(slide.delay)) {
      this.slideDuration = parseInt(slide.delay) / 1000;

      debug("Overriding slide duration with ", this.slideDuration);
    }

    const duration = firstLoad
      ? (this.slideDuration + 1) * 1000
      : this.slideDuration * 1000;

    this.startPaginationTimer({ duration });
  }

  showVolumeButton() {
    this.volumeControl.classList.add("visible");
    this.volumeControl.classList.remove("hidden");
  }

  hideVolumeButton() {
    this.isVolumeControlsVisible = false;
    // this.volumeControl.classList.remove("visible");
    this.volumeControl.classList.add("hidden");
    this.volumeControl.classList.remove("visible");
    this.volumeControl.classList.remove("open");
  }

  async transitionToSlide({ direction }) {
    switch (this.transition) {
      case "v":
        await this._verticalTransition({ direction });
        break;

      case "h":
      default:
        await this._horizontalTransition({ direction });
        break;
    }
  }

  async _verticalTransition({ direction }) {
    const scrollTop =
      direction === "next"
        ? this.channels[this.activeChannel].height
        : -this.channels[this.activeChannel].height;

    this.isScrolling = true;

    debug("scrolling vertically", scrollTop);

    await this.scroller.scrollTop(scrollTop);

    this.isScrolling = false;

    const removedSibling = this._removeLastSlide({ direction });

    if (removedSibling) {
      this.$player.scrollTop = 0;
    }
  }

  async _horizontalTransition({ direction }) {
    const scrollLeft =
      direction === "next"
        ? this.channels[this.activeChannel].width
        : -this.channels[this.activeChannel].width;

    this.isScrolling = true;

    debug("scrolling horizontally", scrollLeft);

    await this.scroller.scrollLeft(scrollLeft);

    this.isScrolling = false;

    const removedSibling = this._removeLastSlide({ direction });

    if (removedSibling) {
      this.$player.scrollLeft = 0;
    }
  }

  _removeLastSlide({ direction }) {
    const slides = this.slidesByChannel[this.activeChannel];

    const indexToRemove = getLastIndex({
      direction,
      index: this.currentSlideIndex,
      totalSlides: slides.length,
    });

    const siblingToRemove = document.getElementById(`slide-${indexToRemove}`);

    if (siblingToRemove) {
      debug("removing sibling", siblingToRemove);
      this.$player.removeChild(siblingToRemove);

      return true;
    }

    return false;
  }

  togglePause() {
    const icon = document.querySelector("#pause-icon");

    icon.src = this.isPaused ? pauseIcon : playIcon;

    const isPaused = !this.isPaused;

    if (isPaused) {
      this.stopPaginationTimer();
    } else {
      this.playNextSlide({ index: this.currentSlideIndex, direction: "next" });
    }

    this.isPaused = isPaused;
  }

  async playSlide({ index, direction = "next", firstLoad = false }) {
    this.activeVideosPlaying = 0;
    this.hideVolumeButton();

    // Player was paused but the user clicked one of the navigation buttons
    if (this.isPaused) {
      const icon = document.querySelector("#pause-icon");

      icon.src = pauseIcon;
      this.isPaused = false;
    }

    debug("playSlide", index, direction, firstLoad);

    this.addActiveSlideToDOM({ direction, firstLoad });

    if (!this.isLoaded) {
      this.isLoaded = true;
      this.$root.classList.add("app-loaded");
    }

    if (!firstLoad) {
      await this.transitionToSlide({ direction });
    }

    if (this.playbackType === "auto") {
      this.setupNextSlideTransition({ firstLoad });
    }
  }

  async play(channel) {
    debug("play channel");

    this.channels[channel.ref] = channel;
    this.activeChannel = channel.ref;

    this.$root.style.width = `${channel.width}px`;
    this.$root.style.height = `${channel.height}px`;
    this.$root.style.background = "rgba(32,32,32,1)";

    if (this.isResponsive) {
      const scaleContainer = document.getElementById("scale");

      scaleContainer.style.width = "100vw";
      scaleContainer.style.height = "100vh";
      scaleContainer.style.overflow = "hidden";

      const resize = () => {
        const width = window.innerWidth;
        const scale = width / channel.width;

        this.$root.style.transform = `scale(${scale})`;
      };

      resize();

      window.addEventListener("resize", resize);
    }

    this.createControls();

    const firstSlide = await getSlideByChannelVersion({
      ref: channel.ref,
      version: channel.version,
      index: 0,
    });

    firstSlide.dom = await createSlide({
      index: 0,
      slide: firstSlide,
      channel,
    });

    // Play the first slide ASAP
    this.slidesByChannel[channel.ref] = [firstSlide];
    this.playSlide({ index: 0, firstLoad: true });

    const indices = Array.from({
      // minus one because we preloaded the first slide
      length: channel.slideCount - 1,
    });

    // loop starts at 1 since we're initializing the array with the first item
    for (let index = 1; index <= indices.length; index++) {
      getSlideByChannelVersion({
        ref: channel.ref,
        version: channel.version,
        index,
      }).then(async (slide) => {
        slide.dom = await createSlide({
          index,
          channel,
          slide,
        });

        this.slidesByChannel[channel.ref][index] = slide;
      });
    }
  }

  render(elem) {
    this.$root.innerHTML = "";
    this.$root.appendChild(elem);
  }

  showError(error = "Error Loading Page") {
    debug("showing error", error);

    this.$root.classList.add("app-loaded");

    this.render(h("div.error-page", h("h1", error)));
  }
}
