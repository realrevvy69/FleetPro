import { useLayoutEffect, useRef } from "react";

// Ref that always holds the latest value; lets effects read fresh props without re-running.
export const useLatest = (value) => {
  const ref = useRef(value);
  useLayoutEffect(() => { ref.current = value; });
  return ref;
};
