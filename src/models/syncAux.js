import axios from "axios";
import config from "../config";
import { toInt } from "../utils/normalize";

const TOUCH_TYPES = { U: true, T: true };

const normalize = (raw = []) => {
  const bySlide = {};
  const byTemplate = {};

  for (let i = 0; i < raw.length; i++) {
    const touchpoint = raw[i];

    const { targetID, touchType, type } = touchpoint;

    if (!TOUCH_TYPES[touchType] || !targetID) continue;

    if (type === "S") {
      if (!bySlide[targetID]) {
        bySlide[targetID] = [];
      }

      bySlide[targetID].push({
        height: toInt(touchpoint.h),
        width: toInt(touchpoint.w),
        x: toInt(touchpoint.x),
        y: toInt(touchpoint.y),
        z: toInt(touchpoint.z),
        action: touchpoint.touchAction,
        type: touchType,
      });
    }

    if (type === "T") {
      if (!byTemplate[targetID]) {
        byTemplate[targetID] = [];
      }

      byTemplate[targetID].push({
        height: toInt(touchpoint.h),
        width: toInt(touchpoint.w),
        x: toInt(touchpoint.x),
        y: toInt(touchpoint.y),
        z: toInt(touchpoint.z),
        action: touchpoint.touchAction,
        type: touchType,
      });
    }
  }

  return { bySlide, byTemplate };
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

  const touchpoints = normalize(touchpointsDB);

  return touchpoints;
};
