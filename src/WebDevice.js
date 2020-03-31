import h from "hyperscript";

import { getSlideByChannelVersion } from "./models/slide";
import Debug from "debug";
import rafscroll from "@braid/rafscroll";

import { createSlide } from "./utils/createSlide";

const debug = Debug("app");

const getLastIndex = ({ direction, index, totalSlides }) => {
  return direction === "next"
    ? index === 0
      ? totalSlides - 1
      : index - 1
    : index === totalSlides - 1
    ? 0
    : index + 1;
};

// FIXME: With the ASYNC requests, its possible for activeSlide to be undefined, we should skip or wait when that occurs.
export default class WebDevice {
  constructor({ transition, playbackType, defaultDuration, root }) {
    this.channels = {};
    this.slidesByChannel = {};
    this.currentSlideIndex = 0;
    this.activeChannel = undefined;
    this.slideTransitionTimeout = undefined;
    this.isScrolling = false;

    this.transition = transition;
    this.playbackType = playbackType;

    if (defaultDuration != "d") {
      if (defaultDuration < 3) defaultDuration = 3;
    }

    this.defaultDuration = defaultDuration;

    this.$root = root || document.getElementById("root");

    this.$player = h("div#player");

    this.$root.appendChild(this.$player);
    this.scroller = rafscroll(this.$player);

    debug("player element added to root");
  }

  createControls() {
    const controlLeft = h("div.control .control-left", {
      onclick: () => {
        if (this.isScrolling) return;

        window.clearTimeout(this.slideTransitionTimeout);

        this.playPrevSlide();
      }
    });

    const controlRight = h("div.control .control-right", {
      onclick: () => {
        if (this.isScrolling) return;

        window.clearTimeout(this.slideTransitionTimeout);

        this.playNextSlide();
      }
    });

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
      // after a successful scrollLeft, we remove the previously active item and set the scrollLeft to 0.
      // So scrollLeft goes from 0 -> campaign width -> 0
      // when we prepend an item to the DOM, this throws things off because we're at 0, prepending an item adds it to the DOM at the 0 pixel, so we need to change the player's scrollLeft to account for the newly prepended item.
      this.$player.scrollLeft = this.channels[this.activeChannel].width;
    }
  }

  setupNextSlideTransition({ firstLoad }) {
    const duration = firstLoad
      ? (this.defaultDuration + 1) * 1000
      : this.defaultDuration * 1000;

    this.slideTransitionTimeout = window.setTimeout(() => {
      debug("slide transitioned");
      this.playNextSlide();
    }, duration);
  }

  async scrollToNextSlide({ direction }) {
    const scrollLeft =
      direction === "next"
        ? this.channels[this.activeChannel].width
        : -this.channels[this.activeChannel].width;

    this.isScrolling = true;

    debug("scrolling", scrollLeft);

    await this.scroller.scrollLeft(scrollLeft);

    this.isScrolling = false;

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
      this.$player.scrollLeft = 0;
    }
  }

  async playSlide({ index, direction = "next", firstLoad = false }) {
    debug("playSlide", index, direction, firstLoad);

    this.addActiveSlideToDOM({ direction, firstLoad });

    if (!firstLoad) {
      await this.scrollToNextSlide({ direction });
    }

    if (index === 3) return;

    this.setupNextSlideTransition({ firstLoad });
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

  setStyle(property, value) {
    this.$root.style[property] = value;
  }

  render(elem) {
    this.$root.innerHTML = "";
    this.$root.appendChild(elem);
  }

  showError(error = "Error Loading Page") {
    debug("showing error", error);

    this.render(
      h("div", h("h1", error), {
        style: {
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
