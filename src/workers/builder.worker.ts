import { Worker, Job, Queue } from "bullmq";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { generateText } from "../integrations/llm/openrouter";

const AGENT = "builder";

export type BuilderJobData = {
  leadId: string;
  agentRunId: string;
};

export function createBuilderWorker(connection: { host: string; port: number }) {
  const db = new PrismaClient();

  return new Worker<BuilderJobData>(
    "builder",
    async (job: Job<BuilderJobData>) => {
      const { leadId, agentRunId } = job.data;

      await db.agentRun.update({
        where: { id: agentRunId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      try {
        const lead = await db.lead.findUniqueOrThrow({
          where: { id: leadId },
          include: { business: true },
        });

        const biz = lead.business;
        const profile = lead.profileJson as Record<string, unknown> | null;

        logger.info(AGENT, `Building premium site for: ${biz.name}`);

        // Determine business type for tailored prompts
        const category = (biz.category ?? "").toLowerCase();
        const isRestaurant = ["restaurant", "cafe", "bakery", "pizza", "burger", "sushi", "food", "diner", "bistro", "grill", "kitchen", "bar"].some((c) => category.includes(c));

        // Build the prompt with ALL intel research data
        const socialLinks = (profile?.socialLinks as Array<{ platform: string; url: string }>) ?? [];
        const menuHighlights = (profile?.menuHighlights as string[]) ?? [];
        const strengths = (profile?.strengths as string[]) ?? [];
        const opportunities = (profile?.opportunities as string[]) ?? [];
        const suggestedServices = (profile?.suggestedServices as string[]) ?? [];
        const summary = (profile?.summary as string) ?? "";
        const targetAudience = (profile?.targetAudience as string) ?? "";
        const keyDifferentiator = (profile?.keyDifferentiator as string) ?? "";

        const prompt = `You are a world-class web designer. Generate a COMPLETE, BEAUTIFUL, PRODUCTION-READY single-page HTML website for this business.

## BUSINESS INFO
Name: ${biz.name}
Category: ${biz.category ?? "Local Business"}
Location: ${biz.address ?? ""}
Rating: ${biz.rating ?? "N/A"} stars (${biz.reviewCount ?? 0} reviews)
Phone: ${biz.phone ?? "Not available"}
${lead.contactEmail ? `Email: ${lead.contactEmail}` : ""}

## INTEL RESEARCH
${summary}

Target Audience: ${targetAudience}
Key Differentiator: ${keyDifferentiator}
Strengths: ${strengths.join(", ")}

## SOCIAL MEDIA
${socialLinks.length > 0 ? socialLinks.map((s) => `${s.platform}: ${s.url}`).join("\n") : "None found"}

${isRestaurant && menuHighlights.length > 0 ? `## MENU HIGHLIGHTS\n${menuHighlights.join(", ")}` : ""}

## DESIGN REQUIREMENTS — THIS IS CRITICAL

Create a STUNNING, MODERN, PREMIUM website that will WOW the business owner. This is a sales demo — it has to be so impressive they want to buy it.

### Mandatory Design Features:
1. **Hero Section**: Full-width hero with gradient overlay, large bold headline, subtitle, and CTA button. Use CSS gradients as background (no external images).
2. **Smooth Animations**: Use CSS @keyframes and scroll-triggered animations via IntersectionObserver. Elements should fade-in, slide-up, and scale on scroll.
3. **Modern Typography**: Use Google Fonts (Inter for body, Playfair Display for headings). Import via \`<link>\` from fonts.googleapis.com.
4. **Color Palette**: Use a sophisticated, harmonious color scheme. Dark hero section with accent colors. NOT generic bootstrap colors.
5. **Glass Morphism**: Use backdrop-filter: blur() and semi-transparent backgrounds for cards and nav.
6. **Micro-interactions**: Hover effects on buttons (scale, shadow lift), card hover transforms, smooth transitions on everything.
7. **Mobile Responsive**: Must look great on phones. Use media queries.
8. **Sections**: Hero → About → ${isRestaurant ? "Menu Highlights → " : ""}Services → Reviews/Testimonials → Contact → Footer
9. **Contact Section**: Show phone, email, address, Google Maps embed, and social media icons/links.
10. **Footer**: Business name, copyright, social links.

${isRestaurant ? `### Restaurant-Specific:
- Menu section with items in elegant cards showing item names
- Food-themed accent colors (warm tones: burgundy, gold, dark green)
- Reservation CTA button
- "View Full Menu" link
- Operating hours section` : ""}

### Technical:
- Output a COMPLETE HTML document with DOCTYPE, head, body
- ALL CSS must be inline in a <style> tag (no external CSS files except Google Fonts)
- ALL JavaScript must be inline in a <script> tag
- Use semantic HTML5 elements
- Include meta viewport for mobile
- Do NOT use any external libraries (no Bootstrap, no Tailwind, no jQuery)
- Use placeholder images from unsplash via https://source.unsplash.com/800x600/?${isRestaurant ? "restaurant,food" : "business,modern"} — use DIFFERENT search queries for each image
- Total size should be under 50KB

RESPOND WITH ONLY THE HTML. No markdown, no code fences, no explanation. Start with <!DOCTYPE html> and end with </html>.`;

        const html = await generateText(prompt, {
          task: "builder-html",
          system: "You are an elite web designer who creates stunning, award-winning single-page websites. Output ONLY valid HTML. No markdown. No explanation. No code fences. Start with <!DOCTYPE html>.",
          maxTokens: 16000,
          temperature: 0.7,
        });

        // Clean up any markdown artifacts
        let cleanHtml = html.trim();
        if (cleanHtml.startsWith("```")) {
          cleanHtml = cleanHtml.replace(/^```html?\s*\n?/, "").replace(/\n?```\s*$/, "");
        }
        if (!cleanHtml.startsWith("<!DOCTYPE") && !cleanHtml.startsWith("<html")) {
          // Try to extract HTML from response
          const htmlStart = cleanHtml.indexOf("<!DOCTYPE");
          if (htmlStart > -1) cleanHtml = cleanHtml.substring(htmlStart);
        }

        const placeholderUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sites/${lead.id}`;

        await db.demoSite.upsert({
          where: { leadId: lead.id },
          update: {
            url: placeholderUrl,
            template: isRestaurant ? "restaurant" : "generic",
            htmlContent: cleanHtml,
            copyJson: { prompt: "minimax-m2.5-generated", length: cleanHtml.length } as unknown as Prisma.InputJsonValue,
            generatedAt: new Date(),
          },
          create: {
            leadId: lead.id,
            url: placeholderUrl,
            template: isRestaurant ? "restaurant" : "generic",
            htmlContent: cleanHtml,
            copyJson: { prompt: "minimax-m2.5-generated", length: cleanHtml.length } as unknown as Prisma.InputJsonValue,
          },
        });

        await db.lead.update({
          where: { id: lead.id },
          data: { status: "SITE_BUILT" },
        });

        await db.activityLog.create({
          data: {
            agent: "BUILDER",
            title: `Built premium site for ${biz.name}`,
            subtitle: `${cleanHtml.length} chars, MiniMax M2.5 generated`,
            metadata: { leadId: lead.id },
          },
        });

        const result = { leadId: lead.id, url: placeholderUrl, htmlLength: cleanHtml.length };

        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "COMPLETED", finishedAt: new Date(), output: result as unknown as Prisma.InputJsonValue },
        });

        // Trigger scheduler for Outreach
        const schedulerQueue = new Queue("scheduler", { connection });
        await schedulerQueue.add("scheduled-check", { agentRunId: "" });

        logger.info(AGENT, `Built premium site: ${biz.name} -> ${placeholderUrl} (${cleanHtml.length} chars)`);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "FAILED", finishedAt: new Date(), error: message },
        });
        await db.activityLog.create({
          data: { agent: "BUILDER", title: `Failed to build site`, subtitle: message },
        });
        throw err;
      }
    },
    { connection, concurrency: 1 }
  );
}
