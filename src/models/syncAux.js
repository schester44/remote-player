import axios from "axios";
import Debug from "debug";
import config from "../config";
import { toInt } from "../utils/normalize";

const debug = Debug("app:syncAux");

const TOUCH_POINT_TYPE = "U";

//-- RAW[TouchPoint]--
// ch: "768"
// cw: "1366"
// h: "31.777777671813965"
// targetID: "good Save"
// touchAction: "23"
// touchType: "C"
// type: "S"
// w: "308.77777767181396"
// x: "64"
// y: "472"
// z: "16"

const normalize = (raw = [], { type }) => {
  const touchpointsBySlide = {};

  for (let i = 0; i < raw.length; i++) {
    const touchpoint = raw[i];

    if (touchpoint.touchType !== type) continue;

    if (!touchpointsBySlide[touchpoint.targetID]) {
      touchpointsBySlide[touchpoint.targetID] = [];
    }

    touchpointsBySlide[touchpoint.targetID].push({
      height: toInt(touchpoint.h),
      width: toInt(touchpoint.w),
      x: toInt(touchpoint.x),
      y: toInt(touchpoint.y),
      z: toInt(touchpoint.z),
      action: touchpoint.touchAction,
      type: touchpoint.touchType,
    });
  }

  return touchpointsBySlide;
};

export const getSyncAux = async () => {
  const response = await axios
    .get(`${config.apiEndpoint}/scs:RPC.getSyncAux`)
    .then(({ data }) => data);

  const responseWithMD5 = response.substring(48, response.length - 1);

  // 🙄
  const touchpointsDB = Function(
    `"use strict"; 

      // need to create these variables since they're in the response string
      var touchpointsDB = [];
      var meetingThemesDB = [];
      var meetingEventsDB = [];
      
      ${responseWithMD5}
      
      return touchpointsDB;
      `
  )();

  const touchpoints = normalize(touchpointsDB, { type: TOUCH_POINT_TYPE });

  debug("touchpointsBySlide", touchpoints);

  return touchpoints;
};
