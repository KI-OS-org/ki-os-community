import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof Button> = {
  title: "Orbit/Button",
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: "Launch flow",
    variant: "primary",
  },
};

export const Secondary: Story = {
  args: {
    children: "Open explain mode",
    variant: "secondary",
  },
};
