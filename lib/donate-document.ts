function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Onest, Inter, system-ui, sans-serif; background: #f6f8f7; color: #1a1d1b; }
    a { color: #1c7d48; }
    header, main, footer { width: min(720px, calc(100% - 32px)); margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 22px 0 8px; }
    header strong { font-weight: 600; letter-spacing: -0.03em; }
    header nav { display: flex; gap: 14px; font-size: 14px; }
    header nav a { color: #3d4a44; text-decoration: none; }
    main { padding: 18px 0 48px; }
    h1 { margin: 0 0 8px; font-size: clamp(32px, 5vw, 48px); font-weight: 500; letter-spacing: -0.04em; line-height: 1.05; }
    .lead { margin: 0 0 22px; color: #3d4a44; font-size: 16px; line-height: 1.5; max-width: 46ch; }
    form, .card { background: #fff; border: 1px solid #e2e7e4; border-radius: 18px; padding: 18px; }
    label { display: block; margin: 0 0 12px; font-size: 13px; color: #3d4a44; }
    input, select { width: 100%; margin-top: 6px; border: 1px solid #d5dbd7; border-radius: 12px; padding: 12px 14px; font: inherit; color: #1a1d1b; background: #fff; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
    .chips button { border: 1px solid rgba(34,34,34,0.15); background: #fff; color: #39a46b; border-radius: 999px; padding: 8px 14px; font: inherit; cursor: pointer; }
    .chips button.is-on { background: #143528; color: #fff; border-color: #143528; }
    .pay { width: 100%; border: 0; border-radius: 999px; background: #1c7d48; color: #fff; padding: 14px 18px; font: inherit; font-weight: 500; cursor: pointer; }
    .pay:disabled { opacity: 0.55; cursor: default; }
    .note { margin: 12px 0 0; color: #3d4a44; font-size: 14px; line-height: 1.45; }
    .error { color: #8d2b2b; }
    footer { padding: 0 0 28px; color: #8a938d; font-size: 13px; }
    .receipt dt { color: #8a938d; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 14px; }
    .receipt dd { margin: 4px 0 0; font-size: 18px; }
  </style>
</head>
<body>
  <header>
    <strong>AINF</strong>
    <nav>
      <a href="/">Home</a>
      <a href="/causes">Missions</a>
      <a href="/projects">Projects</a>
      <a href="/contact-us">Contact</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer>All India Nevarlands Foundation · Nala, Jamtara, Jharkhand</footer>
</body>
</html>`;
}

export function donatePageHtml(): string {
  return page(
    "Give to AINF",
    `<h1>Give to AINF</h1>
     <p class="lead">This is a gift. It is not a Field Sevak membership, and it does not need an account.</p>
     <form id="gift">
       <label>Your name<input name="name" autocomplete="name" required maxlength="80"></label>
       <label>Email<input name="email" type="email" autocomplete="email" required maxlength="200"></label>
       <label>Phone<input name="phone" type="tel" autocomplete="tel" required maxlength="20"></label>
       <label>Where it goes<select name="target" id="target" required></select></label>
       <div class="chips" id="chips"></div>
       <label>Amount (₹)<input name="amount" id="amount" inputmode="decimal" required></label>
       <button class="pay" id="pay" type="submit">Give now</button>
       <p class="note" id="note"></p>
     </form>
     <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
     <script>
     (function () {
       var form = document.getElementById("gift");
       var target = document.getElementById("target");
       var chips = document.getElementById("chips");
       var amount = document.getElementById("amount");
       var note = document.getElementById("note");
       var pay = document.getElementById("pay");
       var targets = [];
       function rupees(paise) { return (paise / 100).toLocaleString("en-IN"); }
       function selected() {
         return targets.find(function (row) { return row.kind + ":" + row.slug === target.value; }) || targets[0];
       }
       function paintChips() {
         var row = selected();
         chips.innerHTML = "";
         if (!row) return;
         note.textContent = "Minimum for this gift is ₹" + rupees(row.minPaise) + ".";
         (row.suggestedPaise || []).forEach(function (paise) {
           var button = document.createElement("button");
           button.type = "button";
           button.textContent = "₹" + rupees(paise);
           button.addEventListener("click", function () {
             amount.value = String(paise / 100);
             Array.prototype.forEach.call(chips.children, function (child) { child.classList.remove("is-on"); });
             button.classList.add("is-on");
           });
           chips.appendChild(button);
         });
       }
       function say(text, isError) {
         note.textContent = text;
         note.className = isError ? "note error" : "note";
       }
       fetch("/api/donations/targets" + location.search, { headers: { accept: "application/json" } })
         .then(function (response) { return response.json(); })
         .then(function (body) {
           targets = body.targets || [];
           targets.forEach(function (row) {
             var option = document.createElement("option");
             option.value = row.kind + ":" + row.slug;
             option.textContent = row.title;
             if (body.selected && body.selected.kind === row.kind && body.selected.slug === row.slug) option.selected = true;
             target.appendChild(option);
           });
           paintChips();
         })
         .catch(function () { say("Gifts could not be loaded. Refresh and try again.", true); });
       target.addEventListener("change", paintChips);
       form.addEventListener("submit", function (event) {
         event.preventDefault();
         var row = selected();
         if (!row) return;
         var raw = String(amount.value || "").trim();
         if (!/^\\d+(\\.\\d{1,2})?$/.test(raw)) {
           say("Enter an amount in rupees, with up to two decimals.", true);
           return;
         }
         var paise = Math.round(Number(raw) * 100);
         if (paise < row.minPaise) {
           say("That is below the minimum of ₹" + rupees(row.minPaise) + ".", true);
           return;
         }
         pay.disabled = true;
         say("Opening the payment window…", false);
         fetch("/api/donations/order", {
           method: "POST",
           headers: { "content-type": "application/json" },
           body: JSON.stringify({
             kind: row.kind,
             slug: row.slug,
             amountPaise: paise,
             name: form.name.value,
             email: form.email.value,
             phone: form.phone.value
           })
         }).then(function (response) { return response.json().then(function (body) { return { ok: response.ok, body: body }; }); })
           .then(function (result) {
             if (!result.ok || !window.Razorpay) {
               pay.disabled = false;
               say((result.body && result.body.message) || "The gift could not be started.", true);
               return;
             }
             var checkout = new window.Razorpay({
               key: result.body.keyId,
               amount: result.body.amountPaise,
               currency: "INR",
               name: "AINF",
               description: result.body.description,
               order_id: result.body.razorpayOrderId,
               prefill: { name: form.name.value, email: form.email.value, contact: form.phone.value },
               handler: function (response) {
                 fetch("/api/donations/confirm", {
                   method: "POST",
                   headers: { "content-type": "application/json" },
                   body: JSON.stringify(response)
                 }).then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
                   .then(function (done) {
                     if (done.ok && done.body.receiptPath) location.assign(done.body.receiptPath);
                     else {
                       pay.disabled = false;
                       say((done.body && done.body.message) || "If money left your account, the receipt will arrive by email.", true);
                     }
                   });
               },
               modal: { ondismiss: function () { pay.disabled = false; say("The gift was not taken.", false); } }
             });
             checkout.open();
           })
           .catch(function () { pay.disabled = false; say("The gift could not be started.", true); });
       });
     })();
     </script>`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicClerkKey(): string {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  return /^pk_(test|live)_[A-Za-z0-9_+=/-]+$/.test(key) ? key : "";
}

function receiptDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/assets/css/ainf-site-nav.css?v=20261003a">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Onest, Inter, system-ui, sans-serif;
      background: #f4f7f5;
      color: #1a1d1b;
    }
    .receipt-page {
      width: min(640px, calc(100% - 32px));
      margin: 0 auto;
      padding: 118px 0 48px;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #e7f6ee;
      color: #1c7d48;
      font-size: 13px;
      font-weight: 500;
    }
    .eyebrow.is-returned { background: #f3f1ea; color: #6a5b32; }
    .seal {
      margin: 8px 0 16px;
      padding-top: 14px;
      border-top: 1px solid #e7ece9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .seal p { margin: 0; color: #5c6b64; font-size: 13px; line-height: 1.45; }
    .seal .check {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 8px 14px;
      background: #e7f6ee;
      color: #1c7d48;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
    }
    .seal-print { display: none; }
    .seal-print code {
      display: block;
      margin-top: 8px;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 11px;
      line-height: 1.55;
      letter-spacing: 0.02em;
      overflow-wrap: anywhere;
      color: #1a1d1b;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(32px, 5vw, 44px);
      font-weight: 500;
      letter-spacing: -0.04em;
      line-height: 1.05;
    }
    .lead { margin: 0 0 22px; color: #3d4a44; font-size: 16px; line-height: 1.5; }
    .sheet {
      background: #fff;
      border: 1px solid #e2e7e4;
      border-radius: 22px;
      padding: 22px 22px 8px;
      box-shadow: 0 16px 40px rgba(20, 30, 25, 0.06);
    }
    .amount {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 16px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e7ece9;
    }
    .amount span { color: #5c6b64; font-size: 14px; }
    .amount strong { font-size: 36px; font-weight: 500; letter-spacing: -0.04em; }
    dl { margin: 0; }
    .row {
      display: grid;
      grid-template-columns: 148px 1fr;
      gap: 12px;
      padding: 13px 0;
      border-bottom: 1px solid #eef2f0;
    }
    .row:last-child { border-bottom: 0; }
    dt { margin: 0; color: #5c6b64; font-size: 14px; font-weight: 500; }
    dd { margin: 0; font-size: 15px; line-height: 1.4; overflow-wrap: anywhere; }
    .soft {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: #e7f6ee;
      color: #1c7d48;
      font-size: 13px;
      font-weight: 500;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .actions a, .actions button {
      font: inherit;
      border-radius: 999px;
      padding: 12px 18px;
      text-decoration: none;
      cursor: pointer;
    }
    .actions .home { background: #1c7d48; color: #fff; border: 0; }
    .actions .plain { background: #fff; color: #1a1d1b; border: 1px solid rgba(34, 34, 34, 0.15); }
    footer { margin-top: 28px; color: #8a938d; font-size: 13px; line-height: 1.5; }
    @media (max-width: 640px) {
      .row { grid-template-columns: 1fr; gap: 4px; }
      .amount strong { font-size: 30px; }
    }
    @media print {
      #ainf-global-nav, #ainf-support-banner, .actions { display: none !important; }
      body { background: #fff; }
      .receipt-page { padding-top: 12px; }
      .sheet { box-shadow: none; }
      .seal-screen { display: none !important; }
      .seal-print { display: block !important; }
    }
  </style>
</head>
<body>
  <main class="receipt-page">${body}</main>
  <script src="/assets/js/ainf-site-nav.js?v=20261003d" id="ainf-site-nav-js" data-clerk-key="${publicClerkKey()}"></script>
</body>
</html>`;
}

function receiptRow(label: string, value: string, soft = false): string {
  const body = soft ? `<span class="soft">${escapeHtml(value)}</span>` : escapeHtml(value);
  return `<div class="row"><dt>${escapeHtml(label)}</dt><dd>${body}</dd></div>`;
}

export function receiptPageHtml(input: {
  name: string;
  email: string;
  phone: string;
  amount: string;
  target: string;
  when: string;
  status: string;
  paymentId: string;
  refundId: string;
  returned: boolean;
  emailed: boolean;
  verified: boolean;
  seal: string;
  verifyUrl: string;
}): string {
  const who = input.name.trim() || "friend";
  const title = input.returned ? "Gift returned" : "Thank you";
  const lead = input.returned
    ? `The gift of ${input.amount} for ${input.target} has been returned in full. It can take a few working days to show on the statement.`
    : `Your gift of ${input.amount} for ${input.target} is received. This page stays here if you refresh it. It is a record of the gift, not a tax certificate, and not a Field Sevak membership.`;
  const mail = input.emailed
    ? ` A copy was sent to ${input.email}.`
    : "";
  const rows = [
    receiptRow("Full Name", input.name),
    receiptRow("Email ID", input.email),
    receiptRow("Phone", input.phone),
    receiptRow("Desk / Vertical", input.target),
    receiptRow("When", input.when),
    receiptRow("Status", input.status),
    receiptRow("Payment reference", input.paymentId),
    input.refundId ? receiptRow("Return reference", input.refundId) : "",
    input.verified ? receiptRow("Verification", "Verified payment", true) : "",
  ].join("");
  const sealBlock = "";
  const eyebrow = input.verified && !input.returned ? "Verified payment" : input.status;
  return receiptDocument(
    `${title} · AINF`,
    `<p class="eyebrow${input.returned ? " is-returned" : ""}">${escapeHtml(eyebrow)}</p>
     <h1>${escapeHtml(title)}, ${escapeHtml(who)}.</h1>
     <p class="lead">${escapeHtml(lead)}${escapeHtml(mail)}</p>
     <article class="sheet">
       <div class="amount"><span>Amount (INR)</span><strong>${escapeHtml(input.amount)}</strong></div>
       <dl>${rows}</dl>
       ${sealBlock}
       ${input.verified ? `<input type="hidden" name="ainf-receipt-seal" value="${escapeHtml(input.seal.replace(/\s+/g, ""))}">` : ""}
     </article>
     <div class="actions">
       <a class="home" href="/">Back to home</a>
       <button class="plain" type="button" onclick="window.print()">Print</button>
     </div>
     <footer>All India Nevarlands Foundation · Nala, Jamtara, Jharkhand</footer>`
  );
}

export function receiptVerifyHtml(input: {
  state: "empty" | "invalid" | "verified" | "returned" | "mismatch";
  seal: string;
  lines: Array<{ label: string; value: string }>;
}): string {
  const copy = {
    empty: ["Receipt check", "Open a gift receipt. This website checks the seal in the background."],
    invalid: ["Seal did not open", "That code is not an AINF seal, or it was changed after it was made."],
    verified: ["Verified payment", "This seal opened on AINF and matches the gift on record."],
    returned: ["Verified, then returned", "This seal is genuine. The gift has since been returned in full."],
    mismatch: ["Seal does not match", "The seal opened, but it does not match the gift now on record."],
  }[input.state];
  const rows = input.lines.map((line) => receiptRow(line.label, line.value)).join("");
  return receiptDocument(
    `${copy[0]} · AINF`,
    `<p class="eyebrow${input.state === "verified" ? "" : " is-returned"}">${escapeHtml(copy[0])}</p>
     <h1>${escapeHtml(copy[0])}</h1>
     <p class="lead">${escapeHtml(copy[1])}</p>
     ${rows ? `<article class="sheet"><dl>${rows}</dl></article>` : ""}
     <div class="actions"><a class="home" href="/">Back to home</a></div>
     <footer>All India Nevarlands Foundation · Nala, Jamtara, Jharkhand</footer>`
  );
}

export function receiptMissingHtml(): string {
  return receiptDocument(
    "Receipt not found · AINF",
    `<p class="eyebrow is-returned">Not found</p>
     <h1>Receipt not found</h1>
     <p class="lead">That link does not match a received gift. Open the receipt from the email, or ask us to re-send it.</p>
     <div class="actions"><a class="home" href="/donate/receipt">Get my receipt</a><a class="plain" href="/">Back to home</a></div>
     <footer>All India Nevarlands Foundation · Nala, Jamtara, Jharkhand</footer>`
  );
}

/** Self-service receipt recovery for guests who gave without an account. */
export function receiptLookupHtml(): string {
  return receiptDocument(
    "Get your receipt · AINF",
    `<p class="eyebrow">Receipt recovery</p>
     <h1>Get your receipt</h1>
     <p class="lead">Lost the email? Enter the email you gave with and we will re-send your receipt links to it.</p>
     <article class="sheet">
       <form id="ainf-receipt-lookup" novalidate>
         <label for="ainf-receipt-email" style="display:block;margin:0 0 8px;color:#5c6b64;font-size:14px;font-weight:500">Email you gave with</label>
         <input id="ainf-receipt-email" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="200" placeholder="you@example.com"
           style="width:100%;padding:13px 14px;border:1px solid #d7ded9;border-radius:12px;font:inherit;font-size:15px;background:#fff;color:#1a1d1b" />
         <div class="actions">
           <button type="submit" class="home" id="ainf-receipt-submit">Email my receipt</button>
           <a class="plain" href="/">Back to home</a>
         </div>
         <p id="ainf-receipt-msg" role="status" aria-live="polite" style="margin:14px 0 6px;color:#3d4a44;font-size:14px;line-height:1.5;min-height:1px"></p>
       </form>
     </article>
     <footer>All India Nevarlands Foundation · Nala, Jamtara, Jharkhand</footer>
     <script>
       (function () {
         var form = document.getElementById("ainf-receipt-lookup");
         var email = document.getElementById("ainf-receipt-email");
         var button = document.getElementById("ainf-receipt-submit");
         var msg = document.getElementById("ainf-receipt-msg");
         if (!form || !email || !button || !msg) return;
         form.addEventListener("submit", function (event) {
           event.preventDefault();
           var value = (email.value || "").trim();
           if (!value || value.indexOf("@") < 1) {
             msg.style.color = "#8a3b32";
             msg.textContent = "Enter the email you gave with.";
             return;
           }
           button.disabled = true;
           button.textContent = "Sending…";
           msg.style.color = "#3d4a44";
           msg.textContent = "";
           fetch("/api/donations/receipt/resend", {
             method: "POST",
             headers: { "content-type": "application/json" },
             body: JSON.stringify({ email: value }),
           })
             .then(function (res) { return res.json().catch(function () { return {}; }); })
             .then(function (data) {
               msg.style.color = "#1c7d48";
               msg.textContent =
                 (data && data.message) ||
                 "If that email has any received gifts, we've sent the receipt links to it.";
             })
             .catch(function () {
               msg.style.color = "#8a3b32";
               msg.textContent = "Something went wrong. Please try again in a moment.";
             })
             .finally(function () {
               button.disabled = false;
               button.textContent = "Email my receipt";
             });
         });
       })();
     </script>`
  );
}
