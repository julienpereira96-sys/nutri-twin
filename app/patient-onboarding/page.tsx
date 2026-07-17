import dynamic from "next/dynamic";

const PatientOnboardingPage = dynamic(() => import("./PatientOnboardingPage"), { ssr: false });

export default PatientOnboardingPage;
