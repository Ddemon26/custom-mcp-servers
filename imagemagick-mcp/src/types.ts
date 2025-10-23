/**
 * Tool name constants for all ImageMagick operations
 */
export const ImageMagickTools = {
  GET_IMAGE_INFO: "get_image_info",
  RESIZE_IMAGE: "resize_image",
  CROP_IMAGE: "crop_image",
  ROTATE_IMAGE: "rotate_image",
  FLIP_IMAGE: "flip_image",
  CONVERT_FORMAT: "convert_format",
  ADJUST_QUALITY: "adjust_quality",
  CREATE_THUMBNAIL: "create_thumbnail",
  ADD_WATERMARK: "add_watermark",
  BATCH_RESIZE: "batch_resize",
  ADJUST_BRIGHTNESS: "adjust_brightness",
  ADJUST_CONTRAST: "adjust_contrast",
  ADJUST_SATURATION: "adjust_saturation",
  BLUR_IMAGE: "blur_image",
  SHARPEN_IMAGE: "sharpen_image",
} as const;

/**
 * Type for flip direction
 */
export type FlipDirection = "horizontal" | "vertical";

/**
 * Type for watermark position
 */
export type WatermarkPosition =
  | "northwest"
  | "north"
  | "northeast"
  | "west"
  | "center"
  | "east"
  | "southwest"
  | "south"
  | "southeast";

/**
 * Gravity map for ImageMagick positioning
 */
export const GRAVITY_MAP: { [key: string]: string } = {
  northwest: "NorthWest",
  north: "North",
  northeast: "NorthEast",
  west: "West",
  center: "Center",
  east: "East",
  southwest: "SouthWest",
  south: "South",
  southeast: "SouthEast",
};
