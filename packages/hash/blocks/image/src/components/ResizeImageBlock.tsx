import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { tw } from "twind";

type ResizeBlockProps = {
  imageSrc: string;
  width: number | undefined;
  updateWidth: (width: number) => void;
};

const BLOCK_RESIZER_POSITIONS = ["left", "right"] as const;

const MIN_WIDTH = 96;

export const ResizeImageBlock: React.VFC<ResizeBlockProps> = ({
  imageSrc,
  width,
  updateWidth,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (!imageRef.current) return;
    if (!width) {
      const initialImageWidth = imageRef.current.getBoundingClientRect().width;
      updateWidth(initialImageWidth);
    }
  }, []);

  useEffect(() => {
    if (!imageRef.current) return;

    const imageWidth = imageRef.current.getBoundingClientRect().width;

    if (imageWidth != width) {
      imageRef.current.style.width = `${width}px`;
    }
  }, [width]);

  const handleResize = (evt: React.MouseEvent, direction: "left" | "right") => {
    function onMouseMove(mouseMoveEvt: MouseEvent) {
      if (!imageRef.current) return;
      let newWidth;
      const { left, right } = imageRef.current.getBoundingClientRect();

      if (direction == "right") {
        newWidth = mouseMoveEvt.pageX - left;
      }

      if (direction == "left") {
        newWidth = right - mouseMoveEvt.pageX;
      }

      if (newWidth && newWidth > MIN_WIDTH) {
        imageRef.current.style.width = `${newWidth}px`;
      }
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      setTimeout(() => {
        if (!imageRef.current) return;
        const { width: newWidth } = imageRef.current.getBoundingClientRect();
        updateWidth(newWidth);
      }, 1000);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className={tw`relative flex group`}>
      <img
        className={tw`mx-auto max-w-full`}
        ref={imageRef}
        src={imageSrc}
        alt="Image block"
      />
      {BLOCK_RESIZER_POSITIONS.map((position) => (
        <div
          style={{ maxHeight: "50%" }}
          className={tw`transition-all absolute ${
            position == "left" ? "left-1" : "right-1"
          } top-1/2 -translate-y-1/2 h-12 w-1.5 rounded-full bg-black bg-opacity-70 cursor-col-resize opacity-0 group-hover:opacity-100`}
          onMouseDown={(e) => handleResize(e, position)}
        ></div>
      ))}
    </div>
  );
};
