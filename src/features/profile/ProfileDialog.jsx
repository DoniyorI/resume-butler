"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { profileSchema } from "@/features/profile/schema";
import { updateProfile } from "@/features/profile/actions";
import EditDialog from "@/features/profile/EditDialog";
import { TextField } from "@/features/profile/fields";

export default function ProfileDialog({ open, onOpenChange, profile }) {
  const router = useRouter();

  const save = async (draft) => {
    const parsed = profileSchema.safeParse(draft);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const result = await updateProfile(parsed.data);
    if (result.ok) {
      toast.success("Profile saved");
      router.refresh();
    }
    return result;
  };

  return (
    <EditDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit profile"
      description="This is the header of every resume you generate."
      initial={open ? profile : null}
      onSave={save}
    >
      {(draft, update) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="pf-first"
            label="First name"
            value={draft.firstName}
            onChange={(firstName) => update({ firstName })}
            required
            autoComplete="given-name"
          />
          <TextField
            id="pf-last"
            label="Last name"
            value={draft.lastName}
            onChange={(lastName) => update({ lastName })}
            required
            autoComplete="family-name"
          />
          <TextField
            id="pf-email"
            label="Email"
            value={draft.email}
            onChange={() => {}}
            disabled
            hint="Your sign-in email"
          />
          <TextField
            id="pf-phone"
            label="Phone"
            value={draft.phone}
            onChange={(phone) => update({ phone })}
            required
            type="tel"
            autoComplete="tel"
          />
          <TextField
            id="pf-location"
            label="Location"
            value={draft.location}
            onChange={(location) => update({ location })}
            placeholder="New York, NY"
            className="sm:col-span-2"
          />
          <TextField
            id="pf-linkedin"
            label="LinkedIn"
            value={draft.linkedin}
            onChange={(linkedin) => update({ linkedin })}
            placeholder="https://linkedin.com/in/you"
          />
          <TextField
            id="pf-github"
            label="GitHub"
            value={draft.github}
            onChange={(github) => update({ github })}
            placeholder="https://github.com/you"
          />
          <TextField
            id="pf-portfolio"
            label="Portfolio"
            value={draft.portfolio}
            onChange={(portfolio) => update({ portfolio })}
            placeholder="https://you.dev"
          />
          <TextField
            id="pf-other"
            label="Other link"
            value={draft.otherLinks}
            onChange={(otherLinks) => update({ otherLinks })}
            placeholder="Optional"
          />
        </div>
      )}
    </EditDialog>
  );
}
