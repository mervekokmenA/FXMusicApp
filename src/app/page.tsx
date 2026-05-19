"use client";

import dynamic from "next/dynamic";

const AudioApp = dynamic(() => import("@/components/AudioApp"), { ssr: false });

export default function Home() {
  return <AudioApp />;
}
