import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DeployWidget from "../components/DeployWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Reserva de salas",
  description: "Reserve salas e consulte as reservas marcadas.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-PT"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {process.env.NODE_ENV === "development" && <DeployWidget />}
      </body>
    </html>
  );
}
