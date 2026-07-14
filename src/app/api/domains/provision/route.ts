import { exec } from "child_process";
import { promises as fs } from "fs";
import { promisify } from "util";
import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "../../../../../convex/_generated/api";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { domain, action } = await request.json();

    if (!domain) {
      return new Response(JSON.stringify({ error: "Domain required" }), {
        status: 400,
      });
    }

    // Sanitize domain to prevent injection
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, "");
    if (safeDomain !== domain) {
      return new Response(
        JSON.stringify({ error: "Invalid domain characters" }),
        { status: 400 }
      );
    }

    // This endpoint controls nginx + certbot on the VPS. Require an
    // authenticated caller who is the OWNER of an org that has this domain
    // registered (verified server-side against Convex with the caller's
    // identity), before touching any system config.
    const token = await convexAuthNextjsToken();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);
    const owned = await convex.query(api.domains.getOwnedByCaller, {
      domain: safeDomain,
    });
    if (!owned) {
      return new Response(
        JSON.stringify({ error: "Forbidden: you do not own this domain" }),
        { status: 403 }
      );
    }

    if (action === "remove") {
      // Remove Nginx config and reload
      try {
        await fs.unlink(`/etc/nginx/sites-enabled/${safeDomain}`);
        await fs.unlink(`/etc/nginx/sites-available/${safeDomain}`);
      } catch {
        // Files might not exist
      }
      await execAsync("nginx -t && systemctl reload nginx");
      return new Response(
        JSON.stringify({ success: true, message: "Domain removed" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create Nginx config for the domain
    const nginxConfig = `server {
    server_name ${safeDomain};

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 25m;

    listen 80;
    listen [::]:80;
}
`;

    // Write Nginx config
    await fs.writeFile(
      `/etc/nginx/sites-available/${safeDomain}`,
      nginxConfig
    );

    // Enable site
    try {
      await fs.symlink(
        `/etc/nginx/sites-available/${safeDomain}`,
        `/etc/nginx/sites-enabled/${safeDomain}`
      );
    } catch {
      // Symlink might already exist
    }

    // Test Nginx config
    const { stderr: testErr } = await execAsync("nginx -t 2>&1");
    if (testErr && testErr.includes("failed")) {
      // Rollback
      await fs.unlink(`/etc/nginx/sites-enabled/${safeDomain}`);
      await fs.unlink(`/etc/nginx/sites-available/${safeDomain}`);
      return new Response(
        JSON.stringify({
          error: "Nginx configuration test failed",
          details: testErr,
        }),
        { status: 500 }
      );
    }

    // Reload Nginx
    await execAsync("systemctl reload nginx");

    // Get SSL certificate
    try {
      await execAsync(
        `certbot --nginx -d ${safeDomain} --non-interactive --agree-tos --email johan@thewebjockeys.co.za 2>&1`,
        { timeout: 120000 }
      );
    } catch (certErr: any) {
      console.error("Certbot error (non-fatal):", certErr.message);
      // SSL might fail if DNS hasn't propagated yet, but HTTP will work
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Domain ${safeDomain} provisioned successfully`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Domain provisioning error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to provision domain", details: error.message }),
      { status: 500 }
    );
  }
}
