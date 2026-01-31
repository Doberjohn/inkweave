import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Header } from "./Header";

const meta: Meta<typeof Header> = {
  title: "Components/Header",
  component: Header,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    onGameModeChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    totalCards: 1234,
    isLoading: false,
    gameMode: "infinity",
  },
};

export const Loading: Story = {
  args: {
    totalCards: 0,
    isLoading: true,
    gameMode: "infinity",
  },
};

export const CoreMode: Story = {
  args: {
    totalCards: 876,
    isLoading: false,
    gameMode: "core",
  },
};

export const InfinityMode: Story = {
  args: {
    totalCards: 1500,
    isLoading: false,
    gameMode: "infinity",
  },
};
