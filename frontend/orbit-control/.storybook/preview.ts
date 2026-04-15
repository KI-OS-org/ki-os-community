import type { Preview } from "@storybook/react";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "orbit",
      values: [{ name: "orbit", value: "#050814" }],
    },
    layout: "centered",
  },
};

export default preview;
