import { useRef, useState, useEffect, type DependencyList } from 'react';
import { mergeRefs } from 'react-merge-refs';
import useMeasure from 'react-use-measure';

/**
 * A function that returns a boolean to determine whether or not to cancel the capture of the initial measurements.
 * If the function returns true, the capture is cancelled.
 */
type CancelCaptureFunction = () => boolean;
/**
 * A dependency list for the CancelCaptureFunction. Work similarly to the useEffect dependency list.
 */
type PreventCaptureDependencyList = DependencyList;
/**
 * The parameters for the useMeasurementCapture hook.
 * @param preventCapture A tuple containing a function that returns a boolean to determine whether or not to cancel the capture of the initial measurements.
 */
export type useMeasurementCaptureParams = {
  preventCapture: [fn: CancelCaptureFunction, deps: PreventCaptureDependencyList];
};

/**
 * This hook captures the initial height and width of an element after it has rendered.
 * In order for the measurement to be captured, you must define preventCapture.
 */
export const useMeasurementCapture = (
  { preventCapture }: useMeasurementCaptureParams = { preventCapture: [() => true, []] },
) => {
  const [{ originalHeight, originalWidth, isReady }, set] = useState<
    | {
        originalHeight: null;
        originalWidth: null;
        isReady: false;
      }
    | {
        originalHeight: number;
        originalWidth: number;
        isReady: true;
      }
  >({ originalHeight: null, originalWidth: null, isReady: false });

  // By placing this in state, we can allow the user to update the preventCapture function and dependency list at any time.
  const [[cancelCapture, deps], updatePreventChange] =
    useState<Exclude<useMeasurementCaptureParams, undefined>['preventCapture']>(preventCapture);

  const [measureRef, bounds] = useMeasure({ debounce: 200 });
  const localRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    /**
     * We prevent capture if:
     * * If the element has not rendered yet
     * * The initial hw have already been set
     * * The current height and width are still being determined.
     * * The user defined a function to prevent the capture is true.
     */
    if (
      !localRef.current ||
      originalHeight !== null ||
      originalWidth !== null ||
      !bounds.height ||
      !bounds.width ||
      cancelCapture()
    ) {
      return;
    }
    // Set the height and width of the element
    set({ originalHeight: bounds.height, originalWidth: bounds.width, isReady: true });
  }, [localRef.current, bounds, originalHeight, originalWidth, ...deps]);
  return [mergeRefs([measureRef, localRef]), { originalHeight, originalWidth, isReady }, updatePreventChange] as const;
};
