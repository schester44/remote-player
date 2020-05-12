export const nowInMS = () => new Date().getTime();

export const getLastIndex = ({ direction, index, totalSlides }) => {
  return direction === "next"
    ? index === 0
      ? totalSlides - 1
      : index - 1
    : index === totalSlides - 1
    ? 0
    : index + 1;
};

export const updatePageTitle = (title) => {
  document.title = title;
};
