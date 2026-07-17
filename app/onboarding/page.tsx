"use client";
import dynamic from "next/dynamic";

const OnboardingPage = dynamic(() => import("./OnboardingPage"), { ssr: false });

export default OnboardingPage;
