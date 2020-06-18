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
import { TRANSITION_TYPES } from "./config";

const debug = Debug("app");

export default class WebDevice {
  constructor({
    transition,
    playbackType,
    defaultDuration,
    isRefreshEnabled,
    isResponsive,
    userStyles = {},
    logger,
    root,
  }) {
    this.channels = {};
    this.slidesByChannel = {};
    // Stores a key/value pair where key is the slide ID and value is said slides index within the channel
    this.slideIndexMap = {};

    // Breadcrumbs for touch navigation
    this.touchCrumbs = [];

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
    this.userStyles = userStyles;
    this.logger = logger;

    // Fallback to `d` which indicates "Disabled" AKA No transition
    this.transition = TRANSITION_TYPES[transition] ? transition : "d";

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

  addTouchCrumb(index) {
    if (this.touchCrumbs.length >= 10) {
      this.touchCrumbs.splice(1, this.touchCrumbs.length - 1);
    }

    this.touchCrumbs.push(index);
  }

  registerEventHandlers() {
    // Close the volume slider on outside click
    document.addEventListener("click", (e) => {
      if (!this.isVolumeControlsVisible) return;
      if (this.volumeControl.contains(e.target)) return;

      this.volumeControl.classList.remove("open");
    });

    emitter.on("slide:play", ({ id }) => {
      const index = this.slideIndexMap[this.activeChannel][id];

      this.addTouchCrumb(this.currentSlideIndex);

      this.playSlide({ index, isDisabledTransitionTouch: true });
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
    emitter.on("video:played", ({ duration: videoDuration, movie }) => {
      this.activeVideosPlaying++;

      this.showVolumeButton();

      this.logger.log("event", "play", {
        event_category: "Videos",
      });

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
    const slides = this.getActiveChannel();

    let prevIndex =
      this.currentSlideIndex === 0
        ? slides.length - 1
        : this.currentSlideIndex - 1;

    debug("playPrevSlide", prevIndex);

    this.playSlide({ index: prevIndex, direction: "prev" });
  }

  playNextSlide() {
    const slides = this.getActiveChannel();

    const nextIndex =
      this.currentSlideIndex === slides.length - 1
        ? 0
        : this.currentSlideIndex + 1;

    debug("playNextSlide", nextIndex);

    this.playSlide({ index: nextIndex, direction: "next" });
  }

  addSlideToDOM({ index, firstLoad, direction }) {
    const { dom: $slide } = this.getActiveChannel()[index];

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
    const { slide } = this.getActiveChannel()[this.currentSlideIndex];

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
        await this._horizontalTransition({ direction });
        break;
      default:
        await this._defaultTransition({ direction });
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

  async _defaultTransition({ direction }) {
    debug("transitioning");

    this._removeLastSlide({ direction });
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

  getActiveChannel() {
    return this.slidesByChannel[this.activeChannel];
  }

  _removeLastSlide({ direction }) {
    const slides = this.getActiveChannel();

    const indexToRemove = getLastIndex({
      direction,
      index: this.currentSlideIndex,
      totalSlides: slides.length,
    });

    debug("index to remove", indexToRemove);

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
      this.playNextSlide();
    }

    this.isPaused = isPaused;
  }

  async playSlide({
    index = this.currentSlideIndex,
    direction = "next",
    firstLoad = false,
    isDisabledTransitionTouch = false,
  }) {
    this.activeVideosPlaying = 0;
    this.currentSlideIndex = index;
    this.hideVolumeButton();

    debug("playSlide", index, direction, firstLoad);

    this.addSlideToDOM({ index, direction, firstLoad });

    if (!this.isLoaded) {
      this.isLoaded = true;
      this.$root.classList.add("app-loaded");
    }

    if (!firstLoad && !isDisabledTransitionTouch) {
      await this.transitionToSlide({ direction });
    }

    if (isDisabledTransitionTouch) {
      this.$player.removeChild(this.$player.firstChild);
    }

    const { slide } = this.getActiveChannel()[index];

    this.logger.log("event", "view", {
      event_category: "Slides",
      event_label: slide.name,
    });

    // setupNextSlideTransition creates a timer/countdown until playSlide is called again. We only want to do this if the player is setup for auto playback (auto pagination) and if the player is not paused.
    if (this.playbackType === "auto" && !this.isPaused) {
      this.setupNextSlideTransition({ firstLoad });
    }
  }

  async play({ channel, touchpoints }) {
    debug("play channel");

    const $container = document.getElementById("container");

    this.channels[channel.ref] = channel;
    this.activeChannel = channel.ref;

    this.$root.style.width = `${channel.width}px`;
    this.$root.style.height = `${channel.height}px`;

    $container.style.width = `${channel.width}px`;
    $container.style.height = `${channel.height}px`;

    const scaleContainer = document.getElementById("scale");

    if (this.userStyles.page) {
      Object.keys(this.userStyles.page).forEach((prop) => {
        scaleContainer.style[prop] = this.userStyles.page[prop];
      });
    }

    if (this.userStyles.player) {
      Object.keys(this.userStyles.player).forEach((prop) => {
        this.$root.style[prop] = this.userStyles.player[prop];
      });
    }

    const resize = () => {
      const channelWidthExceedsWindow = channel.width > window.innerWidth;

      if (!this.isResponsive && !channelWidthExceedsWindow) return;

      scaleContainer.style.width = "100vw";
      scaleContainer.style.height = "100vh";
      scaleContainer.style.overflow = "hidden";

      const width = window.innerWidth;
      const scale = width / channel.width;

      $container.style.width = `${channel.width * scale}px`;
      $container.style.height = `${channel.height * scale}px`;

      this.$root.style.transform = `scale(${scale})`;
    };

    const channelWidthExceedsWindow = channel.width > window.innerWidth;

    if (this.isResponsive || channelWidthExceedsWindow) {
      scaleContainer.style.width = "100vw";
      scaleContainer.style.height = "100vh";
      scaleContainer.style.overflow = "hidden";

      resize();
    }

    window.addEventListener("resize", resize);

    this.createControls();

    const firstSlide = await getSlideByChannelVersion({
      channel,
      index: 0,
    });

    firstSlide.dom = await createSlide({
      index: 0,
      slide: firstSlide,
      channel,
      touchpoints: touchpoints.bySlide[firstSlide.slide.id],
      // TODO: Performance gains could be had by not creating the template touch points on every slide. Only create them once. Doing it this way because it requires less effort.
      templateTouchPoints: touchpoints.byTemplate[firstSlide.template.id],
    });

    // Play the first slide ASAP
    this.slidesByChannel[channel.ref] = [firstSlide];

    this.slideIndexMap[channel.ref] = {
      [firstSlide.slide.id]: 0,
    };

    this.playSlide({ index: 0, firstLoad: true });

    const indices = Array.from({
      // minus one because we preloaded the first slide
      length: channel.slideCount - 1,
    });

    // indices will be 0 when there's only 1 slide.
    // When there's 1 slide, we insert a copy of it so that we can still do seamless transitions between slides.
    if (indices.length === 0) {
      this.slidesByChannel[channel.ref].push({
        ...firstSlide,
        dom: await createSlide({
          imgIndex: 0,
          index: 1,
          slide: firstSlide,
          channel,
          touchpoints: touchpoints.bySlide[firstSlide.slide.id],
          templateTouchPoints: touchpoints.byTemplate[firstSlide.template.id],
        }),
      });
    }

    // loop starts at 1 since we're initializing the array with the first item
    for (let index = 1; index <= indices.length; index++) {
      getSlideByChannelVersion({
        channel,
        index,
      }).then(async (slide) => {
        slide.dom = await createSlide({
          index,
          channel,
          slide,
          touchpoints: touchpoints.bySlide[slide.slide.id],
          templateTouchPoints: touchpoints.byTemplate[slide.template.id],
        });

        this.slidesByChannel[channel.ref][index] = slide;
        this.slideIndexMap[channel.ref][slide.slide.id] = index;
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
