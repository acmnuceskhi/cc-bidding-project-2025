import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
// import NavigationLoader from "@/components/NavigationLoader";
import TopLoadingBar from "@/components/TopLoadingBar";

// Optional full screen loader implemented by NavigationLoader

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CC Bidding System",
  description: "College Championship Bidding Platform - Real-time auction system for participant selection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} font-sans antialiased`}
        suppressHydrationWarning={true}
      >
        {/* <NavigationLoader /> */}
        <TopLoadingBar />
        {children}
      </body>
    </html>
  );
}
