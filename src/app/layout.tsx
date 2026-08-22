import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import SiteFooter from "@/components/SiteFooter";
import {
  HTML_LANG,
  LOCALE_COOKIE,
  OG_LOCALE,
  resolveLocale,
  type Locale,
} from "@/lib/i18n/config";
import { DICT } from "@/lib/i18n/dict";
import { I18nProvider } from "@/lib/i18n/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Absolute URLs are not optional for share cards: WeChat, WhatsApp and every
// crawler resolve og:image server-side, with no page to make a relative path
// relative to. Set NEXT_PUBLIC_SITE_URL per environment; the fallback is
// production. A malformed value falls back rather than failing the build.
const FALLBACK_SITE_URL = "https://ruahruah.com";

function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return new URL(FALLBACK_SITE_URL);
  try {
    return new URL(configured);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

/**
 * The locale for THIS request. Read in two places — generateMetadata and the
 * layout body — because Next calls them separately; both are cheap header
 * reads and both must agree, so they go through one function.
 */
async function requestLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
}

/**
 * Metadata follows the visitor's language, because the share card IS the
 * first impression. A link pasted into a Chinese-speaking group chat that
 * unfurls in English reads as a stray foreign link; most people never tap it.
 *
 * og:image is deliberately absent here — src/app/opengraph-image.png is picked
 * up by the file convention and Next emits the tags itself. Declaring it in
 * both places would emit duplicates, the same reason the icons carry no
 * `icons` block.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const strings = DICT[locale];
  const title = strings["meta.title"];
  const description = strings["meta.description"];

  return {
    metadataBase: siteUrl(),
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "Ruah",
      locale: OG_LOCALE[locale],
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved on the server so the first byte is already in the right language
  // and <html lang> is correct for screen readers and the browser's own
  // translate prompt. Reading cookies()/headers() opts this layout into
  // dynamic rendering, which it already needed — the locale differs per
  // visitor.
  const locale = await requestLocale();

  return (
    <html
      lang={HTML_LANG[locale]}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>
          {children}
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
