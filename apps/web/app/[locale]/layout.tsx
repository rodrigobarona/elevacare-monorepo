import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { Geist_Mono, DM_Sans, Lora } from "next/font/google"

import "@eleva/ui/globals.css"
import { cn } from "@eleva/ui/lib/utils"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { routing } from "@/i18n/routing"
// #region agent log
import { DebugHydration } from "@/components/debug-hydration"
// #endregion

const loraHeading = Lora({ subsets: ["latin"], variable: "--font-heading" })
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: "site" })
  return {
    title: {
      default: `${t("name")} — ${t("tagline")}`,
      template: `%s · ${t("name")}`,
    },
    description: t("tagline"),
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        dmSans.variable,
        loraHeading.variable
      )}
    >
      <body className="min-h-svh bg-background text-foreground">
        {/* #region agent log */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function(){
            var ep='http://127.0.0.1:7536/ingest/075ce577-f51d-4430-93b0-5a0cff32d8ef';
            var hd={'Content-Type':'application/json','X-Debug-Session-Id':'005272'};
            function _dl(loc,msg,data){
              fetch(ep,{method:'POST',headers:hd,body:JSON.stringify({sessionId:'005272',location:loc,message:msg,data:data,timestamp:Date.now(),hypothesisId:'F,G'})}).catch(function(err){
                console.warn('[DEBUG-005272]',loc,msg,JSON.stringify(data));
              });
            }
            _dl('layout:script-exec','Inline script executed',{url:location.href,readyState:document.readyState});
            window.addEventListener('error',function(e){
              _dl('layout:js-error','JS error caught',{message:e.message,filename:(e.filename||'').substring(0,200),lineno:e.lineno,colno:e.colno});
            });
            window.addEventListener('unhandledrejection',function(e){
              _dl('layout:promise-reject','Unhandled rejection',{reason:String(e.reason).substring(0,500)});
            });
            var origErr=console.error;
            console.error=function(){
              var args=Array.prototype.slice.call(arguments);
              var msg=args.map(function(a){try{return typeof a==='string'?a:(a&&a.message)||String(a)}catch(x){return'?'}}).join(' ').substring(0,500);
              _dl('layout:console-error','console.error intercepted',{error:msg});
              origErr.apply(console,arguments);
            };
            document.addEventListener('DOMContentLoaded',function(){
              _dl('layout:dom-loaded','DOMContentLoaded fired',{url:location.href});
            });
            setTimeout(function(){
              _dl('layout:hydration-check-3s','3s page state',{
                url:location.href,
                bodyChildCount:document.body?document.body.childElementCount:0,
                scriptCount:document.querySelectorAll('script').length,
                linkCount:document.querySelectorAll('link').length,
                docReadyState:document.readyState,
                nextDataPresent:!!document.getElementById('__next'),
                reactRootCount:document.querySelectorAll('[data-reactroot]').length,
                bodyClasses:document.body?document.body.className:'',
                hasRouterLink:!!document.querySelector('a[href*="/experts"]')
              });
            },3000);
            setTimeout(function(){
              var flightData=typeof self.__next_f!=='undefined'?self.__next_f:null;
              var flightLen=flightData?flightData.length:0;
              var flightSample=flightData?flightData.slice(0,5).map(function(f){return Array.isArray(f)?[f[0],String(f[1]).substring(0,100)]:String(f).substring(0,100)}):'none';
              var reactRoot=document.querySelector('[data-next-router-state-tree]');
              _dl('layout:hydration-check-8s','8s page state',{
                url:location.href,
                docReadyState:document.readyState,
                bodyChildCount:document.body?document.body.childElementCount:0,
                flightDataLen:flightLen,
                flightSample:flightSample,
                hasReactRoot:!!reactRoot,
                nextRouterState:reactRoot?reactRoot.getAttribute('data-next-router-state-tree'):'none',
                hasNextF:typeof self.__next_f!=='undefined',
                nextRSCPayload:typeof self.__next_r!=='undefined',
                perfEntries:performance.getEntriesByType('resource').filter(function(e){return e.name.indexOf('_next')>=0}).map(function(e){return {name:e.name.split('/').pop(),duration:Math.round(e.duration),status:e.responseStatus||0}}).slice(0,10)
              });
            },8000);
          })();
        `,
          }}
        />
        {/* #endregion */}
        <NextIntlClientProvider>
          {/* #region agent log */}
          <DebugHydration />
          {/* #endregion */}
          <div className="flex min-h-svh flex-col">
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
