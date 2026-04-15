import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const eventType = body.type;

    switch (eventType) {
      case "user.created":
      case "user.updated": {
        const { id, email_addresses, first_name, last_name, phone_numbers, image_url } = body.data;
        const primaryEmail = email_addresses?.find(
          (e: { id: string }) => e.id === body.data.primary_email_address_id
        );

        await ctx.runMutation(api.users.upsert, {
          clerkUserId: id,
          email: primaryEmail?.email_address ?? "",
          fullName: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
          phone: phone_numbers?.[0]?.phone_number,
          imageUrl: image_url,
        });
        break;
      }

      case "user.deleted": {
        if (body.data?.id) {
          await ctx.runMutation(api.users.remove, {
            clerkUserId: body.data.id,
          });
        }
        break;
      }

      case "organization.created":
      case "organization.updated": {
        const { id, name, slug } = body.data;
        await ctx.runMutation(api.organizations.create, {
          clerkOrgId: id,
          name,
          slug: slug ?? name.toLowerCase().replace(/\s+/g, "-"),
        });
        break;
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
