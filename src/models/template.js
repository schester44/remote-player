export function buildTemplate(data) {
  const template = {
    id: data[1],
    name: data[2],
    width: data[3],
    height: data[4],
    RSS: data[47],
    tickerType: data[48],
    rssFeed: data[49],
    textFeed: data[50],
    feedColor: data[51],
    feedBgColor: data[52],
    feedX: data[53],
    feedY: data[54],
    feedZ: data[55],
    feedHeight: data[56],
    feedWidth: data[57],
    tickerSize: data[58],
    tickerSpeed: data[59],
    useDataFeed: data[71],
    dataFeed: data[72],
    dataFeedX: data[73],
    dataFeedY: data[74],
    dataFeedZ: data[75],
    dataFeedHeight: data[76],
    dataFeedWidth: data[77]
  };

  // TODO: Setup a template.ticker object similar to Slide
  if (template.RSS === "0") {
    template.hasRSSFeed = true;
  }

  return template;
}
