import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function DemoCard() {
  return (
    <Card className="w-[420px]">
      <CardHeader>
        <CardDescription>Foundation Sprint</CardDescription>
        <CardTitle>Orbit Control Design Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--muted-foreground)]">Ruhige Oberfläche, klare Gliederung und Enterprise-taugliche Basis.</p>
      </CardContent>
    </Card>
  );
}

const meta: Meta<typeof DemoCard> = {
  title: "Orbit/Card",
  component: DemoCard,
};

export default meta;
type Story = StoryObj<typeof DemoCard>;

export const Default: Story = {};
