export type ProjectDetail = {
  howEyebrow: string;
  howIntro: string;
  howParagraphs: [string, string, string];
  missionEyebrow: string;
  missionTitle: string;
  missionPoints: [string, string, string];
  missionImage: string;
  impactTitle: string;
  impactPoints: [string, string, string, string];
  galleryImage: string;
};

const HEALTH = "/assets/img/hero-third/4a27119994acc349.webp";
const CAMP = "/assets/img/46ca7b057fe54d13.webp";
const MEAL = "/assets/img/hero-third/1b0ac308d87a6dbd.webp";
const CLASS = "/assets/img/hero-third/97kub697kub697ku.webp";
const STUDENTS = "/assets/img/7fb7552621c79350.webp";
const GROUP = "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp";
const WATER = "/assets/img/hero-third/571e61ddc71daaf0.webp";
const WOMEN = "/assets/img/hero-third/1b892b571234582c.webp";
const HAND = "/assets/img/home-sixth/ce25dc676c029d0e.webp";

function detail(
  howIntro: string,
  howParagraphs: [string, string, string],
  missionTitle: string,
  missionPoints: [string, string, string],
  impactTitle: string,
  impactPoints: [string, string, string, string],
  missionImage: string,
  galleryImage: string
): ProjectDetail {
  return {
    howEyebrow: "How this works",
    howIntro,
    howParagraphs,
    missionEyebrow: "Our mission",
    missionTitle,
    missionPoints,
    missionImage,
    impactTitle,
    impactPoints,
    galleryImage,
  };
}

const DETAILS: Record<string, ProjectDetail> = {
  "medical-aid-health-camps": detail(
    "A camp day in the block, from the register at the desk to the medicine in a family's hand.",
    [
      "The desk opens in the hamlet. Families give their names, and a sevak notes who needs a checkup first.",
      "The team checks, explains the result in the language of the block, and writes a referral when the camp cannot finish the care.",
      "Medicines for that day are handed over before the team leaves, and a sevak keeps the names that need a follow-up.",
    ],
    "Care that reaches the hamlet, so a family does not have to spend the day getting to a hospital.",
    [
      "Checkups in Nala, Jamtara, and the blocks around them.",
      "A referral and a clear next step when the camp is not enough.",
      "Medicines and a follow-up, not a visit that ends at the gate.",
    ],
    "What a camp day changes",
    [
      "Families seen in their own block",
      "Checkups and referrals on the same day",
      "Medicines handed over before the team leaves",
      "A sevak who stays in touch after the camp",
    ],
    HEALTH,
    CAMP
  ),
  "daily-meal-program": detail(
    "A meal with the coaching batch, before the class ends and the walk home begins.",
    [
      "The batch sits together. The meal is part of the class, not a separate queue at the end of the day.",
      "A sevak notes who was there, so a student who misses the meal is not missed the next day.",
      "The point is simple: hunger should not send a student home before the class is over.",
    ],
    "A full class, because no one leaves early from an empty stomach.",
    [
      "A meal with the coaching batch in the block.",
      "The same students, the same hour, so the meal is not a one-day event.",
      "A sevak who notices who did not eat.",
    ],
    "What the meal is for",
    [
      "Students who stay through the class",
      "A meal served with the batch",
      "A note when someone misses it",
      "Hunger kept out of the walk home",
    ],
    MEAL,
    STUDENTS
  ),
  "education-support-drive": detail(
    "Books, a uniform, and the fee, so a child in the block can stay in class.",
    [
      "A sevak sits with the family and writes what is actually missing: the book, the uniform, or the fee.",
      "The support goes to that need. It is not a general kit that misses the reason the child might leave.",
      "The school year is the measure. A child who starts the term should still be in class when it ends.",
    ],
    "A child stays in class because the missing thing was named and met.",
    [
      "Books, uniforms, and fees for children in our blocks.",
      "The list comes from the family and the school, not from a guess.",
      "A sevak checks back that the child is still on the roll.",
    ],
    "What the drive keeps in place",
    [
      "A named need, not a general kit",
      "Books, uniforms, and fees",
      "Children who remain on the roll",
      "A sevak who checks the term",
    ],
    CLASS,
    STUDENTS
  ),
  "winter-relief-program": detail(
    "Blankets and warm sets, delivered in the block before the cold nights set in.",
    [
      "The list is of families in the block, starting with those who have the least cover at night.",
      "The kits are handed over at the door, and a sevak ticks the name so the same house is not missed or counted twice.",
      "The aim is a warmer night in that house, not a pile of blankets left at a gate.",
    ],
    "A warmer night in the houses that need it first.",
    [
      "Blankets and warm sets for families in our blocks.",
      "Delivery at the door, with the name ticked.",
      "The cold nights are the deadline, not a later distribution.",
    ],
    "What the kit is for",
    [
      "Families with the least cover",
      "A kit handed over at the door",
      "Names ticked, not guessed",
      "Warmth in place before the cold sets in",
    ],
    GROUP,
    HAND
  ),
  "clean-water-initiative": detail(
    "Safe water for hamlets where the source turns bad after the rains.",
    [
      "A sevak checks the source the families are actually using, not the one on an old map.",
      "The fix is what that hamlet needs: a repaired point, a filter, or water carried for the days the source is bad.",
      "Someone in the hamlet knows who to call when the water turns again.",
    ],
    "Water a family can use, from the source they already walk to.",
    [
      "Hamlets where the source turns after the rains.",
      "A check of the real source, then a repair or a filter.",
      "A person in the hamlet who can report when it fails.",
    ],
    "What changes at the source",
    [
      "The source families already use",
      "A repair, a filter, or water for the bad days",
      "A name in the hamlet to call",
      "Fewer days of water no one should drink",
    ],
    WATER,
    HEALTH
  ),
  "rozgar-desk": detail(
    "Skill sessions and employer meets in the block, so a student leaves with a lead.",
    [
      "The session is in the block, on a skill a local employer has asked for.",
      "An employer meet follows, with names written down and a date for the next conversation.",
      "A certificate is not the end. A sevak asks whether the lead became work.",
    ],
    "A job lead in the block, not only a certificate at the end of a class.",
    [
      "Sessions built around work that exists nearby.",
      "An employer meet with names and a next date.",
      "A follow-up that asks whether the lead became work.",
    ],
    "What the desk is for",
    [
      "Skills a nearby employer can use",
      "A meet, not only a class",
      "Names written for the next conversation",
      "A check on whether the lead became work",
    ],
    WOMEN,
    STUDENTS
  ),
};

const GENERIC = detail(
  "What happens in the block, from the first step to the follow-up.",
  [
    "A sevak starts with the families this project is for and writes the first step.",
    "The work happens in the block, in the language people use there.",
    "Someone goes back and checks that the help reached the house it was meant for.",
  ],
  "Help that reaches the block it was promised to.",
  [
    "The work happens where the families live.",
    "A named step, and a person responsible for it.",
    "A follow-up, so the visit is not the end of the story.",
  ],
  "What this project changes",
  ["A clear first step", "Work done in the block", "A person who follows up", "A result a family can point to"],
  GROUP,
  HAND
);

export function detailFor(slug: string): ProjectDetail {
  return DETAILS[slug] ? structuredClone(DETAILS[slug]) : structuredClone(GENERIC);
}

function asLines(value: unknown, count: number, fallback: string[]): string[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => {
    const line = source[index];
    return typeof line === "string" && line.trim() ? line.trim() : fallback[index];
  });
}

export function normalizeDetail(value: unknown, slug: string): ProjectDetail {
  const base = detailFor(slug);
  if (!value || typeof value !== "object") return base;
  const row = value as Partial<ProjectDetail>;
  const text = (item: unknown, fallback: string) => (typeof item === "string" && item.trim() ? item.trim() : fallback);
  return {
    howEyebrow: text(row.howEyebrow, base.howEyebrow),
    howIntro: text(row.howIntro, base.howIntro),
    howParagraphs: asLines(row.howParagraphs, 3, base.howParagraphs) as ProjectDetail["howParagraphs"],
    missionEyebrow: text(row.missionEyebrow, base.missionEyebrow),
    missionTitle: text(row.missionTitle, base.missionTitle),
    missionPoints: asLines(row.missionPoints, 3, base.missionPoints) as ProjectDetail["missionPoints"],
    missionImage: text(row.missionImage, base.missionImage),
    impactTitle: text(row.impactTitle, base.impactTitle),
    impactPoints: asLines(row.impactPoints, 4, base.impactPoints) as ProjectDetail["impactPoints"],
    galleryImage: text(row.galleryImage, base.galleryImage),
  };
}
