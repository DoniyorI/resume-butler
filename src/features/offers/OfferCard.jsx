"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { decideOfferAction, saveOfferAction } from "@/features/offers/actions";
import { localDateKey } from "@/features/activities/kinds";
import { formatShortDate } from "@/lib/dates";
import { formatSalary } from "@/lib/salary";

const PERIODS = [
  ["hour", "Per hour"],
  ["day", "Per day"],
  ["week", "Per week"],
  ["month", "Per month"],
  ["year", "Per year"],
];

function initialState(offer, decideBy) {
  return {
    baseAmount: offer?.baseAmount == null ? "" : String(offer.baseAmount),
    basePeriod: offer?.basePeriod || "year",
    currency: offer?.currency || "USD",
    bonus: offer?.bonus || "",
    equity: offer?.equity || "",
    benefits: offer?.benefits || "",
    startDate: offer?.startDate || "",
    receivedOn: offer?.receivedOn || "",
    decideBy: decideBy || "",
    notes: offer?.notes || "",
  };
}

function decisionText(offer) {
  if (offer?.decision === "accepted") return `Accepted on ${formatShortDate(offer.decidedOn)}`;
  if (offer?.decision === "declined") return `Declined on ${formatShortDate(offer.decidedOn)}`;
  return "Pending";
}

/**
 * The offer for an application: its terms, the decide-by date (the open
 * offer-deadline next step) and the decision. Nothing is prefilled that the
 * user did not enter. Before migration 022 it is one quiet line.
 */
export default function OfferCard({ applicationId, offer, decideBy, deadlineAvailable, setupPending }) {
  const [form, setForm] = useState(() => initialState(offer, decideBy));
  // One request at a time, so a double click can't send it twice
  const [busy, setBusy] = useState(false);
  // "accepted" or "declined" while the confirm area is open
  const [deciding, setDeciding] = useState(null);
  const [decidedOn, setDecidedOn] = useState("");
  const [withdraw, setWithdraw] = useState(true);
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const fieldId = (name) => `offer-${applicationId}-${name}`;

  if (setupPending) {
    return <p className="text-xs text-muted-foreground">Recording an offer needs database migration 022.</p>;
  }

  const decision = offer?.decision || "pending";
  const saved =
    offer?.baseAmount == null
      ? ""
      : formatSalary({ min: offer.baseAmount, max: offer.baseAmount, currency: offer.currency, period: offer.basePeriod });

  const run = async (action, onDone) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data?.deadlineError) toast.error("The decide-by date was not saved. Try again from Next steps.");
      if (result.data?.statusError) toast.error("The decision was saved, but the status could not be changed.");
      onDone(result.data);
    } finally {
      setBusy(false);
    }
  };

  const save = (event) => {
    event.preventDefault();
    const amount = form.baseAmount.trim();
    run(
      () =>
        saveOfferAction({
          applicationId,
          baseAmount: amount === "" ? null : Number(amount),
          basePeriod: form.basePeriod,
          currency: form.currency,
          bonus: form.bonus,
          equity: form.equity,
          benefits: form.benefits,
          startDate: form.startDate,
          receivedOn: form.receivedOn,
          decideBy: deadlineAvailable ? form.decideBy : "",
          notes: form.notes,
        }),
      (data) => {
        if (!data.deadlineError) toast.success("Offer saved");
      }
    );
  };

  const openDecision = (next) => {
    setDeciding(next);
    setDecidedOn(localDateKey());
    setWithdraw(true);
  };

  const decide = (next, date) =>
    run(
      () =>
        decideOfferAction({
          applicationId,
          decision: next,
          decidedOn: date || null,
          withdraw: next === "declined" && withdraw,
        }),
      () => {
        setDeciding(null);
        toast.success(next === "pending" ? "Decision cleared" : next === "accepted" ? "Offer accepted" : "Offer declined");
      }
    );

  return (
    <Card id="offer" className="scroll-mt-24">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4 text-brand" /> Offer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved && <p className="text-sm font-medium">{saved}</p>}

        <form onSubmit={save} className="space-y-3" aria-label="Offer terms">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_5rem]">
            <div className="space-y-1.5">
              <Label htmlFor={fieldId("amount")} className="text-xs">
                Base pay
              </Label>
              <Input
                id={fieldId("amount")}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.baseAmount}
                onChange={(e) => set("baseAmount")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fieldId("period")} className="text-xs">
                Pay period
              </Label>
              <Select value={form.basePeriod} onValueChange={set("basePeriod")}>
                <SelectTrigger id={fieldId("period")} className="sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fieldId("currency")} className="text-xs">
                Currency
              </Label>
              <Input
                id={fieldId("currency")}
                value={form.currency}
                maxLength={3}
                autoCapitalize="characters"
                onChange={(e) => set("currency")(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={fieldId("bonus")} className="text-xs">
              Bonus
            </Label>
            <Input id={fieldId("bonus")} value={form.bonus} maxLength={500} onChange={(e) => set("bonus")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId("equity")} className="text-xs">
              Equity
            </Label>
            <Input id={fieldId("equity")} value={form.equity} maxLength={500} onChange={(e) => set("equity")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId("benefits")} className="text-xs">
              Benefits
            </Label>
            <Textarea
              id={fieldId("benefits")}
              value={form.benefits}
              maxLength={1000}
              onChange={(e) => set("benefits")(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={fieldId("received")} className="text-xs">
                Offer received on
              </Label>
              <Input id={fieldId("received")} type="date" value={form.receivedOn} onChange={(e) => set("receivedOn")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fieldId("start")} className="text-xs">
                Start date
              </Label>
              <Input id={fieldId("start")} type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} />
            </div>
            {deadlineAvailable && (
              <div className="space-y-1.5">
                <Label htmlFor={fieldId("decide-by")} className="text-xs">
                  Decide by
                </Label>
                <Input id={fieldId("decide-by")} type="date" value={form.decideBy} onChange={(e) => set("decideBy")(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={fieldId("notes")} className="text-xs">
              Notes
            </Label>
            <Textarea
              id={fieldId("notes")}
              value={form.notes}
              maxLength={5000}
              onChange={(e) => set("notes")(e.target.value)}
              className="min-h-[80px] text-sm"
            />
          </div>

          <Button type="submit" size="sm" disabled={busy}>
            Save offer
          </Button>
        </form>

        <div className="space-y-2 border-t pt-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Decision:</span> <span className="font-medium">{decisionText(offer)}</span>
          </p>
          {deciding ? (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label htmlFor={fieldId("decided-on")} className="text-xs">
                  {deciding === "accepted" ? "Accepted on" : "Declined on"}
                </Label>
                <Input id={fieldId("decided-on")} type="date" value={decidedOn} onChange={(e) => setDecidedOn(e.target.value)} />
              </div>
              {deciding === "declined" && (
                <div className="flex items-center gap-2">
                  <Checkbox id={fieldId("withdraw")} checked={withdraw} onCheckedChange={(checked) => setWithdraw(checked === true)} />
                  <Label htmlFor={fieldId("withdraw")} className="text-xs font-normal">
                    Move this application to Withdrew
                  </Label>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy || !decidedOn} onClick={() => decide(deciding, decidedOn)}>
                  {deciding === "accepted" ? "Confirm accept" : "Confirm decline"}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeciding(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : decision === "pending" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => openDecision("accepted")}>
                Accept offer
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => openDecision("declined")}>
                Decline offer
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("pending", null)}>
              Change decision
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
