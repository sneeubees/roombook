"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { LoaderCircle, RefreshCw, Save } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";

const TIER_KEYS: SubscriptionTier[] = ["basic", "professional", "enterprise"];

function randString(cents: number) {
  return (cents / 100).toFixed(2);
}

type TierRecord = Record<SubscriptionTier, string>;

const EMPTY: TierRecord = { basic: "", professional: "", enterprise: "" };

export function AdminPricingClient() {
  const pricing = useQuery(api.pricing.current);
  const updatePricing = useMutation(api.pricing.updatePricing);
  const createTierPlan = useAction(api.paystack.createTierPlan);

  const [rand, setRand] = useState<TierRecord>(EMPTY);
  const [planCode, setPlanCode] = useState<TierRecord>(EMPTY);
  const [savingPrices, setSavingPrices] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState<SubscriptionTier | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!pricing) return;
    setRand({
      basic: randString(pricing.basicMonthlyCents),
      professional: randString(pricing.professionalMonthlyCents),
      enterprise: randString(pricing.enterpriseMonthlyCents),
    });
    setPlanCode({
      basic: pricing.basicPlanCode ?? "",
      professional: pricing.professionalPlanCode ?? "",
      enterprise: pricing.enterprisePlanCode ?? "",
    });
  }, [pricing]);

  if (pricing === undefined) {
    return (
      <p className="flex items-center gap-2 text-sm text-stone-400">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading pricing…
      </p>
    );
  }

  async function saveTierPrices() {
    if (savingPrices) return;
    setError(null);
    setOk(null);

    const cents: Record<SubscriptionTier, number> = {
      basic: Math.round(Number(rand.basic) * 100),
      professional: Math.round(Number(rand.professional) * 100),
      enterprise: Math.round(Number(rand.enterprise) * 100),
    };
    for (const tier of TIER_KEYS) {
      if (!Number.isFinite(cents[tier]) || cents[tier] <= 0) {
        setError(`${TIERS[tier].label} price must be greater than 0.`);
        return;
      }
    }

    setSavingPrices(true);
    try {
      await updatePricing({
        basicMonthlyCents: cents.basic,
        professionalMonthlyCents: cents.professional,
        enterpriseMonthlyCents: cents.enterprise,
        basicPlanCode: planCode.basic.trim() || undefined,
        professionalPlanCode: planCode.professional.trim() || undefined,
        enterprisePlanCode: planCode.enterprise.trim() || undefined,
      });
      setOk("Tier prices saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPrices(false);
    }
  }

  async function createPlan(tier: SubscriptionTier) {
    if (creatingPlan) return;
    setError(null);
    setOk(null);
    const cents = Math.round(Number(rand[tier]) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError(`${TIERS[tier].label} price must be > 0 before creating a plan.`);
      return;
    }
    setCreatingPlan(tier);
    try {
      const result = await createTierPlan({ tier, amountCents: cents });
      setPlanCode((cur) => ({ ...cur, [tier]: result.planCode }));
      setOk(
        `${TIERS[tier].label} plan created on Paystack: ${result.planCode} — saved to config.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {ok}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">Tier prices</p>
            <p className="max-w-2xl text-xs text-stone-400">
              Paystack plan amounts are immutable — changing a price here only
              affects new signups. Existing subscribers keep their original
              amount until they cancel and resubscribe. Use “Create new Paystack
              plan” to mint a fresh plan at the new price.
            </p>
          </div>
          {pricing.updatedAt ? (
            <p className="text-xs text-stone-500">
              Last updated {new Date(pricing.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {TIER_KEYS.map((tier) => {
            const value = rand[tier];
            return (
              <div
                key={tier}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
                  {TIERS[tier].label}
                </p>
                <p className="mt-1 text-[11px] text-stone-500">
                  {TIERS[tier].tagline}
                </p>
                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1.5 text-sm text-stone-200">
                    <span>Monthly price (ZAR)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      value={value}
                      onChange={(e) =>
                        setRand((cur) => ({ ...cur, [tier]: e.target.value }))
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm text-stone-200">
                    <span>Paystack plan code</span>
                    <input
                      type="text"
                      value={planCode[tier]}
                      onChange={(e) =>
                        setPlanCode((cur) => ({
                          ...cur,
                          [tier]: e.target.value,
                        }))
                      }
                      placeholder="PLN_…"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none focus:border-emerald-400/60"
                    />
                    <span className="text-[11px] text-stone-500">
                      Or click below to create a new plan with the price above.
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={creatingPlan === tier}
                    onClick={() => createPlan(tier)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingPlan === tier ? (
                      <>
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Creating on Paystack…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Create new Paystack plan @ R{value || "0"}/mo
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={savingPrices}
            onClick={saveTierPrices}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingPrices ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save tier prices
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
