/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityLogs from "../activityLogs.js";
import type * as admin from "../admin.js";
import type * as bookings from "../bookings.js";
import type * as crons from "../crons.js";
import type * as domains from "../domains.js";
import type * as emailActions from "../emailActions.js";
import type * as emailHelpers from "../emailHelpers.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as invoiceGeneration from "../invoiceGeneration.js";
import type * as invoiceGenerationHelpers from "../invoiceGenerationHelpers.js";
import type * as invoices from "../invoices.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as roomBlocks from "../roomBlocks.js";
import type * as rooms from "../rooms.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityLogs: typeof activityLogs;
  admin: typeof admin;
  bookings: typeof bookings;
  crons: typeof crons;
  domains: typeof domains;
  emailActions: typeof emailActions;
  emailHelpers: typeof emailHelpers;
  http: typeof http;
  invitations: typeof invitations;
  invoiceGeneration: typeof invoiceGeneration;
  invoiceGenerationHelpers: typeof invoiceGenerationHelpers;
  invoices: typeof invoices;
  notifications: typeof notifications;
  organizations: typeof organizations;
  roomBlocks: typeof roomBlocks;
  rooms: typeof rooms;
  seed: typeof seed;
  users: typeof users;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
