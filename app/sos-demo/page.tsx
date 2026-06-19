"use client";

import dynamic from "next/dynamic";

const SOSExerciseVisual = dynamic(
  () => import("@/app/chat/SOSExerciseVisual"),
  { ssr: false }
);

export default function SOSDemoPage() {
  return <SOSExerciseVisual firstName="Julien" />;
}
