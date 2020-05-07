const positionMap = {
  // top left
  tl: {},
  // top right
  tr: {
    page: {
      display: "flex",
      "justify-content": "flex-end",
    },
  },
  // top center
  tc: {
    page: {
      display: "flex",
      "justify-content": "center",
    },
  },
  // dead center
  dc: {
    page: {
      width: "100vw",
      height: "100vh",
      display: "flex",
      "justify-content": "center",
      "align-items": "center",
    },
  },
  // bottom left
  bl: {
    page: {
      width: "100vw",
      height: "100vh",
      display: "flex",
      "align-items": "flex-end",
    },
  },
  // bottom right
  br: {
    page: {
      width: "100vw",
      height: "100vh",
      display: "flex",
      "align-items": "flex-end",
      "justify-content": "flex-end",
    },
  },
  // bottom center
  bc: {
    page: {
      width: "100vw",
      height: "100vh",
      display: "flex",
      "align-items": "flex-end",
      "justify-content": "center",
    },
  },
};

export const getUserStyles = ({ playerPosition, playerBorder }) => {
  const userStyles = {
    page: {},
    player: {},
  };

  if (!playerPosition && !playerBorder) {
    return userStyles;
  }

  if (positionMap[playerPosition]) {
    userStyles.page = {
      ...userStyles.page,
      ...positionMap[playerPosition].page,
    };
  }

  if (playerBorder) {
    // determine if its a hex or rgb value..not the most reliable since `10px solid red` fails this check

    let borderParts = playerBorder.split(" ");

    const isHex = borderParts[borderParts.length - 1].length <= 6;

    const color = isHex
      ? `#${borderParts[borderParts.length - 1]}`
      : borderParts[borderParts.length - 1];

    borderParts.pop();

    userStyles.player = {
      ...userStyles.player,
      border: `${borderParts.join(" ")} ${color}`,
    };
  }

  return userStyles;
};
