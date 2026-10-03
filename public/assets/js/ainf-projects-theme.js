/* Projects-only polish: INR currency, piggy raised badges, solid CTAs, kill Oxira chrome */
(function () {
  if (window.__ainfProjectsThemeBooted) return;
  window.__ainfProjectsThemeBooted = true;

  var path = (location.pathname || "/").replace(/\/$/, "") || "/";
  var isProjects = path === "/projects" || path.indexOf("/projects/") === 0;
  if (!isProjects) return;

  var PIGGY =
    '<svg class="ainf-piggy" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
    '<path fill="#fff" d="M19.4 10.2c-.3-1.5-1.3-2.7-2.6-3.3.2-.4.3-.8.3-1.2 0-1.3-1-2.3-2.3-2.3-.5 0-1 .2-1.4.5C12.7 3.3 11.9 3 11 3c-1.7 0-3.1 1.2-3.4 2.8C6.4 6.1 5.5 7 5.1 8.1 3.9 8.5 3 9.6 3 11c0 .4.1.8.2 1.2H2v2h1.1c.3 1.1.9 2 1.8 2.6L3.6 18l1.4 1.4 1.4-1.4c.7.3 1.4.5 2.2.5v1.5h2V18.5c.4 0 .8-.1 1.2-.2.5.4 1.1.7 1.8.7.4 0 .8-.1 1.1-.2l1.3 1.3 1.4-1.4-1.2-1.2c.7-.7 1.2-1.6 1.4-2.6H22v-2h-1.3c.2-.4.3-.8.3-1.2 0-.5-.1-1-.3-1.4zM9.5 12.2a1 1 0 110-2 1 1 0 010 2z"/>' +
    "</svg>";

  function looksLikePageContent(el) {
    var t = el.textContent || "";
    return /Our Projects|Winter Relief|Medical Aid|Daily Meal|Education Support|Hear from|Projects That Create|Support a Project|Swasthya|Shiksha|Jamtara|Nala|hamlet/i.test(
      t
    );
  }

  function killOxiraNode(el) {
    if (!el || el.id === "ainf-site-footer") return;
    if (looksLikePageContent(el)) return;
    el.setAttribute("data-ainf-oxira-footer", "1");
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("height", "0", "important");
    el.style.setProperty("max-height", "0", "important");
    el.style.setProperty("overflow", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.style.setProperty("margin", "0", "important");
    el.style.setProperty("padding", "0", "important");
  }

  function isOxiraFooterText(t) {
    return /Through AINF|100k\+|Privacy & Policy|All Rights Reserved|@Oxira|X \/ Twitter|Youtube|Help FAQ|How It Works/i.test(
      t || ""
    );
  }

  function hideOxiraFooterOnly() {
    document.querySelectorAll('[data-framer-name="projects list footer"]').forEach(killOxiraNode);

    document
      .querySelectorAll(
        "footer[data-framer-name='Primary'], footer[data-framer-name='Container'], footer[data-framer-name='Bottom']"
      )
      .forEach(function (el) {
        if (el.id === "ainf-site-footer") return;
        if (looksLikePageContent(el)) return;
        if (isOxiraFooterText(el.textContent)) killOxiraNode(el);
      });

    document.querySelectorAll('[data-framer-name="Bottom"]').forEach(function (el) {
      if (looksLikePageContent(el)) return;
      if (isOxiraFooterText(el.textContent) || /xira|Donate/i.test(el.textContent || "")) {
        killOxiraNode(el);
      }
    });

    document.querySelectorAll("p, span, a, h1, h2, h3, h4").forEach(function (el) {
      if (el.closest && el.closest("#ainf-site-footer, #ainf-global-nav")) return;
      var t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t === "xira" || t === "Oxira" || /^@Oxira/i.test(t)) {
        var wrap =
          el.closest("footer[data-framer-name]") ||
          el.closest('[data-framer-name="Bottom"]') ||
          el.closest("[data-ainf-oxira-footer]") ||
          el;
        killOxiraNode(wrap);
      }
    });
  }

  function convertToInr() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement) continue;
      if (node.parentElement.closest("#ainf-global-nav, #ainf-site-footer, script, style, [data-ainf-bound], [data-ainf-cms]")) continue;
      var v = node.nodeValue;
      if (!v) continue;
      var trimmed = v.trim();
      if (trimmed === "$" || trimmed === "US$" || trimmed === "USD") {
        node.nodeValue = v.replace(trimmed, "₹");
        continue;
      }
      if (/\$/.test(v) && !/₹/.test(v)) {
        node.nodeValue = v.replace(/\$/g, "₹");
      }
    }
  }

  function injectPiggyIcons() {
    // ONLY raised-amount badges (Icon & title). Never status dots / hero spheres.
    document
      .querySelectorAll('[data-framer-name="Icon & title"] > [data-framer-name="Icon Sphere"]')
      .forEach(function (sphere) {
        if (sphere.getAttribute("data-ainf-piggy") === "1") return;
        // Skip status / live indicators even if nested under Icon & title
        var near = (sphere.parentElement && sphere.parentElement.textContent) || "";
        if (/Current Status|:\s*Live/i.test(near) && !/Raised/i.test(near)) return;

        sphere.setAttribute("data-ainf-piggy", "1");
        sphere.style.setProperty("display", "inline-flex", "important");
        sphere.style.setProperty("align-items", "center", "important");
        sphere.style.setProperty("justify-content", "center", "important");
        sphere.style.setProperty("background", "#39a46b", "important");
        sphere.style.setProperty("background-image", "none", "important");
        sphere.style.setProperty("border-radius", "999px", "important");
        sphere.querySelectorAll("svg, img, [data-framer-name]").forEach(function (child) {
          if (child.classList && child.classList.contains("ainf-piggy")) return;
          child.style.setProperty("display", "none", "important");
        });
        if (!sphere.querySelector(".ainf-piggy")) {
          sphere.insertAdjacentHTML("beforeend", PIGGY);
        }
      });
  }

  function restyleButtons() {
    document
      .querySelectorAll('[data-framer-name="Primary btn"], [data-framer-name="btn hover variation"]')
      .forEach(function (btn) {
        if (btn.closest && btn.closest("#ainf-global-nav, #ainf-site-footer")) return;
        btn.style.setProperty("backdrop-filter", "none", "important");
        btn.style.setProperty("-webkit-backdrop-filter", "none", "important");
        btn.style.setProperty("background", "#39a46b", "important");
        btn.style.setProperty("background-color", "#39a46b", "important");
        btn.style.setProperty("background-image", "none", "important");
        btn.style.setProperty("box-shadow", "none", "important");
        btn.style.setProperty("filter", "none", "important");
        btn.style.setProperty("border-radius", "999px", "important");
        btn.style.setProperty("box-sizing", "border-box", "important");
        btn.style.setProperty("padding", "14px 22px", "important");
        btn.style.setProperty("width", "max-content", "important");
        btn.style.setProperty("min-width", "max-content", "important");
        btn.style.setProperty("max-width", "none", "important");
        btn.style.setProperty("height", "52px", "important");
        btn.style.setProperty("overflow", "visible", "important");
        btn.style.setProperty("flex-shrink", "0", "important");
        btn.querySelectorAll('[data-framer-name="content"], [data-framer-name="Join Us On Discord"], p, span').forEach(function (part) {
          part.style.setProperty("width", "auto", "important");
          part.style.setProperty("min-width", "max-content", "important");
          part.style.setProperty("max-width", "none", "important");
          part.style.setProperty("white-space", "nowrap", "important");
          part.style.setProperty("overflow", "visible", "important");
        });
        var icon = btn.querySelector('[data-framer-name="Icon"]');
        if (icon) {
          icon.style.setProperty("display", "none", "important");
        }
        btn.querySelectorAll("p, span").forEach(function (t) {
          if (t.closest && t.closest('[data-framer-name="Icon"]')) return;
          var label = (t.textContent || "").trim();
          if (label === "Donate now") t.textContent = "Support AINF";
          t.style.setProperty("color", "#fff", "important");
          t.style.setProperty("-webkit-text-fill-color", "#fff", "important");
          t.style.setProperty("font-weight", "400", "important");
          t.style.setProperty("font-style", "normal", "important");
          t.style.setProperty("--framer-font-weight", "400");
        });
      });
  }

  var PROJECT_COPY = [
    ["Projects That Create Real Change", "Projects on the Ground"],
    [
      "Explore our active programs and campaigns focused on food, clean water, healthcare, and education support for families in need.",
      "Live work across Jharkhand and West Bengal — swasthya camps, shiksha kits, meals for batches, winter warmth, and safe water in our hamlets.",
    ],
    ["Medical Aid & Health Camps", "Swasthya Camps"],
    ["Nutrition Support for Batches", "Meals for Coaching Batches"],
    ["Shiksha Support Drive", "Shiksha Kits & Fees"],
    ["Winter Relief Program", "Winter Kits for Our Blocks"],
    ["Clean Water Initiative", "Safe Water in Our Hamlets"],
    [
      "Free medical checkups and essential medicines for underserved communities.",
      "Checkups, referrals, and medicines for families in Nala, Jamtara, and nearby blocks.",
    ],
    [
      "Providing nutritious daily meals to underprivileged children to fight hunger and malnutrition.",
      "A meal with the coaching batch, so hunger never sends a student home before class ends.",
    ],
    [
      "Helping children continue their education by providing books, uniforms, and school supplies.",
      "Books, uniforms, and fees so a child in our blocks does not have to leave class.",
    ],
    [
      "Providing warm clothing and blankets to homeless individuals during winter.",
      "Blankets and warm sets for families in our blocks when the cold sets in.",
    ],
    [
      "Improving access to safe drinking water in rural and underserved communities.",
      "Safe drinking water for hamlets where the source turns bad after the rains.",
    ],
    ["Introduction", "About this work"],
    ["General information about the project and its objectives.", "What this work does in our blocks, and who it is for."],
    ["Impact / Results", "On the ground"],
    ["How This Work", "How this runs"],
    [
      "A simple breakdown of the process we follow to turn support into real-world action.",
      "How a gift becomes work on the ground — with the panchayat, field sevaks, and families in the block.",
    ],
    ["Current Status : Live", "On the ground : Live"],
    ["100% donations used for program", "Every rupee stays on this work"],
    ["Hear from those who've seen the impact.", "From families, sevaks, and partners in our blocks."],
    [
      "We've seen lives change when people come together, One meal, one family, one step at a time.",
      "They work with respect and consistency. Support reaches the right students and families in our blocks, without delays.",
    ],
    [
      "This project brings basic healthcare services directly to people who cannot afford medical treatment or travel long distances to hospitals. Many individuals in underserved communities delay or completely avoid care due to cost, distance, or lack of awareness, which often leads to worsening health conditions.",
      "Swasthya Desk takes checkups and essential medicines to hamlets where the primary health centre is a long ride away. In Nala, Jamtara, and nearby blocks, families often wait until a fever becomes an emergency. A camp, a referral, and a medicine they can actually collect changes that.",
    ],
    [
      "We conduct structured training workshops designed to equip participants with practical, job-ready skills that match current market needs. These workshops focus on both technical abilities and essential soft skills, helping individuals build confidence and competence for the workplace.",
      "Camp dates are fixed with the panchayat, the ANM, and the ASHA, then announced in the hamlet so families know which morning to come.",
    ],
    [
      "Alongside training, we provide ongoing mentorship sessions where participants receive guidance, career advice, and personalized support from experienced professionals. This mentorship helps them set clear goals, overcome challenges, and stay motivated throughout their learning journey.",
      "Field sevaks register families, check vitals, and flag anyone who needs a referral the same day — a child with fever, or a mother late in pregnancy, is not left in the queue.",
    ],
    [
      "To ensure real outcomes, we actively connect participants with employment and internship opportunities through our network of local businesses, organizations, and partners. By bridging the gap between training and employment, the project empowers individuals to achieve sustainable livelihoods and long-term independence.",
      "Doctors and nurses see patients. Essential medicines go home with a simple note. Follow-up cases are linked to the nearest PHC or district hospital, so the camp is not a one-off drop.",
    ],
    ["1,800+ patients treated", "1,800+ patients seen at camps"],
    ["25+ health camps organized", "25+ camps in our blocks"],
    ["120 volunteers involved", "120 field sevaks and local volunteers"],
    [
      "This project keeps coaching-batch students fed, present, and able to sit the next exam — so hunger never ends a school day early.",
      "This desk keeps coaching-batch students fed and present in Jamtara and nearby blocks, so hunger never ends a class before the exam.",
    ],
    [
      "We begin by identifying children and families who are most in need through on-ground surveys, community referrals, and close coordination with local leaders and schools. This helps us reach those who require immediate and consistent nutritional support, ensuring that our efforts are focused where they matter most.",
      "Teachers and field sevaks name the students who leave class hungry. We check that list with the school and the panchayat before a single meal is cooked.",
    ],
    [
      "Once the beneficiaries are identified, we work closely with trusted local partners and community kitchens to prepare fresh, nutritious meals every day. Special care is taken to maintain hygiene, food quality, and balanced nutrition so that every meal contributes positively to a child’s health and growth.",
      "A local kitchen cooks the batch meal the same morning. Portions are simple, hot, and enough for the students sitting that class — not a photo, a plate.",
    ],
    [
      "Finally, our dedicated volunteers distribute these meals daily within the community. Beyond delivering food, they build connections with families, monitor ongoing needs, and ensure that each child receives their meal with dignity and care. This end-to-end approach allows us to create a reliable and compassionate food support system for children in need.",
      "Sevaks serve the meal at the batch, then note who was absent. A missed meal is a missed class, and someone follows up at the home the same day.",
    ],
    ["600+ children supported", "600+ students in our batches"],
    ["Active across 4 communities", "Active in 4 blocks"],
    [
      "This project supports children who are at risk of dropping out of school due to financial difficulties, helping them continue their education without interruption. Many of these children come from vulnerable families where limited income makes it difficult to afford school fees, uniforms, books, or daily necessities.",
      "Shiksha Desk keeps students in class when fees, a uniform, or a set of books would have sent them home. The work sits in our blocks — scholarships, kits, and coaching, not a distant sponsorship.",
    ],
    [
      "We collaborate closely with local schools to understand the challenges faced by students from low-income families. Through regular communication with teachers and school administrators, we identify students who lack access to basic learning resources and are at risk of falling behind due to financial constraints.",
      "We sit with the school and the teacher to see who is about to drop out, and why — fees, a uniform, books, or the bus fare to the coaching batch.",
    ],
    [
      "Once the students in need are identified, we assess their specific requirements, including textbooks, notebooks, uniforms, stationery, and other essential learning materials. This ensures that the support provided is relevant, timely, and aligned with the school’s academic curriculum.",
      "The kit matches that student’s class: books, copies, uniform, and the fee that was blocking admission. It is handed over at the school, with the family present.",
    ],
    ["90% school retention rate", "90% stayed in class"],
    [
      "Many homeless individuals struggle to survive harsh winter nights. This project focuses on providing warmth and care during the coldest months.",
      "Nights in our blocks get cold enough to stop a child reaching school and an elder sleeping. This desk packs blankets and warm sets before that week arrives.",
    ],
    [
      "We begin by collecting donations from individuals, organizations, and community partners who want to support vulnerable people during the harsh winter months. These contributions allow us to carefully plan and fund our winter relief efforts, ensuring resources are used where they are needed most.",
      "Gifts are pooled early, then spent on blankets and warm sets bought for the blocks we already work in — not a general appeal with no address.",
    ],
    [
      "Using the collected funds and in-kind donations, we procure essential winter supplies such as warm clothing, blankets, jackets, socks, and other protective items. All items are selected with durability and comfort in mind, so they provide meaningful protection against the cold.",
      "Each set is a blanket, a warm layer, and socks a family can use through the season. Field sevaks deliver them house to house with the panchayat list.",
    ],
    ["700+ people supported", "700+ people in our blocks"],
    ["Covered 6 high-risk areas", "Covered 6 blocks through the cold"],
    [
      "This project focuses on reducing waterborne diseases by providing sustainable access to clean and safe drinking water in villages with limited or unreliable water sources. Many of these communities rely on contaminated water, leading to frequent illnesses that especially affect children and the elderly.",
      "After the rains, several hamlets in our blocks drink from a source that makes children sick. This desk repairs or filters that source so the illness does not become the season’s habit.",
    ],
    [
      "We begin by carefully assessing existing water sources within each community to understand contamination levels, availability, and seasonal challenges. This assessment helps us determine the most effective and suitable solution for providing safe drinking water.",
      "We walk the source with the hamlet — the well, the handpump, the pond — and see what fails in summer and what turns bad after the monsoon.",
    ],
    [
      "Based on these findings, we install appropriate water purification systems such as filtration units, treatment plants, or other clean-water technologies tailored to local conditions. Each system is designed to be reliable, cost-effective, and capable of serving the community over the long term.",
      "The fix is the one the hamlet can run: a filter, a repaired handpump, or a tank they already know how to clean. A sevak checks it through the season.",
    ],
    ["8 villages served", "8 hamlets served"],
    ["2,500+ people benefited", "2,500+ people in these hamlets"],
    ["60% reduction in water-related illness", "Fewer children falling ill from the water"],
    [
      "We work closely with local partners to deliver support directly, quickly, and with complete responsibility.",
      "We sit with the panchayat, the school, the ASHA, and the ANM so the work arrives directly and stays accountable.",
    ],
    [
      "We focus on urgent cases first, making sure help reaches the right people at the right time without unnecessary delays.",
      "A fever, a child about to leave school, or a cold night without a blanket goes first. Nobody waits for a campaign photo.",
    ],
    [
      "We believe support should always be given with dignity, respect, and compassion, so every family feels seen and valued.",
      "Help is given with dignity. No one in the hamlet is made to feel small for needing it.",
    ],
  ];

  function plainCopy(el) {
    return (el.textContent || "")
      .replace(/[\u2019\u2018]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function indianizeCopy() {
    var table = {};
    var changed = false;
    PROJECT_COPY.forEach(function (pair) {
      table[pair[0].replace(/[\u2019\u2018]/g, "'")] = pair[1];
    });
    document.querySelectorAll("h1, h2, h3, h4, p, li").forEach(function (el) {
      if (el.getAttribute("data-ainf-cms") === "1") return;
      if (el.closest && el.closest("#ainf-global-nav, #ainf-site-footer")) return;
      if (el.querySelector("h1, h2, h3, h4, p, li")) return;
      var now = plainCopy(el);
      var next = table[now];
      if (!next || next === now) return;
      el.textContent = next;
      changed = true;
    });
    if (changed && window.__ainfReapplyLang) window.__ainfReapplyLang();
    var titles = {
      "Medical Aid & Health Camps": "Swasthya Camps",
      "Nutrition Support for Batches": "Meals for Coaching Batches",
      "Shiksha Support Drive": "Shiksha Kits & Fees",
      "Winter Relief Program": "Winter Kits for Our Blocks",
      "Clean Water Initiative": "Safe Water in Our Hamlets",
      "Projects on the Ground": "Projects on the Ground",
    };
    Object.keys(titles).forEach(function (oldTitle) {
      if (document.title.indexOf(oldTitle) === 0) {
        document.title = titles[oldTitle] + " | theainf.in";
      }
    });
  }

  function rebrandCopy() {
    var map = [
      ["Ostra Supporter", "AINF Supporter"],
      ["Volunteer at Ostra", "Volunteer at AINF"],
      ["Ostra,", "AINF,"],
      ["Ostra", "AINF"],
      ["@Oxira 2026", "© 2026 theainf"],
      ["Oxira", "AINF"],
      ["Donate now", "Support AINF"],
    ];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement) continue;
      if (node.parentElement.closest("#ainf-global-nav, #ainf-site-footer, script, style")) continue;
      var v = node.nodeValue;
      if (!v) continue;
      var next = v;
      map.forEach(function (pair) {
        if (next.indexOf(pair[0]) >= 0) next = next.split(pair[0]).join(pair[1]);
      });
      next = next.replace(/\bOstra\b/gi, "AINF").replace(/\bOxira\b/gi, "AINF");
      if (next !== v) node.nodeValue = next;
    }
  }

  var fieldProjects = null;

  function rupees(label) {
    var raw = String(label || "").replace(/[₹,\s]/g, "").toLowerCase();
    var match = raw.match(/([\d.]+)(k|l|cr)?/);
    if (!match) return 0;
    var value = parseFloat(match[1]);
    if (match[2] === "k") value *= 1000;
    if (match[2] === "l") value *= 100000;
    if (match[2] === "cr") value *= 10000000;
    return value;
  }

  function cardGroups() {
    var groups = [];
    var seen = [];
    document.querySelectorAll('[data-framer-name="Title"]').forEach(function (title) {
      if (title.closest && title.closest("#ainf-global-nav, #ainf-site-footer")) return;
      var node = title;
      var card = null;
      for (var i = 0; i < 12 && node; i++) {
        node = node.parentElement;
        if (!node || !node.querySelector) continue;
        if (!node.querySelector('[data-framer-name="Raised"]') || !node.querySelector('[data-framer-name="Goal"]')) continue;
        if (node.querySelectorAll('[data-framer-name="Title"]').length === 1) card = node;
      }
      if (!card || seen.indexOf(card) >= 0) return;
      seen.push(card);
      var variant = (card.closest && card.closest(".ssr-variant")) || card.parentElement;
      var group = null;
      for (var g = 0; g < groups.length; g++) {
        if (groups[g].root === variant) group = groups[g];
      }
      if (!group) {
        group = { root: variant, cards: [] };
        groups.push(group);
      }
      group.cards.push(card);
    });
    return groups;
  }

  function writeLeaves(root, label) {
    if (!root) return;
    var leaves = [];
    root.querySelectorAll("p, h4, span").forEach(function (el) {
      if (el.querySelector("p, h4, span")) return;
      leaves.push(el);
    });
    if (!leaves.length) {
      if ((root.textContent || "") !== label) root.textContent = label;
      return;
    }
    if ((leaves[0].textContent || "") !== label) leaves[0].textContent = label;
    for (var i = 1; i < leaves.length; i++) {
      if (leaves[i].textContent) leaves[i].textContent = "";
    }
  }

  function writeCaption(block, label) {
    if (!block) return;
    var caption = null;
    var nodes = block.querySelectorAll("p");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].closest && nodes[i].closest('[data-framer-name="Number"]')) continue;
      caption = nodes[i];
      break;
    }
    if (!caption) return;
    var now = (caption.textContent || "").replace(/\s+/g, " ").trim();
    if (now !== label) caption.textContent = label;
    caption.setAttribute("data-ainf-cms", "1");
    caption.style.opacity = "1";
    caption.style.color = "#3d4a44";
  }

  function fillCard(card, project) {
    var titleH4 = card.querySelector('[data-framer-name="Title"] h4');
    if (titleH4) {
      titleH4.setAttribute("data-ainf-cms", "1");
      if (!titleH4.querySelector(".ainf-letter") && (titleH4.textContent || "").replace(/\s+/g, " ").trim() !== project.title) {
        titleH4.textContent = project.title;
      }
    }
    var wroteChip = false;
    card.querySelectorAll("h4").forEach(function (heading) {
      if (heading === titleH4) return;
      var text = (heading.textContent || "").trim();
      if (/^raised$/i.test(text)) return;
      if (!wroteChip) {
        if (text !== project.raisedLabel) heading.textContent = project.raisedLabel;
        wroteChip = true;
      } else if (text) heading.textContent = "";
    });
    writeLeaves(card.querySelector('[data-framer-name="Raised"] [data-framer-name="Number"]'), project.raisedLabel);
    writeLeaves(card.querySelector('[data-framer-name="Goal"] [data-framer-name="Number"]'), project.goalLabel);
    writeCaption(card.querySelector('[data-framer-name="Raised"]'), "Raised :");
    writeCaption(card.querySelector('[data-framer-name="Goal"]'), "Goal :");
    var summary = null;
    var summaryLen = 0;
    card.querySelectorAll("p").forEach(function (paragraph) {
      if (paragraph.closest('[data-framer-name="Raised"], [data-framer-name="Goal"], [data-framer-name="Title"]')) return;
      var len = (paragraph.textContent || "").trim().length;
      if (len > summaryLen) {
        summary = paragraph;
        summaryLen = len;
      }
    });
    if (summary) {
      summary.setAttribute("data-ainf-cms", "1");
      if ((summary.textContent || "").replace(/\s+/g, " ").trim() !== project.summary) summary.textContent = project.summary;
    }
    var href = project.href || "/projects/" + project.slug;
    if (href.charAt(0) !== "/") href = "/" + href.replace(/^\.\//, "");
    card.querySelectorAll("a[href]").forEach(function (link) {
      var current = link.getAttribute("href") || "";
      if (current.indexOf("project") < 0 && current.indexOf("#") !== 0) return;
      if (current !== href) link.setAttribute("href", href);
    });
    var wrap = card.closest && card.closest("a[href]");
    if (wrap) {
      var wrapHref = wrap.getAttribute("href") || "";
      if (wrapHref.indexOf("project") >= 0 && wrapHref !== href) wrap.setAttribute("href", href);
    }
    card.setAttribute("data-ainf-href", href);
    if (!card.getAttribute("data-ainf-bound")) {
      card.setAttribute("data-ainf-bound", "1");
      card.style.cursor = "pointer";
      card.addEventListener("click", function (event) {
        var next = card.getAttribute("data-ainf-href");
        if (!next) return;
        event.preventDefault();
        event.stopPropagation();
        window.location.assign(next);
      });
    }
    var image = null;
    card.querySelectorAll("img").forEach(function (candidate) {
      if (image) return;
      if (candidate.closest && candidate.closest('[data-framer-name="Icon"], [data-framer-name="Icon Sphere"]')) return;
      image = candidate;
    });
    if (image && project.imageUrl) {
      var pinned = project.imageUrl.split("?")[0] + "?ainf=20260927c";
      image.setAttribute("data-ainf-cms", "1");
      image.setAttribute("data-ainf-pin", pinned);
      image.setAttribute("alt", project.title);
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      if ((image.getAttribute("src") || "") !== pinned) image.src = pinned;
      image.style.setProperty("opacity", "1", "important");
      image.style.setProperty("visibility", "visible", "important");
      var frame = image.closest && image.closest("[data-framer-background-image-wrapper]");
      if (frame) {
        frame.style.setProperty("opacity", "1", "important");
        frame.style.setProperty("visibility", "visible", "important");
      }
    }
    var raised = rupees(project.raisedLabel);
    var goal = rupees(project.goalLabel);
    if (goal > 0) {
      var pct = Math.max(4, Math.min(100, Math.round((raised / goal) * 100)));
      card.querySelectorAll("[style*='width']").forEach(function (el) {
        var width = (el.style && el.style.width) || "";
        if (/^\d+(\.\d+)?%$/.test(width) && width !== "100%") el.style.width = pct + "%";
      });
    }
  }

  function applyFieldProjects() {
    if (!fieldProjects || !fieldProjects.length) return;
    if ((location.pathname || "").replace(/\/$/, "") !== "/projects") return;
    var live = fieldProjects.filter(function (project) { return project.published !== false; });
    var groups = cardGroups();
    if (!groups.length || !live.length) return;
    groups.forEach(function (group) {
      var cards = group.cards;
      var template = cards[cards.length - 1];
      while (cards.length < live.length && template && template.parentElement) {
        var clone = template.cloneNode(true);
        clone.removeAttribute("data-ainf-bound");
        template.parentElement.appendChild(clone);
        cards.push(clone);
      }
      cards.forEach(function (card, index) {
        var project = live[index];
        if (!project) {
          if (card.style.display !== "none") card.style.display = "none";
          return;
        }
        if (card.style.display === "none") card.style.display = "";
        fillCard(card, project);
      });
    });
  }

  function detailSlug() {
    var path = (location.pathname || "").replace(/\/$/, "");
    if (path.indexOf("/projects/") !== 0) return "";
    return path.slice("/projects/".length);
  }

  function moneyParts(label) {
    var match = String(label || "").trim().match(/^([^\d]*)(\d[\d,]*)(.*)$/);
    if (!match) return { symbol: "", num: String(label || "").trim(), suffix: "" };
    return { symbol: match[1], num: match[2], suffix: match[3] };
  }

  function paintAmount(name, label) {
    var parts = moneyParts(label);
    document.querySelectorAll('[data-framer-name="' + name + '"]').forEach(function (block) {
      var lines = block.querySelectorAll("p");
      if (lines.length < 3) return;
      if (lines[0].textContent !== parts.symbol) lines[0].textContent = parts.symbol;
      if (lines[1].textContent !== parts.num) lines[1].textContent = parts.num;
      if (lines[2].textContent !== parts.suffix) lines[2].textContent = parts.suffix;
    });
  }

  function summaryAfter(heading) {
    var node = heading;
    for (var depth = 0; depth < 5 && node; depth++) {
      var sib = node.nextElementSibling;
      while (sib) {
        if (sib.tagName === "P") return sib;
        var inner = sib.querySelector && sib.querySelector("p");
        if (inner && !(inner.closest && inner.closest('[data-framer-name="raised"], [data-framer-name="goal"]'))) return inner;
        sib = sib.nextElementSibling;
      }
      node = node.parentElement;
    }
    return null;
  }

  function applyProjectDetail() {
    var slug = detailSlug();
    if (!slug || !fieldProjects || !fieldProjects.length) return;
    var project = null;
    fieldProjects.forEach(function (row) {
      if (row.slug === slug && row.published !== false) project = row;
    });
    if (!project) return;
    var indian = /518fb7f61a5e6510|4a27119994acc349|ce25dc676c029d0e|1b892b571234582c|97kub697kub697ku|9fzzlw9fzzlw9fzz|1b0ac308d87a6dbd|571e61ddc71daaf0|395d6ceebb97e0ae|home-sixth\/83d7f3cef733d28c|7d52ebcc5c881e07|46ca7b057fe54d13|1d477190300d27a6|7fb7552621c79350|\/people\/(?:imran-ansari|amit-hazra|birsa-murmu|ravi-hembram)/;
    var texture = /96690a270973a763|65e4fe3b71103bc2|f9ae4aecce078de6|2d263d6ae10cc7bd|a95af15c9096fc0a|50cf5ee624cdbe60|d0fdea8216d62e05|dedab43eef2285e1|a344bac9b35c5dea|2dd60ec5f37c748d|562ef86697f4a6b5/;
    var pool = [
      "/assets/img/hero-third/4a27119994acc349.webp",
      "/assets/img/hero-third/1b892b571234582c.webp",
      "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
      "/assets/img/hero-third/1b0ac308d87a6dbd.webp",
      "/assets/img/46ca7b057fe54d13.webp",
      "/assets/img/7fb7552621c79350.webp",
    ].filter(function (url) { return url !== (project.imageUrl || "").split("?")[0]; });
    var card = 0;
    document.querySelectorAll("h1").forEach(function (heading) {
      if (heading.closest && heading.closest("#ainf-global-nav, #ainf-site-footer")) return;
      var text = (heading.textContent || "").replace(/\s+/g, " ").trim();
      heading.setAttribute("data-ainf-cms", "1");
      if (text !== project.title) heading.textContent = project.title;
      var blurb = summaryAfter(heading);
      if (!blurb) return;
      blurb.setAttribute("data-ainf-cms", "1");
      if ((blurb.textContent || "").replace(/\s+/g, " ").trim() !== project.summary) blurb.textContent = project.summary;
    });
    paintAmount("raised", project.raisedLabel);
    paintAmount("goal", project.goalLabel);
    if (document.title.indexOf(project.title) !== 0) document.title = project.title + " | theainf.in";
    document.querySelectorAll("img").forEach(function (img) {
      var src = img.getAttribute("src") || "";
      if (/\.svg($|\?)/i.test(src) || /alt="(?:Back Arrow|Next Arrow|Logo)/i.test(img.outerHTML)) return;
      if (img.closest && img.closest("#ainf-global-nav, #ainf-site-footer")) return;
      var foreign = /framerusercontent\.com/i.test(src) || (!indian.test(src) && !texture.test(src) && /\.(webp|png|jpe?g)/i.test(src));
      var srcset = img.getAttribute("srcset") || "";
      if (!foreign && !srcset) return;
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      var fullBleed = img.getAttribute("fetchpriority") === "high" && !img.getAttribute("sizes");
      var use = fullBleed ? (project.imageUrl || "").split("?")[0] : indian.test(src) ? src.split("?")[0] : pool[card++ % pool.length];
      if (!use) return;
      img.setAttribute("data-ainf-cms", "1");
      img.setAttribute("data-ainf-pin", use);
      if (src.split("?")[0] !== use) img.src = use + "?ainf=20260927c";
    });
  }

  function loadFieldProjects() {
    if (fieldProjects) {
      applyFieldProjects();
      applyProjectDetail();
      return;
    }
    if (window.__ainfProjectsLoading) return;
    window.__ainfProjectsLoading = true;
    fetch("/api/projects", { credentials: "same-origin" })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        fieldProjects = (data && data.projects) || [];
        window.__ainfProjectsLoading = false;
        applyFieldProjects();
        applyProjectDetail();
        if (!window.__ainfProjectsLock && (location.pathname || "").replace(/\/$/, "") === "/projects") {
          var locks = 0;
          window.__ainfProjectsLock = setInterval(function () {
            applyFieldProjects();
            if (++locks > 24) clearInterval(window.__ainfProjectsLock);
          }, 700);
        }
      })
      .catch(function () {
        window.__ainfProjectsLoading = false;
      });
  }

  function tick() {
    hideOxiraFooterOnly();
    convertToInr();
    injectPiggyIcons();
    restyleButtons();
    rebrandCopy();
    indianizeCopy();
    loadFieldProjects();
    if (window.__ainfEnsureSiteFooter) window.__ainfEnsureSiteFooter();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick);
  else tick();
  [500, 1400, 2800, 4200, 5600].forEach(function (ms) {
    setTimeout(tick, ms);
  });

  /* ---- Project page interactive buttons ----------------------------------------- */

  function wireProjectButtons() {
    if (location.pathname.indexOf("/projects/") < 0) return;

    // "Our mission" button → smooth scroll to #our-mission section
    document.querySelectorAll('[data-framer-name="Primary"],[data-framer-name="Primary btn"]').forEach(function (el) {
      var text = (el.textContent || "").trim();
      if (!/^our mission$/i.test(text)) return;
      if (el.getAttribute("data-ainf-wired")) return;
      el.setAttribute("data-ainf-wired", "1");
      el.style.cursor = "pointer";
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var target = document.getElementById("our-mission");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // "Image Gallery" button → open a lightbox with #impact images
    document.querySelectorAll('[data-framer-name="Primary"],[data-framer-name="Primary btn"],[data-framer-name="content"]').forEach(function (el) {
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!/image gallery/i.test(text)) return;
      if (el.getAttribute("data-ainf-wired")) return;
      el.setAttribute("data-ainf-wired", "1");
      el.style.cursor = "pointer";
      el.addEventListener("click", function (e) {
        e.preventDefault();
        openImageGallery();
      });
    });
  }

  function openImageGallery() {
    if (document.getElementById("ainf-gallery-modal")) {
      document.getElementById("ainf-gallery-modal").hidden = false;
      return;
    }

    var impact = document.getElementById("impact");
    var imgs = [];
    if (impact) {
      impact.querySelectorAll("img").forEach(function (img) {
        var src = img.getAttribute("src") || "";
        if (!src || /\.svg($|\?)/i.test(src) || /arrow/i.test(img.getAttribute("alt") || "")) return;
        if (imgs.indexOf(src) < 0) imgs.push(src);
      });
    }
    // Fallback: grab images from the whole page (excluding nav/footer icons)
    if (imgs.length === 0) {
      document.querySelectorAll("img").forEach(function (img) {
        if (img.closest && (img.closest("#ainf-global-nav") || img.closest("#ainf-site-footer"))) return;
        var src = img.getAttribute("src") || "";
        if (!src || /\.svg($|\?)/i.test(src) || /logo|arrow|icon/i.test(img.getAttribute("alt") || "")) return;
        if (imgs.indexOf(src) < 0) imgs.push(src);
      });
    }
    if (!imgs.length) return;

    var current = 0;

    var modal = document.createElement("div");
    modal.id = "ainf-gallery-modal";
    modal.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;";

    var card = document.createElement("div");
    card.style.cssText = "position:relative;max-width:900px;width:100%;display:flex;flex-direction:column;gap:12px;align-items:center;";

    var closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Close gallery");
    closeBtn.style.cssText = "position:absolute;top:-40px;right:0;background:none;border:none;color:#fff;font-size:32px;line-height:1;cursor:pointer;padding:4px 10px;opacity:0.8;";
    closeBtn.addEventListener("click", function () { modal.hidden = true; });

    var imgEl = document.createElement("img");
    imgEl.src = imgs[current];
    imgEl.style.cssText = "max-width:100%;max-height:70vh;object-fit:contain;border-radius:12px;display:block;";
    imgEl.alt = "Gallery image";

    var counter = document.createElement("span");
    counter.style.cssText = "color:#ccc;font-size:13px;font-family:system-ui,sans-serif;";

    function showSlide(idx) {
      current = (idx + imgs.length) % imgs.length;
      imgEl.src = imgs[current];
      counter.textContent = (current + 1) + " / " + imgs.length;
    }
    showSlide(0);

    var controls = document.createElement("div");
    controls.style.cssText = "display:flex;gap:12px;align-items:center;";

    var prev = document.createElement("button");
    prev.textContent = "←";
    prev.setAttribute("aria-label", "Previous");
    prev.style.cssText = "background:rgba(255,255,255,0.12);border:none;color:#fff;font-size:22px;width:44px;height:44px;border-radius:50%;cursor:pointer;";
    prev.addEventListener("click", function () { showSlide(current - 1); });

    var next = document.createElement("button");
    next.textContent = "→";
    next.setAttribute("aria-label", "Next");
    next.style.cssText = "background:rgba(255,255,255,0.12);border:none;color:#fff;font-size:22px;width:44px;height:44px;border-radius:50%;cursor:pointer;";
    next.addEventListener("click", function () { showSlide(current + 1); });

    controls.appendChild(prev);
    controls.appendChild(counter);
    controls.appendChild(next);

    card.appendChild(closeBtn);
    card.appendChild(imgEl);
    card.appendChild(controls);
    modal.appendChild(card);
    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) {
      if (e.target === modal) modal.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") modal.hidden = true;
      if (e.key === "ArrowLeft") showSlide(current - 1);
      if (e.key === "ArrowRight") showSlide(current + 1);
    });
  }

  var moTimer = 0;
  var mo = new MutationObserver(function () {
    if (moTimer) return;
    moTimer = setTimeout(function () {
      moTimer = 0;
      hideOxiraFooterOnly();
      convertToInr();
      injectPiggyIcons();
      restyleButtons();
      indianizeCopy();
      loadFieldProjects();
      wireProjectButtons();
    }, 220);
  });
  function observeBody() {
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) observeBody();
  else document.addEventListener("DOMContentLoaded", observeBody);
  [800, 1600, 2800].forEach(function (ms) { setTimeout(wireProjectButtons, ms); });
  setTimeout(function () {
    mo.disconnect();
  }, 4500);
})();
