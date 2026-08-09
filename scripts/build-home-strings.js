#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const entries = {
  meta: {
    title: {
      en: "theainf.in — All Indian Nevarlands Foundation | Shiksha · Jobs · Seva",
      bn: "theainf.in — অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশন | শিক্ষা · কর্ম · সেবা",
      hi: "theainf.in — ऑल इंडियन नेवरलैंड्स फाउंडेशन | शिक्षा · रोज़गार · सेवा",
    },
    titleAlt: {
      en: "theainf- All Indian Nevarlands Foundation",
      bn: "theainf — অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশন",
      hi: "theainf — ऑल इंडियन नेवरलैंड्स फाउंडेशन",
    },
    description: {
      en: "AINF (theainf.in) — All Indian Nevarlands Foundation. HQ Nala, Jamtara (Jharkhand); active across West Bengal. Shiksha, skills, placement, women safety, healthcare, farming, and tribal welfare.",
      bn: "AINF (theainf.in) — অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশন। প্রধান কার্যালয় নালা, জামতাড়া (ঝাড়খণ্ড); পশ্চিমবঙ্গ জুড়ে সক্রিয়। শিক্ষা, দক্ষতা, কর্মসংস্থান, নারী সুরক্ষা, স্বাস্থ্য, কৃষি ও আদিবাসী কল্যাণ।",
      hi: "AINF (theainf.in) — ऑल इंडियन नेवरलैंड्स फाउंडेशन। मुख्यालय नाला, जामताड़ा (झारखंड); पश्चिम बंगाल में सक्रिय। शिक्षा, कौशल, रोज़गार, महिला सुरक्षा, स्वास्थ्य, खेती और आदिवासी कल्याण।",
    },
  },
  strings: {
    "About AINF": { bn: "AINF সম্পর্কে", hi: "AINF के बारे में" },
    "Missions": { bn: "মিশন", hi: "मिशन" },
    "Diary": { bn: "ডায়েরি", hi: "डायरी" },
    "Reach Us": { bn: "যোগাযোগ", hi: "संपर्क करें" },
    "Support AINF": { bn: "AINF সহায়তা", hi: "AINF समर्थन" },
    "Support AINFSupport AINF": { bn: "AINF সহায়তা", hi: "AINF समर्थन" },
    "Home": { bn: "হোম", hi: "होम" },
    "Menu": { bn: "মেনু", hi: "मेन्यू" },
    "Quick Links": { bn: "দ্রুত লিংক", hi: "त्वरित लिंक" },
    "Terms & Conditions": { bn: "শর্তাবলী", hi: "नियम और शर्तें" },
    "From Shiksha to Employment,": { bn: "শিক্ষা থেকে কর্মসংস্থান,", hi: "शिक्षा से रोज़गार," },
    "Opportunity for Every Youth": { bn: "প্রতিটি যুবকের জন্য সুযোগ", hi: "हर युवा के लिए अवसर" },
    "From Shiksha to Employment,Opportunity for Every Youth": {
      bn: "শিক্ষা থেকে কর্মসংস্থান, প্রতিটি যুবকের জন্য সুযোগ",
      hi: "शिक्षा से रोज़गार, हर युवा के लिए अवसर",
    },
    "All Indian Nevarlands Foundation works from Jamtara outward — classrooms, skill labs, job linkages, and village welfare under one roof.": {
      bn: "অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশন জামতাড়া থেকে বাইরে কাজ করে — ক্লাসরুম, দক্ষতা ল্যাব, চাকরির সংযোগ এবং গ্রাম কল্যাণ এক ছাদের নিচে।",
      hi: "ऑल इंडियन नेवरलैंड्स फाउंडेशन जामताड़ा से बाहर काम करता है — कक्षाएँ, सkill लैब, नौकरी जोड़ और गाँव कल्याण एक छत के नीचे।",
    },
    "12,500+": { bn: "১২,৫০০+", hi: "12,500+" },
    "Ghar Pahunch": { bn: "ঘর পৌঁছানো", hi: "घर पहुँच" },
    "500+": { bn: "৫০০+", hi: "500+" },
    "Zila Sahyog": { bn: "জেলা সহযোগ", hi: "ज़िला सहयोग" },
    "Registered in Jharkhand, active across West Bengal — wherever a student needs coaching, a youth needs skills, or a family needs a fair chance.": {
      bn: "ঝাড়খণ্ডে নিবন্ধিত, পশ্চিমবঙ্গ জুড়ে সক্রিয় — যেখানেই একজন শিক্ষার্থীর কোচিং দরকার, একজন যুবকের দক্ষতা দরকার, বা এক পরিবারের ন্যায্য সুযোগ দরকার।",
      hi: "झारखंड में पंजीकृत, पश्चिम बंगाल में सक्रिय — जहाँ भी किसी छात्र को कोचिंग, किसी युवा को कौशल, या किसी परिवार को न्यायसंगत मौका चाहिए।",
    },
    "200k+": { bn: "২০০ হাজার+", hi: "200k+" },
    "Ensuring food security": { bn: "খাদ্য নিরাপত্তা নিশ্চিত করা", hi: "खाद्य सुरक्षा सुनिश्चित करना" },
    "for needy families": { bn: "অভাবগ্রস্ত পরিবারের জন্য", hi: "ज़रूरतमंद परिवारों के लिए" },
    "Ensuring food securityfor needy families": {
      bn: "অভাবগ্রস্ত পরিবারের জন্য খাদ্য নিরাপত্তা নিশ্চিত করা",
      hi: "ज़रूरतमंद परिवारों के लिए खाद्य सुरक्षा",
    },
    "1,000+": { bn: "১,০০০+", hi: "1,000+" },
    "Giving living access to": { bn: "নিরাপদ আবাসনের সুযোগ", hi: "सुरक्षित आवास तक पहुँच" },
    "safe homes & future": { bn: "এবং ভবিষ্যৎ", hi: "और भविष्य" },
    "Giving living access tosafe homes & future": {
      bn: "নিরাপদ আবাসন ও ভবিষ্যৎয়ের সুযোগ",
      hi: "सुरक्षित घर और भविष्य तक पहुँच",
    },
    "One Signature Can": { bn: "একটি স্বাক্ষর", hi: "एक हस्ताक्षर" },
    "Change a Student's Path": { bn: "একজন শিক্ষার্থীর পথ বদলাতে পারে", hi: "एक छात्र का रास्ता बदल सकता है" },
    "One Signature CanChange a Student's Path": {
      bn: "একটি স্বাক্ষর একজন শিক্ষার্থীর পথ বদলাতে পারে",
      hi: "एक हस्ताक्षर एक छात्र का रास्ता बदल सकता है",
    },
    "Born in Jharkhand. Active wherever a student needs coaching,": {
      bn: "ঝাড়খণ্ডে জন্ম। যেখানেই একজন শিক্ষার্থীর কোচিং দরকার,",
      hi: "झारखंड में जन्म। जहाँ भी किसी छात्र को कोचिंग चाहिए,",
    },
    "a youth needs skill, or a family needs a fair chance.": {
      bn: "একজন যুবকের দক্ষতা দরকার, বা এক পরিবারের ন্যায্য সুযোগ দরকার।",
      hi: "किसी युवा को कौशल चाहिए, या किसी परिवार को न्यायसंगत मौका चाहिए।",
    },
    "Born in Jharkhand. Active wherever a student needs coaching,a youth needs skill, or a family needs a fair chance.": {
      bn: "ঝাড়খণ্ডে জন্ম। যেখানেই একজন শিক্ষার্থীর কোচিং, একজন যুবকের দক্ষতা, বা এক পরিবারের ন্যায্য সুযোগ দরকার।",
      hi: "झारखंड में जन्म। जहाँ भी छात्र को कोचिंग, युवा को कौशल, या परिवार को न्यायसंगत मौका चाहिए।",
    },
    "About AINFAbout AINF": { bn: "AINF সম্পর্কে", hi: "AINF के बारे में" },
    "Seven Focus Areas at AINF": { bn: "AINF-এর সাতটি মূল ক্ষেত্র", hi: "AINF के सात मुख्य क्षेत्र" },
    "Seven commitments: shiksha, swasthya, rozgar, nari suraksha, kheti, adivasi sahayata, and samajik nyay — measured on the ground.": {
      bn: "সাতটি প্রতিশ্রুতি: শিক্ষা, স্বাস্থ্য, রোজগার, নারী সুরক্ষা, কৃষি, আদিবাসী সহায়তা ও সামাজিক ন্যায় — মাঠে মাপা হয়।",
      hi: "सात प्रतिबद्धताएँ: शिक्षा, स्वास्थ्य, रोज़गार, महिला सुरक्षा, खेती, आदिवासी सहायता और सामाजिक न्याय — ज़मीन पर मापी जाती हैं।",
    },
    Shiksha: { bn: "শিক্ষা", hi: "शिक्षा" },
    Swasthya: { bn: "স্বাস্থ্য", hi: "स्वास्थ्य" },
    Rozgar: { bn: "রোজগার", hi: "रोज़गार" },
    "Nari Suraksha": { bn: "নারী সুরক্ষা", hi: "महिला सुरक्षा" },
    Kheti: { bn: "কৃষি", hi: "खेती" },
    "Adivasi Sahayata": { bn: "আদিবাসী সহায়তা", hi: "आदिवासी सहायता" },
    "Samajik Nyay": { bn: "সামাজিক ন্যায়", hi: "सामाजिक न्याय" },
    "Shiksha Desk — Every Child": { bn: "শিক্ষা ডেস্ক — প্রতিটি শিশু", hi: "शिक्षा डेस्क — हर बच्चा" },
    "AINF Shiksha Desk funds scholarships, study kits, and coaching so fees never block a child from class in our blocks.": {
      bn: "AINF শিক্ষা ডেস্ক বৃত্তি, পড়াশোনার সামগ্রী ও কোচিংয়ের জন্য তহবিল দেয় যাতে ফি কখনো শিশুকে ক্লাস থেকে আটকায় না।",
      hi: "AINF शिक्षा डेस्क छात्रवृत्ति, अध्ययन किट और कोचिंग के लिए धन देता है ताकि फीस कभी बच्चे को कक्षा से न रoke।",
    },
    Jama: { bn: "জমা", hi: "जमा" },
    "3,20,000+": { bn: "৩,২০,০০০+", hi: "3,20,000+" },
    Lakshya: { bn: "লক্ষ্য", hi: "लक्ष्य" },
    "5,00,000+": { bn: "৫,০০,০০০+", hi: "5,00,000+" },
    "Poora Padhein": { bn: "সম্পূর্ণ পড়ুন", hi: "पूरा पढ़ें" },
    "Poora PadheinPoora Padhein": { bn: "সম্পূর্ণ পড়ুন", hi: "पूरा पढ़ें" },
    "Swasthya Desk — Care First": { bn: "স্বাস্থ্য ডেস্ক — সেবা আগে", hi: "स्वास्थ्य डेस्क — देखभाल पहले" },
    "AINF Swasthya Desk runs health camps, referrals, and wellness drives so families get care closer to home.": {
      bn: "AINF স্বাস্থ্য ডেস্ক স্বাস্থ্য শিবির, রেফারেল ও সুস্থতা অভিযান চালায় যাতে পরিবারগুলো বাড়ির কাছেই চিকিৎসা পায়।",
      hi: "AINF स्वास्थ्य डेस्क स्वास्थ्य शिविर, रेफरल और wellness अभियान चलाता है ताकि परिवारों को घर के पास देखभाल मिले।",
    },
    "Rozgar & Skills Desk": { bn: "রোজগার ও দক্ষতা ডেস্ক", hi: "रोज़गार और कौशल डेस्क" },
    "AINF Rozgar Desk trains youth, hosts rozgar melas, and links graduates to employers for dignified local work.": {
      bn: "AINF রোজগার ডেস্ক যুবকদের প্রশিক্ষণ দেয়, রোজগার মেলা আয়োজন করে এবং স্নাতকদের স্থানীয় মর্যাদাপূর্ণ কাজের সাথে যুক্ত করে।",
      hi: "AINF रोज़गार डेस्क युवाओं को प्रशिक्षित करता है, रोज़गार मेले आयोजित करता है और स्नातकों को स्थानीय सम्मानजनक काम से जोड़ता है।",
    },
    "Nari Suraksha — Dignity": { bn: "নারী সুরক্ষা — মর্যাদা", hi: "महिला सुरक्षा — गरिमा" },
    "Nari Suraksha Desk runs safety workshops, legal awareness, and livelihood pathways for women and girls.": {
      bn: "নারী সুরক্ষা ডেস্ক নারী ও কন্যাদের জন্য নিরাপত্তা কর্মশালা, আইনি সচেতনতা ও জীবিকার পথ চালায়।",
      hi: "महिला सुरक्षा डेस्क महिलाओं और लड़कियों के लिए सुरक्षा कार्यशालाएँ, कानूनी जागरूकता और आजीविका के रास्ते चलाता है।",
    },
    "Janajati & Kheti Desk": { bn: "জনজাতি ও কৃষি ডেস্ক", hi: "जनजाति और खेती डेस्क" },
    "Janajati Sahyog and Kheti Desk supports farm inputs, fair markets, and seasonal resilience for tribal families.": {
      bn: "জনজাতি সহযোগ ও কৃষি ডেস্ক আদিবাসী পরিবারের জন্য কৃষি সামগ্রী, ন্যায্য বাজার ও মৌসুমি সহনশীলতা সমর্থন করে।",
      hi: "जनजाति सहयोग और खेती डेस्क आदिवासी परिवारों के लिए कृषि सामग्री, निष्पक्ष बाजार और मौसमी लचीलापन समर्थन करता है।",
    },
    "Adivasi Sahayata Desk": { bn: "আদিবাসী সহায়তা ডেস্ক", hi: "आदिवासी सहायता डेस्क" },
    "Tribal hamlets get respectful support — school access, health camps, and equal dignity without caste, faith, or language bias.": {
      bn: "আদিবাসী গ্রামগুলো সম্মানজনক সহায়তা পায় — স্কুলে প্রবেশ, স্বাস্থ্য শিবির ও জাত, ধর্ম বা ভাষার পক্ষপাত ছাড়া সমান মর্যাদা।",
      hi: "आदिवासी बस्तियों को सम्मानजनक सहायता मिलती है — स्कूल पहुँच, स्वास्थ्य शिविर और जाति, धर्म या भाषा के पूर्वाग्रह के बिना समान गरिमा।",
    },
    "Samajik Nyay Desk": { bn: "সামাজিক ন্যায় ডেস্ক", hi: "सामाजिक न्याय डेस्क" },
    "Fair chances for every family — counselling, emergency relief, and block-level help so no student or household is left behind.": {
      bn: "প্রতিটি পরিবারের জন্য ন্যায্য সুযোগ — পরামর্শ, জরুরি ত্রাণ ও ব্লক-স্তরের সহায়তা যাতে কেউ পিছিয়ে না থাকে।",
      hi: "हर परिवार के लिए न्यायसंगत मौके — परामर्श, आपात राहत और ब्लॉक-स्तरीय मदद ताकि कोई छात्र या परिवार पीछे न रहे।",
    },
    "Give Your Time, Build Someone's Career": {
      bn: "আপনার সময় দিন, কারও ক্যারিয়ার গড়ুন",
      hi: "अपना समय दें, किसी का करियर बनाएँ",
    },
    "Coach exam batches, host skill weekends, or sit in placement cells with AINF. Do ghante bhi kaafi — agar kisi student ko direction mil jaye.": {
      bn: "AINF-এর সাথে পরীক্ষার ব্যাচ কোচ করুন, দক্ষতা সপ্তাহান্ত আয়োজন করুন বা প্লেসমেন্ট সেলে বসুন। কয়েক ঘণ্টাও যথেষ্ট — যদি একজন শিক্ষার্থী দিক পায়।",
      hi: "AINF के साथ परीक्षा बैच कोच करें, कौशल वीकेंड आयोजित करें या प्लेसमेंट सेल में बैठें। कुछ घंटे भी काफी हैं — अगर किसी छात्र को दिशा मिल जाए।",
    },
    "Join as Field Sevak": { bn: "ফিল্ড সেবক হিসেবে যোগ দিন", hi: "फ़ील्ड सेवक के रूप में जुड़ें" },
    "Join as Field SevakJoin as Field Sevak": { bn: "ফিল্ড সেবক হিসেবে যোগ দিন", hi: "फ़ील्ड सेवक के रूप में जुड़ें" },
    "Three Ways to Help — Donate, Volunteer, or Adopt a Desk": {
      bn: "সাহায্যের তিন উপায় — দান, স্বেচ্ছাসেবা বা একটি ডেস্ক গ্রহণ",
      hi: "मदद के तीन तरीके — दान, स्वयंसेवा या एक डेस्क अपनाएँ",
    },
    "Scholarship, skill kit, safety workshop, health camp, or farm support — jo bhi aap chunein, pura paisa AINF ke registered objects par lagta hai.": {
      bn: "বৃত্তি, দক্ষতা কিট, নিরাপত্তা কর্মশালা, স্বাস্থ্য শিবির বা কৃষি সহায়তা — আপনি যা-ই বেছে নিন, পুরো অর্থ AINF-এর নিবন্ধিত উদ্দেশ্যে ব্যয় হয়।",
      hi: "छात्रवृत्ति, कौशल किट, सुरक्षा कार्यशाला, स्वास्थ्य शिविर या खेती सहायता — आप जो भी चुनें, पूरा धन AINF के पंजीकृत उद्देश्यों पर लगता है।",
    },
    "Fund a Seat": { bn: "একটি আসনে তহবিল দিন", hi: "एक सीट के लिए धन दें" },
    "Aapka yogdaan stipend, study kit, counselling aur emergency relief seedha students aur families tak pahunchata hai.": {
      bn: "আপনার অনুদান স্টাইপেন্ড, পড়াশোনার সামগ্রী, পরামর্শ ও জরুরি ত্রাণ সরাসরি শিক্ষার্থী ও পরিবারের কাছে পৌঁছায়।",
      hi: "आपका योगदान stipend, अध्ययन किट, counselling और आपात राहत सीधे छात्रों और परिवारों तक पहुँचता है।",
    },
    "Become a Field Sevak": { bn: "ফিল্ড সেবক হন", hi: "फ़ील्ड सेवक बनें" },
    "Teach a batch, review CVs, or co-host a block-level camp with AINF field teams.": {
      bn: "একটি ব্যাচ পড়ান, CV পর্যালোচনা করুন, বা AINF ফিল্ড দলের সাথে ব্লক-স্তরের শিবির আয়োজন করুন।",
      hi: "एक बैच पढ़ाएँ, CV समीक्षा करें, या AINF फ़ील्ड टीमों के साथ ब्लॉक-स्तरीय शिविर सह-आयोजित करें।",
    },
    "Ek Vertical Apnao": { bn: "একটি ভার্টিক্যাল গ্রহণ করুন", hi: "एक vertical अपनाएँ" },
    "Pick a Shiksha desk, rozgar cell, nari desk, swasthya van, kheti unit, or janajati desk to adopt.": {
      bn: "একটি শিক্ষা ডেস্ক, রোজগার সেল, নারী ডেস্ক, স্বাস্থ্য ভ্যান, কৃষি ইউনিট বা জনজাতি ডেস্ক গ্রহণ করুন।",
      hi: "एक शिक्षा डेस्क, रोज़गार सेल, महिला डेस्क, स्वास्थ्य वैन, खेती यूनिट या जनजाति डेस्क अपनाएँ।",
    },
    "Circle Mein Forward Karo": { bn: "আপনার গোষ্ঠীতে শেয়ার করুন", hi: "अपने समूह में आगे भेजें" },
    "Share theainf.in in your group — one forward can connect a youth to coaching or a job lead.": {
      bn: "আপনার গোষ্ঠীতে theainf.in শেয়ার করুন — একটি শেয়ার একজন যুবককে কোচিং বা চাকরির সুযোগের সাথে যুক্ত করতে পারে।",
      hi: "अपने समूह में theainf.in साझा करें — एक forward किसी युवा को कोचिंग या नौकरी के अवसर से जोड़ सकता है।",
    },
    "Voices from the Field": { bn: "মাঠ থেকে কণ্ঠস্বর", hi: "मैदान से आवाज़ें" },
    "Coaching batch ke students, field sevaks, aur Asansol–Jamtara ke sahyogi — seedhi baatein seekhne, kaam pane, aur izzat milne ki.": {
      bn: "কোচিং ব্যাচের শিক্ষার্থী, ফিল্ড সেবক ও আসansol–জামতাড়ার সহযোগী — শেখা, কাজ পাওয়া ও সম্মান পাওয়ার সরাসরি কথা।",
      hi: "कोचिंग बैच के छात्र, फ़ील्ड सेवक और Asansol–Jamtara के सहयोगी — सीखने, काम पाने और सम्मान पाने की सीधी बातें।",
    },
    "Birsa Murmu": { bn: "বিরসা মুর্মু", hi: "बिरसा मुर्मू" },
    Sevak: { bn: "সেবক", hi: "सेवक" },
    "Mere bhaiya ko AINF coaching ke baad polytechnic seat mili. Pehle ghar mein hope kam thi — ab plan clear hai.": {
      bn: "আমার ভাই AINF কোচিংয়ের পর পলিটেকনিক সিট পেয়েছে। আগে বাড়িতে আশা কম ছিল — এখন পরিকল্পনা স্পষ্ট।",
      hi: "मेरे भाई को AINF कोचिंग के बाद polytechnic सीट मिली। पहले घर में उम्मीद कम थी — अब plan साफ है।",
    },
    "Birsa MurmuSevak": { bn: "বিরসা মুর্মু · সেবক", hi: "बिरसा मुर्मू · सेवक" },
    "Ravi Hembram": { bn: "রবি হেমব্রাম", hi: "रवि हेम्ब्राम" },
    Donor: { bn: "দাতা", hi: "दाता" },
    "Daan ke baad mujhe ledger note aur camp photo mila. Pehli baar laga paisa sach mein batch tak pahuncha.": {
      bn: "দানের পর আমি ledger note ও শিবিরের ছবি পেয়েছি। প্রথমবার মনে হলো টাকা সত্যিই ব্যাচ পর্যন্ত পৌঁছেছে।",
      hi: "दान के बाद मुझे ledger note और camp photo मिला। पहली बार लगा पैसा सच में batch तक पहुँचा।",
    },
    "Ravi HembramDonor": { bn: "রবি হেমব্রাম · দাতা", hi: "रवि हेम्ब्राम · दाता" },
    "Imran Ansari": { bn: "ইমরান আনসারি", hi: "इमरान अंसारी" },
    Supporter: { bn: "সমর্থক", hi: "समर्थक" },
    "Working alongside such committed people has been an unforgettable experience. Every initiative is driven by genuine care and purpose.": {
      bn: "এত নিবেদিত মানুষদের সাথে কাজ করা অবিস্মরণীয় অভিজ্ঞতা। প্রতিটি উদ্যোগ সত্যিকারের যত্ন ও উদ্দেশ্যে পরিচালিত।",
      hi: "इतने समर्पित लोगों के साथ काम करना अविस्मरणीय अनुभव रहा। हर पहल genuine care और purpose से चलती है।",
    },
    "Imran AnsariSupporter": { bn: "ইমরান আনসারি · সমর্থক", hi: "इमरान अंसारी · समर्थक" },
    "Amit Hazra": { bn: "অমিত হাজরা", hi: "अमित हाज़रा" },
    "Rozgar mela mein teen youth ko local workshop interview mila. Main sevak tha — scene khud dekha.": {
      bn: "রোজগার মেলায় তিন যুবক স্থানীয় ওয়ার্কশপে ইন্টারভিউ পেয়েছে। আমি সেবক ছিলাম — দৃশ্য নিজে দেখেছি।",
      hi: "रोज़गार मेले में तीन युवाओं को local workshop interview मिला। मैं सेवक था — scene खुद देखा।",
    },
    "Amit HazraDonor": { bn: "অমিত হাজরা · দাতা", hi: "अमित हाज़रा · दाता" },
    "Field Notes & Block Reports": { bn: "ফিল্ড নোট ও ব্লক রিপোর্ট", hi: "फ़ील्ड नोट और ब्लॉक रिपोर्ट" },
    "Coaching room, ITI gate, aur gram camp ki diary — AINF ke eastern India footprints ki asli tasveer.": {
      bn: "কোচিং রুম, ITI গেট ও গ্রাম শিবিরের ডায়েরি — AINF-এর পূর্ব ভারতের পদচিহ্নের আসল চিত্র।",
      hi: "कोचिंग room, ITI gate और ग्राम camp की diary — AINF के पूर्व भारत footprints की असली तस्वीर।",
    },
    Impact: { bn: "প্রভাব", hi: "प्रभाव" },
    "How Your Donations Are Changing Lives Every Day": {
      bn: "আপনার অনুদান প্রতিদিন কীভাবে জীবন বদলাচ্ছে",
      hi: "आपके दान हर दिन ज़िंदगियाँ कैसे बदल रहे हैं",
    },
    "ImpactHow Your Donations Are Changing Lives Every Day": {
      bn: "প্রভাব · আপনার অনুদান প্রতিদিন কীভাবে জীবন বদলাচ্ছে",
      hi: "प्रभाव · आपके दान हर दिन ज़िंदगियाँ कैसे बदल रहे हैं",
    },
    Volunteer: { bn: "স্বেচ্ছাসেবক", hi: "स्वयंसेवक" },
    "A Day in the Life of Our Volunteers": {
      bn: "আমাদের স্বেচ্ছাসেবকদের এক দিন",
      hi: "हमारे स्वयंसेवकों का एक दिन",
    },
    "VolunteerA Day in the Life of Our Volunteers": {
      bn: "স্বেচ্ছাসেবক · আমাদের স্বেচ্ছাসেবকদের এক দিন",
      hi: "स्वयंसेवक · हमारे स्वयंसेवकों का एक दिन",
    },
    Education: { bn: "শিক্ষা", hi: "शिक्षा" },
    "Education Can Break Poverty": { bn: "শিক্ষা দারিদ্র্য ভাঙতে পারে", hi: "शिक्षा गरीबी तोड़ सकती है" },
    "EducationEducation Can Break Poverty": {
      bn: "শিক্ষা · শিক্ষা দারিদ্র্য ভাঙতে পারে",
      hi: "शिक्षा · शिक्षा गरीबी तोड़ सकती है",
    },
    Involved: { bn: "অংশগ্রহণ", hi: "भागीदारी" },
    "Simple Ways to Make Impact On Community": {
      bn: "সম্প্রদায়ে প্রভাব ফেলার সহজ উপায়",
      hi: "समुदाय में प्रभाव डालने के सरल तरीके",
    },
    "InvolvedSimple Ways to Make Impact On Community": {
      bn: "অংশগ্রহণ · সম্প্রদায়ে প্রভাব ফেলার সহজ উপায়",
      hi: "भागीदारी · समुदाय में प्रभाव डालने के सरल तरीके",
    },
    "Fill the form below — you'll receive a receipt once the amount is confirmed.": {
      bn: "নিচের ফর্মটি পূরণ করুন — পরিমাণ নিশ্চিত হলে আপনি রসিদ পাবেন।",
      hi: "नीचे फ़ॉर्म भरें — राशि confirm होने पर receipt मिलेगी।",
    },
    "Poora Naam": { bn: "পুরো নাম", hi: "पूरा नाम" },
    "Email ID": { bn: "ইমেইল আইডি", hi: "ईमेल ID" },
    "Desk / Vertical": { bn: "ডেস্ক / ভার্টিক্যাল", hi: "डेस्क / vertical" },
    "Select Cause": { bn: "কারণ নির্বাচন করুন", hi: "कारण चुनें" },
    "Amount (INR)": { bn: "পরিমাণ (INR)", hi: "राशि (INR)" },
    "Note (optional)": { bn: "নোট (ঐচ্ছিক)", hi: "नोट (वैकल्पिक)" },
    "Enter Your Name": { bn: "আপনার নাম লিখুন", hi: "अपना नाम लिखें" },
    "Enter Your Email": { bn: "আপনার ইমেইল লিখুন", hi: "अपना ईमेल लिखें" },
    "Support AINF Amount": { bn: "AINF সহায়তার পরিমাণ", hi: "AINF सहायता राशि" },
    "Enter Your Message": { bn: "আপনার বার্তা লিখুন", hi: "अपना संदेश लिखें" },
    "Desk / VerticalSelect CauseShikshaSwasthyaRozgarNari SurakshaKheti": {
      bn: "ডেস্ক / ভার্টিক্যাল · কারণ নির্বাচন · শিক্ষা · স্বাস্থ্য · রোজগার · নারী সুরক্ষা · কৃষি",
      hi: "डेस्क / vertical · कारण चुनें · शिक्षा · स्वास्थ्य · रोज़गार · महिला सुरक्षा · खेती",
    },
    "Thank you": { bn: "ধন্যবাদ", hi: "धन्यवाद" },
    "Something went wrong": { bn: "কিছু ভুল হয়েছে", hi: "कुछ गलत हो गया" },
    "Questions Before You Donate": { bn: "দানের আগে প্রশ্ন", hi: "दान से पहले प्रश्न" },
    "Section 8 rules clear hain — yahan padho daan kahan jata hai, kaun account handle karta hai, aur aap kaise sevak ban sakte ho.": {
      bn: "Section 8 নিয়ম স্পষ্ট — এখানে পড়ুন অনুদান কোথায় যায়, কোন অ্যাকাউন্ট পরিচালনা করে, এবং আপনি কীভাবে সেবক হতে পারেন।",
      hi: "Section 8 नियम स्पष्ट हैं — यहाँ पढ़ें दान कहाँ जाता है, कौन account संभालता है, और आप सेवक कैसे बन सकते हैं।",
    },
    "What does AINF deliver on the ground?": {
      bn: "AINF মাঠে কী সরবরাহ করে?",
      hi: "AINF ज़मीन पर क्या deliver करता है?",
    },
    "AINF Section 8 foundation hai — shiksha, rozgar, nari suraksha, swasthya, kheti aur janajati desks Jamtara HQ se chalati hai.": {
      bn: "AINF একটি Section 8 ফাউন্ডেশন — শিক্ষা, রোজগার, নারী সুরক্ষা, স্বাস্থ্য, কৃষি ও জনজাতি ডেস্ক জামতাড়া HQ থেকে চালায়।",
      hi: "AINF Section 8 foundation है — शिक्षा, रोज़गार, महिला सुरक्षा, स्वास्थ्य, खेती और जनजाति desks Jamtara HQ से चलाता है।",
    },
    "How do online and offline donations work?": {
      bn: "অনলাইন ও অফলাইন অনুদান কীভাবে কাজ করে?",
      hi: "ऑनलाइन और ऑफ़लाइन दान कैसे काम करते हैं?",
    },
    "Support AINF form se UPI/net-banking choose karo. Receipt email + SMS; amount AINF Section 8 account mein jata hai.": {
      bn: "Support AINF ফর্ম থেকে UPI/net-banking বেছে নিন। রসিদ email + SMS; অর্থ AINF Section 8 অ্যাকাউন্টে যায়।",
      hi: "Support AINF form से UPI/net-banking चुनें। receipt email + SMS; राशि AINF Section 8 account में जाती है।",
    },
    "Paisa kis ledger mein jata hai?": {
      bn: "টাকা কোন ledger-এ যায়?",
      hi: "पैसा किस ledger में जाता है?",
    },
    "Aapka daan coaching fee, skill kit, travel stipend, nari workshop, swasthya camp, ya kheti kit mein tag hota hai — ledger transparent rehta hai.": {
      bn: "আপনার অনুদান কোচিং ফি, দক্ষতা কিট, ভ্রমণ ভাতা, নারী কর্মশালা, স্বাস্থ্য শিবির বা কৃষি কিটে tag হয় — ledger স্বচ্ছ থাকে।",
      hi: "आपका दान coaching fee, skill kit, travel stipend, nari workshop, swasthya camp, या kheti kit में tag होता है — ledger transparent रहता है।",
    },
    "How do I join an AINF field team?": {
      bn: "AINF ফিল্ড দলে কীভাবে যোগ দেব?",
      hi: "AINF field team में कैसे जुड़ूँ?",
    },
    "Field Sevak form bhariye — subject, district, aur weekend availability likho. Coordinator 48–72 hrs mein WhatsApp karega.": {
      bn: "Field Sevak ফর্ম পূরণ করুন — subject, district ও weekend availability লিখুন। Coordinator 48–72 ঘণ্টায় WhatsApp করবে।",
      hi: "Field Sevak form भरें — subject, district और weekend availability लिखें। coordinator 48–72 hrs में WhatsApp करेगा।",
    },
    "Can I tag my donation to one desk?": {
      bn: "আমি কি অনুদান একটি ডেস্কে tag করতে পারি?",
      hi: "क्या मैं दान एक desk पर tag कर सकता/सकती हूँ?",
    },
    "Haan — Support AINF form mein Desk/Vertical select karo: Shiksha, Swasthya, Rozgar, Nari Suraksha, Kheti, ya Janajati.": {
      bn: "হ্যাঁ — Support AINF ফর্মে Desk/Vertical নির্বাচন করুন: Shiksha, Swasthya, Rozgar, Nari Suraksha, Kheti, বা Janajati।",
      hi: "हाँ — Support AINF form में Desk/Vertical चुनें: Shiksha, Swasthya, Rozgar, Nari Suraksha, Kheti, या Janajati।",
    },
    "Today's Gift — Tomorrow's Job or Degree": {
      bn: "আজকের উপহার — আগামীকালের চাকরি বা ডিগ্রি",
      hi: "आज का उपहार — कल की नौकरी या degree",
    },
    "Even a small amount can cover coaching fees, travel stipends, or a skill kit. Larger gifts can sponsor a full batch — every rupee is tracked in AINF's ledger.": {
      bn: "এমনকি অল্প পরিমাণ কোচিং ফি, ভ্রমণ ভাতা বা দক্ষতা কিট কভার করতে পারে। বড় অনুদান পুরো ব্যাচ স্পনসর করতে পারে — প্রতিটি টাকা AINF ledger-এ tracked।",
      hi: "थोड़ी राशि भी coaching fees, travel stipend या skill kit कवर कर सकती है। बड़े दान पूरा batch sponsor कर सकते हैं — हर रुपया AINF ledger में tracked है।",
    },
    Kartavya: { bn: "কর্তব্য", hi: "कर्तव्य" },
    Natija: { bn: "ফল", hi: "नतीजा" },
    Madad: { bn: "সাহায্য", hi: "मदद" },
    Bharosa: { bn: "বিশ্বাস", hi: "भरोसा" },
    Sangathan: { bn: "সংগঠন", hi: "संगठन" },
    "We are a non-profit organization dedicated to providing education,": {
      bn: "আমরা একটি অলাভজনক সংস্থা, শিক্ষা প্রদানে নিবেদিত,",
      hi: "हम एक non-profit संगठन हैं, शिक्षा प्रदान के लिए समर्पित,",
    },
    "healthcare & support.": { bn: "স্বাস্থ্যসেবা ও সহায়তায়।", hi: "स्वास्थ्य और सहायता में।" },
    "We are a non-profit organization dedicated to providing education, healthcare & support.": {
      bn: "আমরা একটি অলাভজনক সংস্থা — শিক্ষা, স্বাস্থ্যসেবা ও সহায়তায় নিবেদিত।",
      hi: "हम एक non-profit संगठन हैं — शिक्षा, स्वास्थ्य और सहायता के लिए समर्पित।",
    },
    "© 2026 theainf · All Indian Nevarlands Foundation · theainf.in": {
      bn: "© ২০২৬ theainf · অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশন · theainf.in",
      hi: "© 2026 theainf · ऑल इंडियन नेवरलैंड्स फाउंडेशन · theainf.in",
    },
    "theainf — All Indian Nevarlands Foundation": {
      bn: "theainf — অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশন",
      hi: "theainf — ऑल इंडियन नेवरलैंड्स फाउंडेशन",
    },
    "Surat, India": { bn: "সুরাট, ভারত", hi: "सूरत, भारत" },
    "Hero BG": { bn: "হিরো পটভূমি", hi: "हीरो पृष्ठभूमि" },
    "Statastic Image Left": { bn: "পরিসংখ্যান ছবি বাম", hi: "आँकड़ा छवि बाएँ" },
    "Statastic Image Right": { bn: "পরিসংখ্যান ছবি ডান", hi: "आँकड़ा छवि दाएँ" },
    "About Image": { bn: "সম্পর্কে ছবি", hi: "परिचय छवि" },
    "Cause Image": { bn: "মিশন ছবি", hi: "मिशन छवि" },
    "CTA Bg": { bn: "CTA পটভূমি", hi: "CTA पृष्ठभूमि" },
    "Ticker Image": { bn: "টিকার ছবি", hi: "टिकर छवि" },
    "Testimonial Image": { bn: "প্রশংসাপত্র ছবি", hi: "प्रशंसापत्र छवि" },
    "Blog Image": { bn: "ব্লগ ছবি", hi: "ब्लॉग छवि" },
    "CTA Image": { bn: "CTA ছবি", hi: "CTA छवि" },
    "Previous": { bn: "আগের", hi: "पिछला" },
    Next: { bn: "পরের", hi: "अगला" },
    "Slideshow pagination controls": {
      bn: "স্লাইডশো পেজিনেশন নিয়ন্ত্রণ",
      hi: "स्लाइडशो pagination नियंत्रण",
    },
    "Training that ends in interviews, not certificates alone": {
      bn: "শুধু সনদ নয়, সাক্ষাৎকারে শেষ হওয়া প্রশিক্ষণ",
      hi: "केवल certificates नहीं, interview तक का prashikshan",
    },
    "From village pathshala benches to city workplaces": {
      bn: "গ্রামের পাঠশালা বেঞ্চ থেকে শহরের কর্মক্ষেত্র",
      hi: "गाँव की pathshala benches से शहर के workplaces",
    },
    "Shiksha Desk: Har Chhatra Tak": {
      bn: "শিক্ষা ডেস্ক: প্রতিটি ছাত্র পর্যন্ত",
      hi: "शिक्षा डेस्क: हर छात्र तक",
    },

    // Contact Us page
    "Reach Out. We're Here Always": {
      bn: "যোগাযোগ করুন। আমরা সবসময় আছি",
      hi: "संपर्क करें। हम हमेशा यहाँ हैं",
    },
    "Reach Out. We’re Here Always": {
      bn: "যোগাযোগ করুন। আমরা সবসময় আছি",
      hi: "संपर्क करें। हम हमेशा यहाँ हैं",
    },
    "Reach AINF — Jharkhand & West Bengal": {
      bn: "AINF-এর সাথে যোগাযোগ — ঝাড়খণ্ড ও পশ্চিমবঙ্গ",
      hi: "AINF से संपर्क करें — झारखंड और पश्चिम बंगाल",
    },
    "Every message you send brings us closer to building something meaningful together.": {
      bn: "আপনার প্রতিটি বার্তা আমাদের একসাথে অর্থপূর্ণ কিছু গড়তে আরও কাছে নিয়ে আসে।",
      hi: "आपका हर संदेश हमें मिलकर कुछ सार्थक बनाने के और करीब लाता है।",
    },
    "Get In Touch": {
      bn: "যোগাযোগ করুন",
      hi: "संपर्क करें",
    },
    "Get in touch via call, email and location": {
      bn: "কল, ইমেইল ও অবস্থানের মাধ্যমে যোগাযোগ করুন",
      hi: "कॉल, ईमेल और स्थान के ज़रिए संपर्क करें",
    },
    "Call Us": { bn: "আমাদের কল করুন", hi: "हमें कॉल करें" },
    "Email Us": { bn: "ইমেইল করুন", hi: "ईमेल करें" },
    Location: { bn: "অবস্থান", hi: "स्थान" },
    "Follow Us On Social Media": {
      bn: "সোশ্যাল মিডিয়ায় ফলো করুন",
      hi: "सोशल मीडिया पर हमें फ़ॉलो करें",
    },
    "Send A Message": { bn: "একটি বার্তা পাঠান", hi: "संदेश भेजें" },
    "Please complete the form below to send a message.": {
      bn: "বার্তা পাঠাতে নিচের ফর্মটি পূরণ করুন।",
      hi: "संदेश भेजने के लिए नीचे दिया गया फ़ॉर्म भरें।",
    },
    "Full Name": { bn: "পুরো নাম", hi: "पूरा नाम" },
    "Phone Number": { bn: "ফোন নম্বর", hi: "फ़ोन नंबर" },
    "Enter Your Phone Number": {
      bn: "আপনার ফোন নম্বর লিখুন",
      hi: "अपना फ़ोन नंबर लिखें",
    },
    "Send Message": { bn: "বার্তা পাঠান", hi: "संदेश भेजें" },
    "Send MessageSend Message": { bn: "বার্তা পাঠান", hi: "संदेश भेजें" },
  },
  pages: {
    home: {
      title: {
        en: "theainf.in — All Indian Nevarlands Foundation | Shiksha · Jobs · Seva",
        bn: "theainf.in — অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশন | শিক্ষা · কর্ম · সেবা",
        hi: "theainf.in — ऑल इंडियन नेवरलैंड्स फाउंडेशन | शिक्षा · रोज़गार · सेवा",
      },
      description: {
        en: "AINF (theainf.in) — All Indian Nevarlands Foundation. HQ Nala, Jamtara (Jharkhand); active across West Bengal. Shiksha, skills, placement, women safety, healthcare, farming, and tribal welfare.",
        bn: "AINF (theainf.in) — অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশন। প্রধান কার্যালয় নালা, জামতাড়া (ঝাড়খণ্ড); পশ্চিমবঙ্গ জুড়ে সক্রিয়। শিক্ষা, দক্ষতা, কর্মসংস্থান, নারী সুরক্ষা, স্বাস্থ্য, কৃষি ও আদিবাসী কল্যাণ।",
        hi: "AINF (theainf.in) — ऑल इंडियन नेवरलैंड्स फाउंडेशन। मुख्यालय नाला, जामताड़ा (झारखंड); पश्चिम बंगाल में सक्रिय। शिक्षा, कौशल, रोज़गार, महिला सुरक्षा, स्वास्थ्य, खेती और आदिवासी कल्याण।",
      },
    },
    contact: {
      title: {
        en: "Contact AINF — Jharkhand & West Bengal | theainf.in",
        bn: "AINF যোগাযোগ — ঝাড়খণ্ড ও পশ্চিমবঙ্গ | theainf.in",
        hi: "AINF संपर्क — झारखंड और पश्चिम बंगाल | theainf.in",
      },
      description: {
        en: "Reach All Indian Nevarlands Foundation — HQ Nala, Jamtara (Jharkhand); field desks across West Bengal including Asansol and Kolkata region.",
        bn: "অল ইন্ডিয়ান নেভারল্যান্ডস ফাউন্ডেশনের সাথে যোগাযোগ করুন — HQ নালা, জামতাড়া (ঝাড়খণ্ড); আসানসোল ও কলকাতা সহ পশ্চিমবঙ্গ জুড়ে ফিল্ড ডেস্ক।",
        hi: "ऑल इंडियन नेवरलैंड्स फाउंडेशन से संपर्क करें — HQ नाला, जामताड़ा (झारखंड); आसनसोल और कोलकाता सहित पश्चिम बंगाल में फ़ील्ड डेस्क।",
      },
    },
  },
};

const out = path.join(__dirname, "../public/i18n/home-strings.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(entries, null, 2), "utf8");
console.log("Wrote", out, "with", Object.keys(entries.strings).length, "strings");
