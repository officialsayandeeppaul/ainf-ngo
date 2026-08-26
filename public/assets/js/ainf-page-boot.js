/* Preserve Framer letter animations. Fix mashed copy only when spans are already gone. */
(function () {
  if (window.__ainfPageBootBooted) return;
  window.__ainfPageBootBooted = true;

  document.documentElement.classList.add("ainf-ready");
  document.documentElement.classList.remove("ainf-booting");

  var TITLE_FIXES = [
    [/^Bringing Hopeto Those WhoNeed It Most\.?$/i, "Building Opportunity Across Jharkhand & West Bengal"],
    [/^Bringing Hopeto Those Who Need It Most\.?$/i, "Building Opportunity Across Jharkhand & West Bengal"],
    [/^Bringing Hope to Those Who Need It Most\.?$/i, "Building Opportunity Across Jharkhand & West Bengal"],
    [/^Educationfor Every Child$/i, "Shiksha Desk — Every Child Deserves a Classroom"],
    [/^Education for Every Child$/i, "Shiksha Desk — Every Child Deserves a Classroom"],
    [/^Food&Nutritionforfamilies$/i, "Rozgar & Skills Desk — Jobs, Not Just Relief"],
    [/^Food & Nutrition for families$/i, "Rozgar & Skills Desk — Jobs, Not Just Relief"],
    [/^Healthcarefor All$/i, "Swasthya Desk — Care Closer to Home"],
    [/^Healthcare for All$/i, "Swasthya Desk — Care Closer to Home"],
    [/^Water&Sanitationforhealth$/i, "Janajati Sahyog & Kheti Desk"],
    [/^Water & Sanitation for health$/i, "Janajati Sahyog & Kheti Desk"],
    [/^Women Empowermentforrise$/i, "Nari Suraksha Desk — Safety First, Dignity Always"],
    [/^Women Empowerment for rise$/i, "Nari Suraksha Desk — Safety First, Dignity Always"],
    [/^ADayinthe Lifeof Our Volunteers$/i, "A Block Day With AINF Field Sevaks"],
    [/^A Day in the Life of Our Volunteers$/i, "A Block Day With AINF Field Sevaks"],
    [/^Simple Waysto Make Impact On Community$/i, "Small Acts, Big Ripple in Your Panchayat"],
    [/^Simple Ways to Make Impact On Community$/i, "Small Acts, Big Ripple in Your Panchayat"],
    [/^Donate\.Impact\.Transform Lives\.?$/i, "Give With Purpose. See Impact on the Ground."],
    [/^Donate\. Impact\.Transform Lives\.?$/i, "Give With Purpose. See Impact on the Ground."],
    [/^Stand With Studentsin Your District$/i, "Stand With Students in Your District"],
    [/^Terms&Conditions$/i, "Terms & Conditions"],
    [/^From Education to Employment,Opportunity for Every Youth$/i, "From Education to Employment, Opportunity for Every Youth"],
    [/^From Shiksha to Employment,Opportunity for Every Youth$/i, "From Shiksha to Employment, Opportunity for Every Youth"],
  ];

  var QUOTE_FIXES = [
    [
      "weveseenliveschangewhenpeoplecometogetheronemealonefamilyonestepatatime",
      "We've seen paths change when a stipend, a skill kit, and a sevak show up together — one student, one job, one family at a time.",
    ],
    [
      "weveseenpathschangewhenastipendaskillkitandasevakshowuptogetheronestudentonejobonefamilyatatime",
      "We've seen paths change when a stipend, a skill kit, and a sevak show up together — one student, one job, one family at a time.",
    ],
    [
      "theyworkwithrespectandconsistencythesupportreachestherightpeoplewithoutdelays",
      "They work with respect and consistency. Support reaches the right students and families, without delays.",
    ],
    [
      "theteamisorganizedandtransparentwedistributemealsdirectlyandyoucanseeinstantlyhowitworks",
      "The team is organized and transparent. Every rupee is tagged to a desk, and you can see where it lands.",
    ],
    [
      "weareapurposedrivennonprofitorganizationcommittedtocreatingmeaningfulchangeinthelivesofunderservedcommunities",
      "All Indian Nevarlands Foundation walks with learners and families from Jamtara outward — classrooms, skill labs, health camps, and fair work under one roof.",
    ],
    [
      "weareanonprofitorganizationdedicatedtoupliftingcommunitiesthrougheducationhealthcareandsustainablesupport",
      "AINF is a Section 8 non-profit from Nala, Jamtara — education, skills, jobs, healthcare, farming, and tribal welfare across Jharkhand and West Bengal.",
    ],
    [
      "weareapassionatenonprofitorganizationcommittedtomakingameaningfuldifferenceinthelivesofthoseinneed",
      "AINF is a Section 8 non-profit from Jamtara — classrooms, skill labs, and job pathways across Jharkhand and West Bengal.",
    ],
    [
      "joinourcommunityofpassionatevolunteersandhelpuscreaterealimpactwhereitmattersmost",
      "Coach exam batches, host skill weekends, or sit in placement cells with AINF. Even two hours help if one student finds direction.",
    ],
    [
      "therearemanywaysyoucansupportourmissionandhelpuscreatelastingchange",
      "Give to a desk, join as a field sevak, or share theainf.in — every hour and every rupee reaches a student or family in our blocks.",
    ],
    [
      "shareourmissionwithyourfriendsandfamilytohelpusreachmorepeopleandgrowourimpact",
      "Share theainf.in in your group — one forward can connect a youth to coaching or a job lead.",
    ],
    [
      "wevalueyourtrusthereyoullfindhonestanswersabouthowyourdonationsareusedtoempowerlivesandcreatelastingchange",
      "Section 8 rules are clear — read where donations go, which account handles them, and how to volunteer.",
    ],
    [
      "yourfinancialsupporthelpsusprovidefoodeducationhealthcaretothosewhoneedit",
      "Your gift covers stipends, study kits, counselling, and emergency relief — delivered straight to students and families.",
    ],
    [
      "giveyourtimeandskillstosupportourinitiativesanddirectlyimpactlivesinyourcommunity",
      "Coach exam batches, host skill weekends, or sit in placement cells with AINF. Even two hours help if one student finds direction.",
    ],
    [
      "supportaspecificprogramorindividualseeexactlyhowyourcontributionismakingadifference",
      "Pick a Shiksha desk, rozgar cell, nari desk, swasthya van, kheti unit, or janajati desk to adopt.",
    ],
    [
      "supportaspecificprogramseeexactlyhowyourcontributionismakingadifference",
      "Pick a Shiksha desk, rozgar cell, nari desk, swasthya van, kheti unit, or janajati desk to adopt.",
    ],
    [
      "testimonialssharestoriesofgratitudetransformationandpersonalpositiveexperiences",
      "Students, field sevaks, and partners from Asansol to Jamtara — straight talk on learning, landing work, and earning dignity.",
    ],
    [
      "ourmissionistohelppeopleinneed",
      "AINF desks deliver coaching, skills, health camps, and farm support where students and families need them most.",
    ],
    [
      "weprovidenutritiousmealscleanwaterandbasiccaretochildrenandfamilieswhoarestrugglingtomeetdailyneeds",
      "From Jamtara outward we fund study kits, skill labs, swasthya camps, and kheti inputs — tracked rupee by rupee.",
    ],
    [
      "providingnutritiousdailymealstounderprivilegedchildrentofighthungerandmalnutrition",
      "AINF Shiksha Desk keeps students in class with meal support, travel stipends, and study kits in our blocks.",
    ],
    [
      "ainfisasection8nonprofitorganizationdedicatedtoeducationhealthcaresupport",
      "AINF is a Section 8 non-profit — education, skills, healthcare, and dignified livelihoods across Jharkhand and West Bengal.",
    ],
    [
      "throughainfournonprofitcharityfoundationwehavehelpedmorethan100kpeopleinneed",
      "AINF walks with students and families across Jharkhand and West Bengal — coaching, skills, health, and farm support under one roof.",
    ],
    [
      "mealdistributedforpoorfamilies",
      "Coaching batches funded for students in our blocks",
    ],
    [
      "coachingbatchesfundedforstudentsinourblocks",
      "Coaching batches funded for students in our blocks",
    ],
  ];

  function compactKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[\u2019']/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function applyQuoteFixes(text) {
    var key = compactKey(text);
    for (var i = 0; i < QUOTE_FIXES.length; i++) {
      if (key === QUOTE_FIXES[i][0] || key.indexOf(QUOTE_FIXES[i][0]) === 0) {
        return QUOTE_FIXES[i][1];
      }
    }
    return text;
  }

  function fixPlainCopy(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll("p, h1, h2, h3, h4, li, figcaption, blockquote");
    nodes.forEach(function (el) {
      if (el.closest && el.closest("#ainf-global-nav, #ainf-site-footer, [id^='ainf-lang-switcher']")) return;
      if (letterSpanCount(el) >= 4) return;
      var text = plainTextWithBreaks(el);
      if (!text || text.length < 8) return;
      var next = applyQuoteFixes(text);
      if (next && next !== text) el.textContent = next;
    });
  }

  function plainTextWithBreaks(el) {
    var text = "";
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        text += node.nodeValue || "";
        return;
      }
      if (node.nodeName === "BR") {
        text += " ";
        return;
      }
      var kids = node.childNodes || [];
      for (var i = 0; i < kids.length; i++) walk(kids[i]);
    }
    walk(el);
    return text.replace(/\s+/g, " ").trim();
  }

  function unmash(text) {
    if (!text) return text;
    var next = text;
    next = next.replace(/([A-Za-z0-9]),([A-Za-z])/g, "$1, $2");
    next = next.replace(/([A-Za-z0-9])&([A-Za-z])/g, "$1 & $2");
    next = next.replace(/([A-Za-z])\.([A-Z])/g, "$1. $2");
    next = next.replace(/([a-z])([A-Z])/g, "$1 $2");
    next = next
      .replace(/Hopeto/g, "Hope to")
      .replace(/WhoNeed/g, "Who Need")
      .replace(/Lifeof/g, "Life of")
      .replace(/Waysto/g, "Ways to")
      .replace(/Studentsin/g, "Students in")
      .replace(/Empowermentfor/gi, "Empowerment for")
      .replace(/Nutritionfor/gi, "Nutrition for")
      .replace(/Sanitationfor/gi, "Sanitation for")
      .replace(/Healthcarefor/gi, "Healthcare for")
      .replace(/Educationfor/gi, "Education for")
      .replace(/ADayinthe/gi, "A Day in the")
      .replace(/forfamilies/gi, "for families")
      .replace(/forrise/gi, "for rise")
      .replace(/forhealth/gi, "for health")
      .replace(/\s+/g, " ")
      .trim();
    return next;
  }

  function applyTitleFixes(text) {
    var next = applyQuoteFixes(text);
    TITLE_FIXES.forEach(function (pair) {
      next = next.replace(pair[0], pair[1]);
    });
    return unmash(next);
  }

  function letterSpanCount(el) {
    return el.querySelectorAll('span[style*="inline-block"]').length;
  }

  function fixPlainHeadings(root) {
    var scope = root || document;
    scope.querySelectorAll("h1, h2, h3").forEach(function (heading) {
      if (heading.closest && heading.closest("#ainf-global-nav, #ainf-site-footer")) return;
      // Never flatten letter-animated headings — that kills in/out and drops white fill to #222
      if (letterSpanCount(heading) >= 4) return;
      var text = plainTextWithBreaks(heading);
      if (!text || text.length < 3) return;
      var next = applyTitleFixes(text);
      if (next && next !== text) heading.textContent = next;
    });
  }

  function markBrokenImages() {
    document.querySelectorAll("img").forEach(function (img) {
      if (img.dataset.ainfImgBound) return;
      img.dataset.ainfImgBound = "1";
      img.addEventListener(
        "error",
        function () {
          img.classList.add("ainf-img-broken");
          if (/Hero Image|hero/i.test(img.getAttribute("alt") || "")) {
            img.setAttribute("alt", "");
            img.style.setProperty("display", "none", "important");
          }
        },
        { once: true }
      );
    });
  }

  function run() {
    markBrokenImages();
    var revealed = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      document.documentElement.classList.add("ainf-ready");
      document.documentElement.classList.remove("ainf-booting");
    }
    var fallback = setTimeout(reveal, 700);
    function afterFonts() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          clearTimeout(fallback);
          reveal();
        });
      });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(afterFonts).catch(afterFonts);
    } else {
      afterFonts();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  window.addEventListener("load", run);

  // Wait until Framer letter in/out finishes before any heading DOM writes
  setTimeout(function () {
    fixPlainHeadings(document);
    fixPlainCopy(document);
    markBrokenImages();
    var i = 0;
    var timer = setInterval(function () {
      fixPlainHeadings(document);
      fixPlainCopy(document);
      i += 1;
      if (i > 8) clearInterval(timer);
    }, 400);
    var mo = new MutationObserver(function () {
      markBrokenImages();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }, 2000);
})();
