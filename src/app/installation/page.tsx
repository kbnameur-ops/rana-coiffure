import type { Metadata } from "next";
import { SetupNotice } from "@/components/site/SetupNotice";

export const metadata: Metadata = {
  title: "Configuration requise",
  robots: { index: false, follow: false },
};

export default function InstallationPage() {
  return <SetupNotice />;
}
