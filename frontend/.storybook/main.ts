import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  framework: "@storybook/nextjs",
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: [],
  staticDirs: [],
};

export default config;
