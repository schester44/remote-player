import Debug from "debug";

const debug = Debug("app:logger");

export default class Logger {
  constructor({ googleAnalyticsId }) {
    this.enabled = !!googleAnalyticsId;

    debug("googleAnalyticsId", googleAnalyticsId);

    if (!this.enabled) {
      debug("Logging disabled");
      return;
    }

    const $ga = document.createElement("script");

    $ga.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
    $ga.setAttribute("async", true);

    document.body.appendChild($ga);

    window.dataLayer = window.dataLayer || [];

    this.log("js", new Date());
    this.log("config", googleAnalyticsId);

    debug("Logging enabled");
  }

  log() {
    if (!this.enabled) return;

    dataLayer.push(arguments);

    debug("logged", arguments);
  }
}
