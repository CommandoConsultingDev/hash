import type { SvgIconProps } from "@mui/material";
import { SvgIcon } from "@mui/material";
import type { FunctionComponent } from "react";

export const CircleNodesLightIcon: FunctionComponent<SvgIconProps> = (
  props,
) => {
  return (
    <SvgIcon
      width="512"
      height="512"
      viewBox="0 0 512 512"
      fill="none"
      {...props}
    >
      <path d="M376.2 121.7l0 0c7 4 15.2 6.3 23.8 6.3c2.6 0 5.2-.2 7.6-.6l0 0C430.5 123.7 448 103.9 448 80c0-26.5-21.5-48-48-48s-48 21.5-48 48c0 .7 0 1.3 0 2l0 0c.5 11.4 4.9 21.7 11.9 29.7l0 0c3.5 4 7.6 7.4 12.2 10zm-5.9 32.6c-15.2-6.1-28.2-16.8-37.1-30.3L158.7 193.7c.8 4.6 1.3 9.4 1.3 14.3c0 14.4-3.8 27.9-10.5 39.6l138 120.8c13-9.9 29.2-16 46.7-16.3l36-197.7zm-4.5 203.4C395.2 369.5 416 398.3 416 432c0 44.2-35.8 80-80 80s-80-35.8-80-80c0-14.4 3.8-27.9 10.5-39.6l-138-120.8C115 281.9 98.2 288 80 288c-44.2 0-80-35.8-80-80s35.8-80 80-80c27.9 0 52.5 14.3 66.8 36L321.3 94.3c-.8-4.6-1.3-9.4-1.3-14.3c0-44.2 35.8-80 80-80s80 35.8 80 80c0 43.6-34.9 79.1-78.3 80l-36 197.7zm-246-122.9c.7-1 1.3-2 1.9-3.1c4-7 6.3-15.1 6.3-23.8c0-26.5-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48c8.5 0 16.6-2.2 23.5-6.2l0 0c6.5-3.7 12.1-8.8 16.3-15zM291.4 414.2c-2.2 5.5-3.4 11.5-3.4 17.8c0 26.5 21.5 48 48 48s48-21.5 48-48s-21.5-48-48-48c-14 0-26.6 6-35.3 15.5c-2.7 2.9-5 6.1-6.9 9.6c-.9 1.6-1.7 3.4-2.4 5.1l0 0z" />
    </SvgIcon>
  );
};
