import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.activityLog.deleteMany();
  await db.outreachMessage.deleteMany();
  await db.payment.deleteMany();
  await db.demoSite.deleteMany();
  await db.agentRun.deleteMany();
  await db.lead.deleteMany();
  await db.business.deleteMany();
  await db.campaign.deleteMany();

  const campaign = await db.campaign.create({
    data: { name: "Amsterdam Restaurants", location: "Amsterdam, NL", category: "restaurant" },
  });

  const businesses = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      db.business.create({
        data: {
          placeId: `place_${i}`,
          name: [
            "De Kas", "Café George", "The Pantry", "Moeders", "Blauw",
            "Rijsel", "Bakers & Roasters", "Pluk", "CT Coffee", "Worst Wijncafé",
            "Foodhallen", "Café de Klos",
          ][i],
          address: `${100 + i} Keizersgracht, Amsterdam`,
          category: "restaurant",
          rating: 3.5 + Math.random() * 1.5,
          reviewCount: Math.floor(50 + Math.random() * 400),
        },
      })
    )
  );

  const leads = await Promise.all(
    businesses.map((biz, i) =>
      db.lead.create({
        data: {
          businessId: biz.id,
          campaignId: campaign.id,
          status: (["NEW", "RESEARCHED", "SITE_BUILT", "CONTACTED", "REPLIED", "INTERESTED"] as const)[i % 6],
          leadScore: Math.floor(40 + Math.random() * 60),
        },
      })
    )
  );

  const siteBuiltLeads = leads.filter((_, i) => i % 6 >= 2);
  await Promise.all(
    siteBuiltLeads.map((lead) =>
      db.demoSite.create({
        data: {
          leadId: lead.id,
          url: `https://${lead.id}.max-demo.pages.dev`,
          template: "restaurant",
        },
      })
    )
  );

  const contactedLeads = leads.filter((_, i) => i % 6 >= 3);
  await Promise.all(
    contactedLeads.map((lead) =>
      db.outreachMessage.create({
        data: {
          leadId: lead.id,
          type: "INITIAL",
          subject: "We built something for your business",
          body: "Hi, we noticed your restaurant doesn't have a website...",
          sentAt: new Date(Date.now() - Math.random() * 86400000 * 3),
        },
      })
    )
  );

  const now = new Date();
  const entries = [
    { agent: "SCOUT" as const, title: "Campaign started — searching Google Maps", offset: 0 },
    { agent: "SCOUT" as const, title: "Found 50 leads in Amsterdam", subtitle: "50 leads", offset: 3000 },
    { agent: "INTEL" as const, title: "Audited 50 leads — avg spd 34, seo 48", subtitle: "spd 34  ·  seo 48  ·  mob 31", offset: 9000 },
    { agent: "BUILDER" as const, title: "Built 50 demo sites", offset: 16000 },
    { agent: "OUTREACH" as const, title: "Sent 50 emails", subtitle: '"We built something for your business — take a look"', offset: 21000 },
    { agent: "CLOSER" as const, title: "Generated 12 call scripts for warm leads", subtitle: "12 scripts generated", offset: 35000 },
  ];

  await Promise.all(
    entries.map((e) =>
      db.activityLog.create({
        data: {
          agent: e.agent,
          title: e.title,
          subtitle: e.subtitle,
          createdAt: new Date(now.getTime() - e.offset),
        },
      })
    )
  );

  await db.agentRun.create({
    data: {
      agent: "SCOUT",
      campaignId: campaign.id,
      status: "COMPLETED",
      startedAt: new Date(now.getTime() - 60000),
      finishedAt: now,
    },
  });

  console.log("Seeded: 1 campaign, 12 businesses, 12 leads, 6 activity entries");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
