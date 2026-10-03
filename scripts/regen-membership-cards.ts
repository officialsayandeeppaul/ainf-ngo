import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderBackSvg, renderFrontSvg } from "../lib/membership-card-art";

for (const reg of ["AINF-2026-0001", "AINF-2026-0002"]) {
  const dir = path.join("public", "ilove-pdf", reg);
  mkdirSync(dir, { recursive: true });
  const frontPath = path.join(dir, "front.svg");
  const frontOld = existsSync(frontPath) ? readFileSync(frontPath, "utf8") : "";
  const match = /card\/verify\?c=([^"'<\s]+)/.exec(frontOld);
  const token = match?.[1] ?? "abcdefghijklmnopqrstuvwx";
  const verifyUrl = `http://localhost:3000/card/verify?c=${token}`;
  let photoUrl: string | null = null;
  const photoPath = path.join(dir, "photo.jpg");
  if (existsSync(photoPath)) {
    photoUrl = `data:image/jpeg;base64,${readFileSync(photoPath).toString("base64")}`;
  }
  const art = {
    name: reg === "AINF-2026-0001" ? "SAYANDEEP PAUL" : "MEMBER",
    fatherName: "—",
    regNo: reg,
    address: "—",
    designation: "Friend of AINF",
    mobile: "—",
    photoUrl,
    verifyUrl,
    issuedLabel: "03 Sep 2026",
    expiresLabel: "04 Oct 2026",
  };
  writeFileSync(path.join(dir, "front.svg"), renderFrontSvg(art));
  writeFileSync(path.join(dir, "back.svg"), renderBackSvg({ regNo: reg, verifyUrl }));
  console.log("rewrote", reg, photoUrl ? "with photo" : "empty slot");
}
