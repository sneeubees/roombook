import { promises as dns } from "dns";

export async function POST(request: Request) {
  try {
    const { domain } = await request.json();

    if (!domain) {
      return new Response(JSON.stringify({ error: "Domain required" }), {
        status: 400,
      });
    }

    try {
      // Check CNAME record points to roombook.co.za
      const records = await dns.resolveCname(domain);
      const pointsToUs = records.some(
        (r) =>
          r.toLowerCase() === "roombook.co.za" ||
          r.toLowerCase().endsWith(".roombook.co.za")
      );

      if (pointsToUs) {
        return new Response(
          JSON.stringify({ verified: true, records }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Also check A record as fallback
      try {
        const aRecords = await dns.resolve4(domain);
        // Check if it resolves to our VPS IP
        const ourIp = "154.66.198.174";
        const pointsToOurIp = aRecords.includes(ourIp);
        if (pointsToOurIp) {
          return new Response(
            JSON.stringify({ verified: true, records: aRecords }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      } catch {
        // A record lookup failed, that's okay
      }

      return new Response(
        JSON.stringify({
          verified: false,
          message: `CNAME record found (${records.join(", ")}) but does not point to roombook.co.za`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (dnsError: any) {
      if (dnsError.code === "ENODATA" || dnsError.code === "ENOTFOUND") {
        return new Response(
          JSON.stringify({
            verified: false,
            message: "No DNS records found for this domain. Please add the CNAME record and wait for propagation (can take up to 48 hours).",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw dnsError;
    }
  } catch (error) {
    console.error("DNS verification error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to verify domain" }),
      { status: 500 }
    );
  }
}
