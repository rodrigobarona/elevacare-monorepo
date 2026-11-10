import { ConsentBanner, ConsentDialog } from "c15t/next"

/**
 * Banner + preferences dialog; mount inside `ConsentRoot` in the app root
 * layout. The banner floats bottom-right so it never covers the page's
 * main action, which sits on the left of Eleva's heroes.
 */
export function ConsentChrome() {
  return (
    <>
      <ConsentBanner variant="floating" position="bottom-right" />
      <ConsentDialog />
    </>
  )
}
