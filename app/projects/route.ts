// Auto-generated from the original Framer page. Served verbatim — including
// the HTML comment nodes, which are Framer's React hydration (Suspense
// boundary) markers: rendering this through JSX instead was tried and
// reverted because React cannot emit comment nodes, and losing them forces
// Framer's runtime into a slow client-side re-render (measured 94 -> 62
// mobile Performance). See routeHandler() in lib/nextjs-export.ts.
//
// Page map (orientation only — search this file for a title below to
// jump to that spot in the HTML string constant further down):
//   Title: "Oxira – Charity & Non-Profit Framer Template"
//   Nav: Impact (./#impact) · Why Us (./#why-us) · About (./about-us) · Projects (./projects) · Contact (./contact) · Medical Aid & Health Camps (./projects/medical-aid-health-camps) · Nutrition Support for Batches (./projects/daily-meal-program) · Shiksha Support Drive (./projects/education-support-drive) · Winter Relief Program (./projects/winter-relief-program) · FAQ (./#faq-s) · Terms & Conditions (./privacy) · Terms of Use (./terms-of-use) · How It Works (./#how-it-works)
//   Sections: h1 "Projects That Create Real Change" · h1 "Projects That Create Real Change" · h2 "We’ve seen lives change when people come together, One meal, one family, one ste" · h2 "We’ve seen lives change when people come together, One meal, one family, one ste" · h2 "We’ve seen lives change when people come together, One meal, one family, one ste" · h3 "100k+" · h3 "100k+" · h3 "100k+"

import { listPublicFieldProjects } from "@/lib/field-projects";
import { serveFramerPage } from "@/lib/framer-page";
import { fillProjectCards } from "@/lib/project-cards";
import { applyProjectCopy } from "@/lib/project-copy";
import { inlineFieldProjects } from "@/lib/public-cache";

// Cards are filled from Postgres here (and inline for the browser pass);
// admin project saves revalidate this page.
export const revalidate = 3600;

export async function GET() {
  const projects = await listPublicFieldProjects();
  return serveFramerPage("projects", (html) =>
    inlineFieldProjects(applyProjectCopy(fillProjectCards(html, projects)), projects)
  );
}
