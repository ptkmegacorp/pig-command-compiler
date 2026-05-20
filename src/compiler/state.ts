export interface PigCommandState {
  activeDisplay?: string;
  recentScreenshotPath?: string;
  lastImagePath?: string;
  latestPhotoPath?: string;
  defaultLocation?: string;
  focusedWindow?: string;
  selectedFile?: string;
}

export function buildInitialState(overrides: Partial<PigCommandState> = {}): PigCommandState {
  return {
    activeDisplay: process.env.DISPLAY ?? process.env.WAYLAND_DISPLAY,
    defaultLocation: process.env.PIG_DEFAULT_LOCATION,
    recentScreenshotPath: process.env.PIG_RECENT_SCREENSHOT,
    lastImagePath: process.env.PIG_LAST_IMAGE,
    latestPhotoPath: process.env.PIG_LATEST_PHOTO,
    ...overrides,
  };
}

export function contextValue(state: PigCommandState, key: string): string | undefined {
  switch (key) {
    case "active_display":
      return state.activeDisplay;
    case "recent_screenshot_path":
      return state.recentScreenshotPath;
    case "last_image_path":
      return state.lastImagePath;
    case "latest_photo_path":
      return state.latestPhotoPath;
    case "default_location":
      return state.defaultLocation;
    case "focused_window":
      return state.focusedWindow;
    case "selected_file":
      return state.selectedFile;
    default:
      return undefined;
  }
}
