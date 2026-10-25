/**
 * Field photos that replace the Hopper template's stock imagery.
 *
 * Shared by the server-side HTML pass (lib/framer-page.ts, lib/project-page.ts)
 * and the in-page image guard (lib/image-guard.ts), so the photo a slot shows
 * in the served HTML is the same one it shows after Framer re-renders it.
 */

/** Hopper stock and green placeholder textures. First paint must be field photos. */
export const FIELD_PHOTOS: Record<string, string> = {
  "/assets/img/0487bff6130e818d.webp": "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/d192de88013602fb.webp": "/assets/img/hero-third/4a27119994acc349.webp",
  "/assets/img/b5b56d9dac67f37b.webp": "/assets/img/hero-third/1b892b571234582c.webp",
  "/assets/img/0a0f47967bab9e6d.webp": "/assets/img/hero-third/97kub697kub697ku.webp",
  "/assets/img/44e14d52cea980eb.webp": "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
  "/assets/img/0857298f70c123c5.webp": "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/6c95afd2aa3c890c.webp": "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/e2a751b041c6c192.webp": "/assets/img/home-sixth/83d7f3cef733d28c.webp",
  "/assets/img/78ea5a23abe80a75.webp": "/assets/img/home-sixth/ce25dc676c029d0e.webp",
  "/assets/img/352a75abd7f4e260.webp": "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
  "/assets/img/b1b56374785c59d9.webp": "/assets/img/7d52ebcc5c881e07.webp",
  "/assets/img/7d66b1c9fbde3d23.webp": "/assets/img/46ca7b057fe54d13.webp",
  "/assets/img/e8fe459b69dfaec5.webp": "/assets/img/1d477190300d27a6.webp",
  "/assets/img/1bbfd4c5ea913fd5.webp": "/assets/img/7fb7552621c79350.webp",
  "/assets/img/83d7f3cef733d28c.webp": "/assets/img/hero-third/571e61ddc71daaf0.webp",
  "/assets/img/9a7dcfc123be0a1d.webp": "/assets/img/people/imran-ansari.webp",
  "/assets/img/bfbb8033078ef4ec.webp": "/assets/img/people/amit-hazra.webp",
  "/assets/img/5d4f22904b272be4.webp": "/assets/img/people/birsa-murmu.webp",
  "/assets/img/76cc0f24d728b77e.webp": "/assets/img/people/ravi-hembram.webp",
  "/assets/img/36be58b3f0aa6698.webp": "/assets/img/people/imran-ansari.webp",
  "/assets/img/479af4ed1ca6b4fe.webp": "/assets/img/people/amit-hazra.webp",
  "/assets/img/home-sixth/1fd7ff27ace510a1.webp": "/assets/img/home-sixth/ce25dc676c029d0e.webp",
  "/assets/img/f425f98d63a816cb.webp": "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/e04b2b629278096d.webp": "/assets/img/hero-third/4a27119994acc349.webp",
  "/assets/img/bd505e9df8be5ad6.webp": "/assets/img/hero-third/1b892b571234582c.webp",
  "/assets/img/044b758cc6c7b6ed.webp": "/assets/img/hero-third/97kub697kub697ku.webp",
  "/assets/img/f4fba5e30fcc3d0e.webp": "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
  "/assets/img/f7bb1c851e6c3805.webp": "/assets/img/hero-third/1b0ac308d87a6dbd.webp",
  "/assets/img/b101906ab3a6b5c6.webp": "/assets/img/7d52ebcc5c881e07.webp",
  "/assets/img/ca7ebd72f33229a1.webp": "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
  "/assets/img/155118808d02a13b.webp": "/assets/img/home-sixth/83d7f3cef733d28c.webp",
  "/assets/img/58ddd402fa0fc24e.webp": "/assets/img/people/birsa-murmu.webp",
  "/assets/img/667a7de97aa3c5df.webp": "/assets/img/people/ravi-hembram.webp",
  "/assets/img/0cb36a2e191493c5.webp": "/assets/img/people/imran-ansari.webp",
  "/assets/img/124a9e9812a2f717.webp": "/assets/img/people/amit-hazra.webp",
  "/assets/img/home-fifth/667a7de97aa3c5df.webp": "/assets/img/people/birsa-murmu.webp",
  "/assets/img/home-fifth/0cb36a2e191493c5.webp": "/assets/img/people/ravi-hembram.webp",
  "/assets/img/home-fifth/58ddd402fa0fc24e.webp": "/assets/img/people/imran-ansari.webp",
  "/assets/img/home-fifth/74f91bf4bd093efb.webp": "/assets/img/people/amit-hazra.webp",
};

export const FIELD_POOL = [
  "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/hero-third/4a27119994acc349.webp",
  "/assets/img/hero-third/1b892b571234582c.webp",
  "/assets/img/hero-third/97kub697kub697ku.webp",
  "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
  "/assets/img/hero-third/1b0ac308d87a6dbd.webp",
  "/assets/img/hero-third/571e61ddc71daaf0.webp",
  "/assets/img/home-sixth/ce25dc676c029d0e.webp",
  "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
  "/assets/img/home-sixth/83d7f3cef733d28c.webp",
  "/assets/img/7d52ebcc5c881e07.webp",
  "/assets/img/46ca7b057fe54d13.webp",
  "/assets/img/1d477190300d27a6.webp",
  "/assets/img/7fb7552621c79350.webp",
];

/** A src already showing one of our own field or people photos. */
export const FIELD_OK =
  /518fb7f61a5e6510|4a27119994acc349|ce25dc676c029d0e|1b892b571234582c|97kub697kub697ku|9fzzlw9fzzlw9fzz|1b0ac308d87a6dbd|571e61ddc71daaf0|395d6ceebb97e0ae|home-sixth\/83d7f3cef733d28c|7d52ebcc5c881e07|46ca7b057fe54d13|1d477190300d27a6|7fb7552621c79350|\/people\/(?:imran-ansari|amit-hazra|birsa-murmu|ravi-hembram)/;

/** Image roles (Framer alt text) that carry a content photo rather than a texture or icon. */
export const CONTENT_ALTS = [
  "Cause Image",
  "Missions Image",
  "Blog Image",
  "Gallery Image",
  "Team Image",
  "Ticker Image",
  "CTA Image",
  "About Image",
  "About Hero Image",
  "Testimonial Image",
  "Join as Field Sevak Image",
  "How you can help image",
  "Statastic Image Left",
  "Statastic Image Right",
  "man in black and white adidas hoodie",
  "shallow focus photography of woman outdoor during day",
  "woman in blue crew neck shirt",
  "two men wearing masks and holding a bag of food",
];

/** Testimonial and team portraits, keyed by the name shown on the card. */
export const PEOPLE_PHOTOS: Record<string, string> = {
  "Imran Ansari": "/assets/img/people/imran-ansari.webp",
  "Amit Hazra": "/assets/img/people/amit-hazra.webp",
  "Birsa Murmu": "/assets/img/people/birsa-murmu.webp",
  "Ravi Hembram": "/assets/img/people/ravi-hembram.webp",
};
