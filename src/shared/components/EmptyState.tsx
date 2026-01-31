import { COLORS, FONT_SIZES } from "../constants";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}

const defaultIcon = (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

export function EmptyState({ icon = defaultIcon, title, subtitle }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: COLORS.gray400,
      }}
    >
      {icon}
      <p style={{ marginTop: "16px", fontSize: `${FONT_SIZES.xl}px` }}>{title}</p>
      {subtitle && (
        <p style={{ fontSize: `${FONT_SIZES.base}px`, marginTop: "4px" }}>{subtitle}</p>
      )}
    </div>
  );
}
