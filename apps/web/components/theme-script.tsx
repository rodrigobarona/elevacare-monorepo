import Script from "next/script"

export const THEME_STORAGE_KEY = "theme"

const themeInitScript = `(function(){try{var d=document.documentElement,c=d.classList;c.remove('light','dark');var e=localStorage.getItem('${THEME_STORAGE_KEY}');if(e==='dark'||(!e||e==='system')&&window.matchMedia('(prefers-color-scheme:dark)').matches){c.add('dark');d.style.colorScheme='dark'}else{c.add('light');d.style.colorScheme='light'}}catch(e){}})();`

/**
 * Injects the theme initialization script via next/script with
 * strategy="beforeInteractive". This places the script in <head> OUTSIDE
 * of React's component/hydration tree, preventing:
 *  - The "Encountered a script tag" React 19 warning
 *  - useId() positional mismatches that break Radix hydration
 */
export function ThemeScript() {
  return (
    <Script id="theme-init" strategy="beforeInteractive">
      {themeInitScript}
    </Script>
  )
}
