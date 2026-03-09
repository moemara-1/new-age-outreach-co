import { logger } from "@/lib/logger";

const AGENT = "intel";

type SearXNGResult = {
    title: string;
    content: string;
    url: string;
};

/**
 * Run multiple targeted SearXNG queries for comprehensive business intelligence.
 * Returns structured data: web snippets, emails found, phone numbers, social links.
 */
export async function deepBusinessResearch(
    businessName: string,
    address?: string | null,
    category?: string | null
): Promise<{
    webSnippets: string;
    emails: string[];
    phones: string[];
    socialLinks: { platform: string; url: string }[];
    menuInfo: string;
}> {
    const searxngUrl = process.env.SEARXNG_URL || "http://localhost:8080";
    const location = address ? address.split(",")[0]?.trim() : "";

    // Multiple targeted search queries
    const queries = [
        { label: "general", q: `"${businessName}" ${location}` },
        { label: "contact", q: `"${businessName}" ${location} email contact phone` },
        { label: "social", q: `"${businessName}" ${location} facebook instagram site:facebook.com OR site:instagram.com` },
    ];

    // Add menu search for food-related businesses
    const foodCategories = ["restaurant", "cafe", "bakery", "pizza", "burger", "sushi", "food", "diner", "bistro", "grill", "kitchen"];
    const isFood = foodCategories.some((c) => (category || "").toLowerCase().includes(c) || businessName.toLowerCase().includes(c));
    if (isFood) {
        queries.push({ label: "menu", q: `"${businessName}" ${location} menu prices` });
    }

    const allResults: { label: string; results: SearXNGResult[] }[] = [];

    for (const { label, q } of queries) {
        try {
            const res = await fetch(
                `${searxngUrl}/search?q=${encodeURIComponent(q)}&format=json&categories=general&engines=google,bing,duckduckgo`,
                { signal: AbortSignal.timeout(15000) }
            );

            if (!res.ok) continue;

            const data = await res.json();
            const results: SearXNGResult[] = (data.results ?? []).slice(0, 10);
            allResults.push({ label, results });

            // Small delay between queries to be polite
            await new Promise((r) => setTimeout(r, 1000));
        } catch {
            // Skip failed queries silently
        }
    }

    if (allResults.length === 0) {
        logger.info(AGENT, `SearXNG returned no results for ${businessName}`);
        return { webSnippets: "", emails: [], phones: [], socialLinks: [], menuInfo: "" };
    }

    // Combine all text for extraction
    const allText = allResults
        .flatMap((r) => r.results)
        .map((r) => `${r.title} ${r.content} ${r.url}`)
        .join(" ");

    // Extract emails with quality filtering
    const emails = extractEmails(allText, businessName);

    // Extract phone numbers (Egyptian format)
    const phones = extractPhones(allText);

    // Extract social media links
    const socialLinks = extractSocialLinks(allResults.flatMap((r) => r.results));

    // Build web snippets for LLM
    const webSnippets = allResults
        .map(({ label, results }) => {
            if (results.length === 0) return "";
            const snippets = results
                .map((r, i) => `  [${i + 1}] ${r.title}\n      ${r.content}\n      URL: ${r.url}`)
                .join("\n");
            return `### ${label.toUpperCase()} RESULTS:\n${snippets}`;
        })
        .filter(Boolean)
        .join("\n\n");

    // Extract menu info from food search
    const menuResults = allResults.find((r) => r.label === "menu");
    const menuInfo = menuResults
        ? menuResults.results.map((r) => `${r.title}: ${r.content}`).join("\n")
        : "";

    logger.info(AGENT, `Research complete for ${businessName}`, {
        queries: allResults.length,
        totalResults: allResults.reduce((acc, r) => acc + r.results.length, 0),
        emailsFound: emails.length,
        phonesFound: phones.length,
        socialsFound: socialLinks.length,
    });

    return { webSnippets, emails, phones, socialLinks, menuInfo };
}

/**
 * Extract and validate emails, filtering out junk domains.
 * Prioritizes emails that seem related to the business.
 */
function extractEmails(text: string, businessName: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const rawEmails = text.match(emailRegex) ?? [];

    // Junk domains to filter out
    const junkDomains = [
        "example.com", "sentry.io", "wixpress.com", "googleapis.com",
        "schema.org", "w3.org", "jquery.com", "wordpress.org",
        "gravatar.com", "facebook.com", "twitter.com", "instagram.com",
        "google.com", "youtube.com", "linkedin.com", "tiktok.com",
        "autobytel.com", "uber.com", "tripadvisor.com", "booking.com",
        "yelp.com", "zomato.com", "foursquare.com", "opentable.com",
        "doordash.com", "grubhub.com", "ubereats.com", "deliveroo.com",
        "elmenus.com", "talabat.com", "otlob.com", "wolt.com",
        "apple.com", "microsoft.com", "amazon.com", "cloudflare.com",
        "github.com", "vercel.com", "netlify.com", "heroku.com",
    ];

    const junkPrefixes = ["noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster", "webmaster", "info@wix", "support@"];

    const filtered = rawEmails.filter((email) => {
        const lower = email.toLowerCase();
        // Filter junk domains
        if (junkDomains.some((d) => lower.endsWith(`@${d}`))) return false;
        // Filter junk prefixes
        if (junkPrefixes.some((p) => lower.startsWith(p))) return false;
        // Filter clearly non-business emails (very short TLDs, etc.)
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".css") || lower.endsWith(".js")) return false;
        return true;
    });

    // Deduplicate
    const unique = [...new Set(filtered.map((e) => e.toLowerCase()))];

    // Sort: business-related emails first
    const bizNameLower = businessName.toLowerCase().replace(/[^a-z]/g, "");
    return unique.sort((a, b) => {
        const aRelated = a.includes(bizNameLower) || a.includes("info@") || a.includes("contact@") || a.includes("hello@");
        const bRelated = b.includes(bizNameLower) || b.includes("info@") || b.includes("contact@") || b.includes("hello@");
        if (aRelated && !bRelated) return -1;
        if (!aRelated && bRelated) return 1;
        return 0;
    });
}

/**
 * Extract phone numbers (supports Egyptian and international formats).
 */
function extractPhones(text: string): string[] {
    const phonePatterns = [
        /\+?20\s*\d{2}\s*\d{4}\s*\d{4}/g,          // Egyptian: +20 xx xxxx xxxx
        /01[0-9]\s*\d{4}\s*\d{4}/g,                 // Egyptian mobile: 01x xxxx xxxx
        /0\d{1,2}\s*\d{4}\s*\d{4}/g,                // Egyptian landline
        /\+?\d{1,3}[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, // International
    ];

    const allPhones: string[] = [];
    for (const pattern of phonePatterns) {
        const matches = text.match(pattern) ?? [];
        allPhones.push(...matches.map((p) => p.replace(/\s+/g, " ").trim()));
    }

    // Deduplicate by removing spaces and comparing
    const seen = new Set<string>();
    return allPhones.filter((p) => {
        const normalized = p.replace(/[\s.-]/g, "");
        if (normalized.length < 8 || normalized.length > 15) return false;
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    });
}

/**
 * Extract social media profile links from search results.
 */
function extractSocialLinks(results: SearXNGResult[]): { platform: string; url: string }[] {
    const socialPatterns: { platform: string; pattern: RegExp }[] = [
        { platform: "facebook", pattern: /https?:\/\/(www\.)?facebook\.com\/[^\s"',)]+/gi },
        { platform: "instagram", pattern: /https?:\/\/(www\.)?instagram\.com\/[^\s"',)]+/gi },
        { platform: "tiktok", pattern: /https?:\/\/(www\.)?tiktok\.com\/@[^\s"',)]+/gi },
        { platform: "yelp", pattern: /https?:\/\/(www\.)?yelp\.com\/biz\/[^\s"',)]+/gi },
        { platform: "tripadvisor", pattern: /https?:\/\/(www\.)?tripadvisor\.[a-z.]+\/[^\s"',)]+/gi },
    ];

    const links: { platform: string; url: string }[] = [];
    const allText = results.map((r) => `${r.url} ${r.content}`).join(" ");

    for (const { platform, pattern } of socialPatterns) {
        const matches = allText.match(pattern) ?? [];
        if (matches.length > 0) {
            links.push({ platform, url: matches[0] });
        }
    }

    return links;
}
