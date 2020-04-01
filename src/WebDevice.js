import h from "hyperscript";

import { getSlideByChannelVersion } from "./models/slide";
import Debug from "debug";
import rafscroll from "@braid/rafscroll";
import { createSlide } from "./utils/createSlide";
import pauseIcon from "./icons/pause-circle.svg";

import prevIcon from "./icons/skip-back.svg";
import nextIcon from "./icons/skip-forward.svg";
import playIcon from "./icons/play-circle.svg";
import { emitter } from "./emitter";

const debug = Debug("app");

const nowInMS = () => new Date().getTime();

const getLastIndex = ({ direction, index, totalSlides }) => {
  return direction === "next"
    ? index === 0
      ? totalSlides - 1
      : index - 1
    : index === totalSlides - 1
    ? 0
    : index + 1;
};

export default class WebDevice {
  constructor({ transition, playbackType, defaultDuration, root }) {
    this.channels = {};
    this.slidesByChannel = {};
    this.currentSlideIndex = 0;
    this.activeChannel = undefined;

    // Slide transition keeps track of when the timer was first initialized. Using it, plus a combination of this.defaultDuration, we're able to determine how much time is left before the slide paginates.
    this.slideTransitionTime = undefined;
    this.slideTransitionTimeout = undefined;
    // timeUntilTransition tracks how much time was left until the slide was supposed to transition. This is used when we pause the slide transition such as when a long video is played.
    this.timeUntilTransition = undefined;

    this.isScrolling = false;
    this.isPaused = false;
    this.isLoaded = false;

    this.transition = transition;
    this.playbackType = playbackType === "0" ? "auto" : "click";

    if (defaultDuration != "d") {
      if (defaultDuration < 3) defaultDuration = 3;
    }

    this.defaultDuration = defaultDuration;

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
    // Pause slide pagination when a video exceeds the length of the slide duration.
    emitter.on("video:played", ({ duration: videoDuration }) => {
      // Only disable pagination if playbackType is auto.
      if (this.playbackType !== "auto") return;

      // If there's no slideTransitionTime then there _shouldnt_ be a timer.
      // Without a transitionTime, its impossible to compute when the slide will change
      if (!this.slideTransitionTime) return;

      this.timeUntilTransition =
        this.defaultDuration * 1000 - (nowInMS() - this.slideTransitionTime);

      debug("video playing, paused slide transition for", videoDuration);

      if (videoDuration * 1000 > this.timeUntilTransition) {
        this.stopSlidePagination();
      }
    });

    // If a video canceled the slide transition, on pause, we need to re-enable that transition
    emitter.on("video:paused", () => {
      if (!this.timeUntilTransition) return;

      this.setPaginationTimer({ duration: this.timeUntilTransition });
    });

    // When a video finishes playing, if we've previously disabled pagination then we need to enable pagination again.
    emitter.on("video:ended", () => {
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

  setPaginationTimer({ duration }) {
    debug(`setPaginationTimer`, duration);

    this.slideTransitionTime = nowInMS();

    this.slideTransitionTimeout = window.setTimeout(() => {
      debug("slide transitioned");
      this.playNextSlide();
    }, duration);
  }

  createControls() {
    const controlLeft = h(
      "div.control .control-left",
      {
        onclick: () => {
          if (this.isScrolling) return;

          this.stopSlidePagination();
          this.playPrevSlide();
        }
      },
      h("img.control-icon", { src: prevIcon })
    );

    const controlRight = h(
      "div.control .control-right",
      {
        onclick: () => {
          if (this.isScrolling) return;

          this.stopSlidePagination();
          this.playNextSlide();
        }
      },
      h("img.control-icon", { src: nextIcon })
    );

    if (this.playbackType === "auto") {
      const pauseButton = h(
        "div#pause-btn",
        {
          onclick: () => {
            this.togglePause();
          }
        },
        h("img#pause-icon", { src: pauseIcon })
      );

      this.$root.appendChild(pauseButton);
    }

    this.$root.appendChild(controlLeft);
    this.$root.appendChild(controlRight);
    debug("controls created");
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
      this.$player.prepend($slide);

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
    const duration = firstLoad
      ? (this.defaultDuration + 1) * 1000
      : this.defaultDuration * 1000;

    this.setPaginationTimer({ duration });
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
      totalSlides: slides.length
    });

    const siblingToRemove = document.getElementById(`slide-${indexToRemove}`);

    if (siblingToRemove) {
      debug("removing sibling", siblingToRemove);
      this.$player.removeChild(siblingToRemove);

      return true;
    }

    return false;
  }

  stopSlidePagination() {
    this.slideTransitionTime = undefined;
    window.clearTimeout(this.slideTransitionTimeout);
  }

  togglePause() {
    const icon = document.querySelector("#pause-icon");

    icon.src = this.isPaused ? pauseIcon : playIcon;

    const isPaused = !this.isPaused;

    if (isPaused) {
      this.stopSlidePagination();
    } else {
      this.playNextSlide({ index: this.currentSlideIndex, direction: "next" });
    }

    this.isPaused = !this.isPaused;
  }

  async playSlide({ index, direction = "next", firstLoad = false }) {
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

    this.createControls();

    const firstSlide = await getSlideByChannelVersion({
      ref: channel.ref,
      version: channel.version,
      index: 0
    });

    firstSlide.dom = await createSlide({
      index: 0,
      slide: firstSlide,
      channel
    });

    // Play the first slide ASAP
    this.slidesByChannel[channel.ref] = [firstSlide];
    this.playSlide({ index: 0, firstLoad: true });

    const indices = Array.from({
      // minus one because we preloaded the first slide
      length: channel.slideCount - 1
    });

    // loop starts at 1 since we're initializing the array with the first item
    for (let index = 1; index <= indices.length; index++) {
      getSlideByChannelVersion({
        ref: channel.ref,
        version: channel.version,
        index
      }).then(async slide => {
        slide.dom = await createSlide({
          index,
          channel,
          slide
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

    this.render(
      h("div", h("h1", error), {
        style: {
          color: "#000",
          width: "100%",
          height: "100%",
          display: "flex",
          "align-items": "center",
          "justify-content": "center"
        }
      })
    );
  }
}
