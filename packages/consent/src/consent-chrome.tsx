import { ConsentBanner, ConsentDialog } from "c15t/next"

/** Banner + preferences dialog; mount inside `ConsentRoot` in the app root layout. */
export function ConsentChrome() {
  return (
    <>
      <ConsentBanner />
      <ConsentDialog />
    </>
  )
}
