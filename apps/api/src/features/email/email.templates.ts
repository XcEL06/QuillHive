const brand = process.env.BRAND_NAME || "QuillHive";
const domain = process.env.MAIL_DOMAIN || "quillhive.app";
const appUrl = process.env.PUBLIC_APP_URL || `https://${domain}`;

function baseLayout(title: string, previewText: string, body: string, unsubscribeUrl?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e4e4e7;">
<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <!-- Header -->
      <tr><td style="padding:32px 40px 24px;text-align:center;">
        <a href="${appUrl}" style="text-decoration:none;">
          <span style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#f97316,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${brand}</span>
        </a>
      </td></tr>
      <!-- Body Card -->
      <tr><td style="background:#18181b;border-radius:16px;padding:40px;border:1px solid #27272a;">
        ${body}
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:24px 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#71717a;">
          © ${new Date().getFullYear()} ${brand}${unsubscribeUrl ? ` · <a href="${unsubscribeUrl}" style="color:#71717a;">Unsubscribe from these emails</a>` : ""}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function primaryButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ec4899);color:#fff;font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;">${label}</a>`;
}

export function magicLinkEmailHtml(opts: { link: string; displayName?: string }): string {
  const name = opts.displayName ? `, ${opts.displayName}` : "";
  const body = `
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fafafa;">Your magic link 🔮</h1>
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:15px;line-height:1.6;">Hey${name}! Click below to sign in to ${brand}. This link expires in <strong style="color:#f97316;">15 minutes</strong> and can only be used once.</p>
    <div style="text-align:center;">${primaryButton(opts.link, "Sign in to " + brand)}</div>
    <p style="margin:24px 0 0;font-size:12px;color:#52525b;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
  `;
  return baseLayout(`Sign in to ${brand}`, `Your sign-in link for ${brand} - expires in 15 minutes`, body);
}

export function magicLinkEmailText(opts: { link: string; displayName?: string }): string {
  const name = opts.displayName ? `, ${opts.displayName}` : "";
  return `Hey${name}!\n\nSign in to ${brand} using the link below:\n\n${opts.link}\n\nThis link expires in 15 minutes and can only be used once.\n\nIf you didn't request this, you can ignore this email.\n\n- ${brand}`;
}

export function streakMilestoneEmailHtml(opts: { displayName: string; days: number; milestoneName: string; profileUrl: string }): string {
  const emoji = opts.days >= 365 ? "🌟" : opts.days >= 100 ? "👑" : opts.days >= 60 ? "🔥" : opts.days >= 30 ? "⚡" : "🔥";
  const body = `
    <div style="text-align:center;margin-bottom:24px;font-size:56px;">${emoji}</div>
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fafafa;text-align:center;">${opts.days}-Day Streak!</h1>
    <p style="margin:0 0 4px;font-size:15px;color:#f97316;font-weight:700;text-align:center;">${opts.milestoneName} unlocked</p>
    <p style="margin:16px 0 0;color:#a1a1aa;font-size:15px;line-height:1.6;text-align:center;">
      Incredible, ${opts.displayName}! You've written on ${brand} for <strong style="color:#fafafa;">${opts.days} days in a row</strong>. That kind of consistency is rare - and it compounds.
    </p>
    <div style="text-align:center;">${primaryButton(opts.profileUrl, "See your profile")}</div>
  `;
  return baseLayout(`${opts.days}-day streak! ${opts.milestoneName} unlocked`, `You just hit a ${opts.days}-day writing streak on ${brand}!`, body);
}

export function newFollowerEmailHtml(opts: { recipientName: string; followerDisplayName: string; followerUsername: string; followerAvatarUrl?: string; profileUrl: string }): string {
  const body = `
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#fafafa;">Someone found you ✨</h1>
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:15px;line-height:1.6;">
      <strong style="color:#fafafa;">${opts.followerDisplayName}</strong> (@${opts.followerUsername}) just followed you on ${brand}. Keep creating - your audience is growing.
    </p>
    ${primaryButton(opts.profileUrl, "Visit your profile")}
  `;
  return baseLayout(`${opts.followerDisplayName} followed you on ${brand}`, `${opts.followerDisplayName} is now following your work on ${brand}`, body);
}

export function tipReceivedEmailHtml(opts: { recipientName: string; tipper: string; amountCents: number; message?: string; dashboardUrl: string }): string {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  const body = `
    <div style="text-align:center;margin-bottom:20px;font-size:48px;">💸</div>
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fafafa;text-align:center;">You received a tip!</h1>
    <p style="margin:0;font-size:36px;font-weight:900;color:#f97316;text-align:center;">${amount}</p>
    <p style="margin:16px 0 0;color:#a1a1aa;font-size:15px;line-height:1.6;text-align:center;">
      <strong style="color:#fafafa;">${opts.tipper}</strong> just sent you a tip${opts.message ? ` with a note: <em style="color:#fafafa;">"${opts.message}"</em>` : ""}.
    </p>
    <div style="text-align:center;">${primaryButton(opts.dashboardUrl, "View income dashboard")}</div>
  `;
  return baseLayout(`You received a ${amount} tip!`, `${opts.tipper} sent you ${amount} on ${brand}`, body);
}

export function weeklyDigestEmailHtml(opts: {
  displayName: string;
  topPosts: Array<{ title: string; url: string; appreciationsCount: number; viewsCount: number }>;
  followingCount: number;
  profileUrl: string;
  unsubscribeUrl?: string;
}): string {
  const postRows = opts.topPosts
    .slice(0, 5)
    .map(
      (p) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #27272a;">
          <a href="${p.url}" style="font-size:14px;font-weight:600;color:#fafafa;text-decoration:none;">${p.title}</a>
          <p style="margin:4px 0 0;font-size:12px;color:#71717a;">❤ ${p.appreciationsCount} · 👁 ${p.viewsCount} views</p>
        </td>
      </tr>`
    )
    .join("");

  const body = `
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fafafa;">Your weekly digest 📖</h1>
    <p style="margin:0 0 24px;color:#a1a1aa;font-size:14px;">Top posts from the ${opts.followingCount} creators you follow this week.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #27272a;">
      ${postRows || '<tr><td style="padding:24px 0;color:#52525b;font-size:14px;">Nothing new this week - explore new creators to grow your feed.</td></tr>'}
    </table>
    <div style="text-align:center;margin-top:24px;">${primaryButton(opts.profileUrl, "Open " + brand)}</div>
  `;
  return baseLayout(`Your ${brand} weekly digest`, `Top posts from creators you follow on ${brand}`, body, opts.unsubscribeUrl);
}

export function weeklyCreatorDigestEmailHtml(opts: {
  displayName: string;
  totalViews: number;
  newFollowers: number;
  postsPublished: number;
  topPost?: { title: string | null; views: number } | null;
  appUrl: string;
  unsubscribeUrl: string;
}): string {
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
  const name = escapeHtml(opts.displayName);
  const topPostTitle = opts.topPost ? escapeHtml(opts.topPost.title || "Untitled") : "";
  const body = `
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#fafafa;">Your weekly creator recap</h1>
    <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.7;">Hi ${name}, here's what happened around your voice on ${brand} this week.</p>
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#fafafa;">This week's highlights</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#a1a1aa;">Post views</td><td align="right" style="padding:10px 0;border-bottom:1px solid #27272a;color:#fafafa;font-weight:700;">${opts.totalViews.toLocaleString()}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#a1a1aa;">New followers</td><td align="right" style="padding:10px 0;border-bottom:1px solid #27272a;color:#fafafa;font-weight:700;">${opts.newFollowers.toLocaleString()}</td></tr>
      <tr><td style="padding:10px 0;color:#a1a1aa;">Posts published</td><td align="right" style="padding:10px 0;color:#fafafa;font-weight:700;">${opts.postsPublished.toLocaleString()}</td></tr>
    </table>
    ${opts.topPost ? `<h2 style="margin:0 0 8px;font-size:15px;font-weight:700;color:#fafafa;">Your standout post</h2><p style="margin:0 0 20px;color:#a1a1aa;font-size:14px;line-height:1.6;"><strong style="color:#fafafa;">${topPostTitle}</strong><br />${opts.topPost.views.toLocaleString()} views this week</p>` : ""}
    <div style="text-align:center;">${primaryButton(`${opts.appUrl}/dashboard`, "View your creator dashboard")}</div>
    <p style="margin:24px 0 0;color:#a1a1aa;font-size:14px;line-height:1.7;">Keep sharing your voice; your hive is growing.<br /><strong style="color:#fafafa;">The ${brand} team</strong></p>
    <p style="margin:20px 0 0;color:#71717a;font-size:12px;text-align:center;"><a href="${opts.appUrl}/settings" style="color:#a1a1aa;">Manage email settings</a> · <a href="${opts.unsubscribeUrl}" style="color:#a1a1aa;">Unsubscribe</a></p>
  `;
  return baseLayout("Your weekly creator recap", "A clear look at your QuillHive growth this week.", body, opts.unsubscribeUrl);
}

export function welcomeEmailHtml(opts: { displayName: string; username: string; appUrl?: string; verificationUrl?: string }): string {
  const url = opts.appUrl || appUrl;
  const body = `
    <div style="text-align:center;margin-bottom:28px;font-size:52px;">🎉</div>
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#fafafa;text-align:center;">Welcome to ${brand}, ${opts.displayName}!</h1>
    <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.7;text-align:center;">
      Your quill is your voice. Your hive is where it grows. Grow, get discovered, and find real opportunities - for everyone.
      Here's how to make the most of your first 48 hours.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:12px 0;border-bottom:1px solid #27272a;">
        <table><tr>
          <td style="padding-right:12px;font-size:20px;">✍️</td>
          <td><strong style="color:#fafafa;font-size:14px;">Publish your first post</strong><br/><span style="color:#a1a1aa;font-size:13px;">Share something you know, think, or feel. Any length. Any topic.</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #27272a;">
        <table><tr>
          <td style="padding-right:12px;font-size:20px;">🔥</td>
          <td><strong style="color:#fafafa;font-size:14px;">Build your writing streak</strong><br/><span style="color:#a1a1aa;font-size:13px;">Even a short spark counts. Consistency unlocks your Growth Score.</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #27272a;">
        <table><tr>
          <td style="padding-right:12px;font-size:20px;">📊</td>
          <td><strong style="color:#fafafa;font-size:14px;">Visit your Creator Dashboard</strong><br/><span style="color:#a1a1aa;font-size:13px;">Track followers, views, and your Growth Score - all in one place.</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 0;">
        <table><tr>
          <td style="padding-right:12px;font-size:20px;">🌐</td>
          <td><strong style="color:#fafafa;font-size:14px;">Explore creators in your niche</strong><br/><span style="color:#a1a1aa;font-size:13px;">Follow 5–10 creators you admire - the feed gets better fast.</span></td>
        </tr></table>
      </td></tr>
    </table>
    <div style="text-align:center;margin-top:28px;">${primaryButton(opts.verificationUrl || `${url}/write`, opts.verificationUrl ? "Verify your email" : "Write your first post →")}</div>
    <p style="margin:20px 0 0;font-size:12px;color:#52525b;text-align:center;">
      Your profile: <a href="${url}/profile/${opts.username}" style="color:#a1a1aa;">@${opts.username}</a>
    </p>
  `;
  return baseLayout(`Welcome to ${brand} - let's get you growing`, `You're in. Here's how to make your first 48 hours count.`, body);
}

export function welcomeEmailText(opts: { displayName: string; username: string; appUrl?: string; verificationUrl?: string }): string {
  const url = opts.appUrl || appUrl;
  return `Welcome to ${brand}, ${opts.displayName}!\n\nPlease verify your email before signing in: ${opts.verificationUrl || `${url}/write`}\n\nYour quill is your voice. Your hive is where it grows. Grow, get discovered, and find real opportunities - for everyone.\n\n✍️  Publish your first post: ${url}/write\n🔥  Build your writing streak\n📊  Visit your dashboard: ${url}/dashboard\n🌐  Explore people: ${url}/explore\n\nYour profile: ${url}/profile/${opts.username}\n\n- The ${brand} team`;
}

export function day3NurtureHtml(opts: { displayName: string; username: string; appUrl?: string; unsubscribeUrl?: string }): string {
  const url = opts.appUrl || appUrl;
  const body = `
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fafafa;">Day 3 check-in, ${opts.displayName} 👋</h1>
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:15px;line-height:1.7;">
      You've been on ${brand} for 3 days. Creators who post in their first week are <strong style="color:#f97316;">3× more likely</strong> to build a following that sticks.
    </p>
    <p style="margin:0 0 8px;color:#a1a1aa;font-size:14px;">Haven't posted yet? Try one of these:</p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#a1a1aa;font-size:14px;line-height:2;">
      <li>A short opinion on something in your field</li>
      <li>A lesson you learned the hard way</li>
      <li>A question you've been thinking about</li>
    </ul>
    <div style="text-align:center;">${primaryButton(`${url}/write`, "Write something today")}</div>
    <p style="margin:20px 0 0;color:#71717a;font-size:12px;text-align:center;"><a href="${url}/settings" style="color:#a1a1aa;">Manage email settings</a></p>
  `;
  return baseLayout(`Day 3: ${opts.displayName}, don't miss this window`, `Creators who post in week 1 grow 3× faster.`, body, opts.unsubscribeUrl);
}

export function day7NurtureHtml(opts: { displayName: string; postCount: number; followerCount: number; appUrl?: string; unsubscribeUrl?: string }): string {
  const url = opts.appUrl || appUrl;
  const hasPosts = opts.postCount > 0;
  const body = `
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fafafa;">One week in 🎯</h1>
    ${hasPosts ? `
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:15px;line-height:1.7;">
      You've published <strong style="color:#f97316;">${opts.postCount} post${opts.postCount !== 1 ? "s" : ""}</strong> and earned
      <strong style="color:#f97316;">${opts.followerCount} follower${opts.followerCount !== 1 ? "s" : ""}</strong>.
      That's momentum. Keep it going - your Growth Score rises with consistency.
    </p>
    ` : `
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:15px;line-height:1.7;">
      Your first week is the most important. Right now you have a head start - the algorithm favors new creators.
      Don't let the window close without publishing something.
    </p>
    `}
    <div style="text-align:center;">${primaryButton(`${url}/dashboard`, "View your Growth Score")}</div>
    <p style="margin:20px 0 0;color:#71717a;font-size:12px;text-align:center;"><a href="${url}/settings" style="color:#a1a1aa;">Manage email settings</a></p>
  `;
  return baseLayout(`Week 1 wrap-up - how are you doing?`, `Your first week on ${brand} - let's see your progress.`, body, opts.unsubscribeUrl);
}
