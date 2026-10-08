import { z } from "zod";

export const studioStatusSchema = z.enum(["active", "deactivated", "archived"]);
function isIanaTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat("en-IN", { timeZone: value }); return true; } catch { return false; }
}

export const provisionStudioSchema = z.object({
  name: z.string().trim().min(2, "Enter a studio name.").max(100),
  timezone: z.string().refine(isIanaTimezone, "Choose a valid IANA timezone."),
  ownerMode: z.enum(["assign", "create"]),
  ownerUid: z.string().trim().min(1, "Enter the existing owner UID.").optional(),
  ownerEmail: z.string().trim().email("Enter a valid owner email.").optional(),
}).superRefine((value, context) => {
  if (value.ownerMode === "assign" && !value.ownerUid) context.addIssue({ code: "custom", path: ["ownerUid"], message: "An existing owner UID is required." });
  if (value.ownerMode === "create" && !value.ownerEmail) context.addIssue({ code: "custom", path: ["ownerEmail"], message: "An owner email is required." });
});

export const studioLifecycleSchema = z.object({ studioId: z.string().min(1), status: studioStatusSchema });
export const studioManagementSchema = z.object({ studioId: z.string().min(1), name: z.string().trim().min(2).max(100), status: studioStatusSchema });
export const studioThemeSchema = z.object({ studioId: z.string().min(1), theme: z.enum(["nature-minimal", "warm-elegant", "dark-modern", "soft-pastel", "custom-brand"]), brandPaletteId: z.string().min(1).optional(), allowOwnerThemeCustomization: z.coerce.boolean().optional() });
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour.");
export const brandPaletteSchema = z.object({ name: z.string().trim().min(2).max(60), background: hexColor, surface: hexColor, primary: hexColor, accent: hexColor, operationId: z.string().uuid() });

export const teamRoleSchema = z.enum(["customer", "trainer", "staff"]);
export const invitationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  displayName: z.string().trim().max(100, "Name must be 100 characters or fewer.").optional(),
  roles: z.array(teamRoleSchema).min(1, "Choose at least one role."),
  operationId: z.string().uuid(),
});
export const invitationReissueSchema = z.object({
  invitationId: z.string().min(1),
  operationId: z.string().uuid(),
});
export const membershipUpdateSchema = z.object({
  uid: z.string().min(1),
  action: z.enum(["update", "activate", "deactivate", "revoke"]),
  displayName: z.string().trim().max(100).optional(),
  roles: z.array(teamRoleSchema).optional(),
  reason: z.string().trim().max(300).optional(),
}).superRefine((value, context) => {
  if (value.action === "update" && (!value.roles || value.roles.length === 0)) {
    context.addIssue({ code: "custom", path: ["roles"], message: "Choose at least one role." });
  }
  if ((value.action === "deactivate" || value.action === "revoke") && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Give a short reason for this change." });
  }
});

export const memberPasswordChangeSchema = z.object({
  uid: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((input) => input.newPassword === input.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });

const inrPriceSchema = z.coerce.number().finite().min(0, "Enter a valid INR price.").refine(
  (value) => Math.round(value * 100) === value * 100,
  "Use no more than two decimal places.",
);

const planFieldsSchema = z.object({
  name: z.string().trim().min(2, "Enter a plan name.").max(100, "Plan name must be 100 characters or fewer."),
  description: z.string().trim().max(400, "Description must be 400 characters or fewer.").optional(),
  priceInr: inrPriceSchema,
  creditAllocation: z.coerce.number().int().positive("Credit allocation must be at least one."),
  validityDays: z.preprocess((value) => value === "" || value === undefined || value === null ? undefined : value, z.coerce.number().int().positive("Fixed-day validity must be at least 1 day.").optional()),
  durationMonths: z.preprocess((value) => value === "" || value === undefined || value === null ? undefined : value, z.coerce.number().int().positive("Calendar duration must be at least 1 month.").optional()),
  status: z.enum(["draft", "active"]),
}).superRefine((value, context) => {
  if (Boolean(value.validityDays) === Boolean(value.durationMonths)) {
    context.addIssue({ code: "custom", path: ["validityDays"], message: "Choose either fixed-day validity or calendar-month duration." });
  }
});

export const planInputSchema = planFieldsSchema.extend({
  operationId: z.string().uuid(),
}).transform((value) => ({ ...value, pricePaise: Math.round(value.priceInr * 100) }));

export const planUpdateSchema = planFieldsSchema.extend({
  planId: z.string().min(1),
}).transform((value) => ({ ...value, pricePaise: Math.round(value.priceInr * 100) }));

export const subscriptionAssignmentSchema = z.object({
  customerUid: z.string().min(1),
  planId: z.string().min(1),
  operationId: z.string().uuid(),
});

export const subscriptionCancellationSchema = z.object({
  subscriptionId: z.string().min(1),
  operationId: z.string().uuid(),
  mode: z.enum(["immediate", "end_of_term"]),
  reason: z.string().trim().max(300).optional(),
}).superRefine((value, context) => {
  if (value.mode === "immediate" && (!value.reason || value.reason.length < 2)) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Give a reason for immediate cancellation." });
  }
});

export const subscriptionRenewalSchema = subscriptionAssignmentSchema;

export const subscriptionPauseSchema = z.object({
  subscriptionId: z.string().min(1),
  pauseDays: z.coerce.number().int().positive("Choose at least one pause day.").max(60),
  operationId: z.string().uuid(),
});

export const subscriptionResumeSchema = z.object({
  subscriptionId: z.string().min(1),
  operationId: z.string().uuid(),
});

export const creditAdjustmentSchema = z.object({
  subscriptionId: z.string().min(1),
  amount: z.coerce.number().int().refine((value) => value !== 0, "Adjustment cannot be zero."),
  reason: z.string().trim().min(2, "Give a reason for this adjustment.").max(300),
  operationId: z.string().uuid(),
});

export const bookingSlotIdSchema = z.string().uuid();

export const bookingRequestSchema = z.object({
  slotId: bookingSlotIdSchema,
  operationId: z.string().uuid(),
});

export const bookingCancellationSchema = z.object({
  bookingId: z.string().min(1),
  operationId: z.string().uuid(),
});

export const bookingRescheduleSchema = z.object({
  bookingId: z.string().min(1),
  targetSlotId: bookingSlotIdSchema,
  operationId: z.string().uuid(),
});

export const attendanceOutcomeSchema = z.enum(["attended", "no-show"]);

export const attendanceMarkSchema = z.object({
  slotId: bookingSlotIdSchema,
  bookingId: z.string().min(1).max(200).refine((value) => !value.includes("/"), "Choose a valid booking."),
  outcome: attendanceOutcomeSchema,
  operationId: z.string().uuid(),
});

export const attendanceCorrectionSchema = z.object({
  slotId: bookingSlotIdSchema,
  bookingId: z.string().min(1).max(200).refine((value) => !value.includes("/"), "Choose a valid booking."),
  outcome: attendanceOutcomeSchema,
  reason: z.string().trim().min(2, "Give a reason for this correction.").max(300),
  operationId: z.string().uuid(),
});

export const incidentPolicySchema = z.object({ status: z.enum(["active", "inactive"]), operationId: z.string().uuid() });
export const incidentWaiverSchema = z.object({ incidentId: z.string().min(1).max(300).refine((value) => !value.includes("/")), reason: z.string().trim().min(2).max(300), operationId: z.string().uuid() });
export const incidentReversalSchema = z.object({ incidentId: z.string().min(1).max(300).refine((value) => !value.includes("/")), reason: z.string().trim().min(2).max(300), operationId: z.string().uuid() });
export const incidentReviewSchema = z.object({ incidentId: z.string().min(1).max(300).refine((value) => !value.includes("/")), operationId: z.string().uuid() });
export const waitlistJoinSchema = z.object({ slotId: bookingSlotIdSchema, operationId: z.string().uuid() });
export const waitlistWithdrawalSchema = z.object({ slotId: bookingSlotIdSchema, operationId: z.string().uuid() });
export const waitlistRemovalSchema = z.object({ entryId: z.string().min(1).max(300).refine((value) => !value.includes("/")), reason: z.string().trim().min(2).max(300), operationId: z.string().uuid() });
