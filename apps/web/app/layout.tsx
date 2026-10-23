import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://quizz.nouvel-ordre.fr"),
  title: {
    default: "Nouvel Ordre — On a des questions.",
    template: "%s · Nouvel Ordre",
  },
  description:
    "Les phrases qu’on entend partout. Des quiz gratuits, des explications et des sources pour se faire une opinion.",
  icons: { icon: "/logo.png" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Nouvel Ordre",
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
