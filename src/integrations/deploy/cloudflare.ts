import { logger } from "@/lib/logger";

const AGENT = "builder";

type DeployResult = {
  url: string;
  projectName: string;
  deploymentId: string;
};

export async function deployToCloudflarePages(
  projectName: string,
  html: string,
  opts: { apiToken: string; accountId: string }
): Promise<DeployResult> {
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 58);

  await ensureProject(safeName, opts);

  const form = new FormData();
  const blob = new Blob([html], { type: "text/html" });
  form.append("index.html", blob, "index.html");

  const deployUrl = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/pages/projects/${safeName}/deployments`;

  const res = await fetch(deployUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiToken}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(AGENT, `Cloudflare deploy failed: ${res.status}`, { body: text });
    throw new Error(`Cloudflare deploy ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    result: { id: string; url: string };
  };

  const url = `https://${safeName}.pages.dev`;

  logger.info(AGENT, `Deployed: ${url}`);

  return {
    url,
    projectName: safeName,
    deploymentId: data.result.id,
  };
}

async function ensureProject(
  name: string,
  opts: { apiToken: string; accountId: string }
): Promise<void> {
  const checkUrl = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/pages/projects/${name}`;

  const check = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${opts.apiToken}` },
  });

  if (check.ok) return;

  const createUrl = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/pages/projects`;

  const create = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      production_branch: "main",
    }),
  });

  if (!create.ok) {
    const text = await create.text();
    if (!text.includes("already exists")) {
      throw new Error(`Cloudflare create project ${create.status}: ${text}`);
    }
  }
}
