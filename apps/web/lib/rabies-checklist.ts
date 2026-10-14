export type RabiesChecklistPhase = "pre" | "post";

export type RabiesChecklistItemDef = {
  phase: RabiesChecklistPhase;
  key: string;
  label: string;
  sortOrder: number;
  autoCompletable: boolean;
};

export const RABIES_CHECKLIST_ITEMS: RabiesChecklistItemDef[] = [
  {
    phase: "pre",
    key: "bring_rabies_vaccine",
    label: "Rabies vaccine + kit supplies packed",
    sortOrder: 0,
    autoCompletable: false,
  },
  {
    phase: "pre",
    key: "bring_tag",
    label: "Rabies tags packed / tag number ready",
    sortOrder: 1,
    autoCompletable: false,
  },
  {
    phase: "pre",
    key: "sworn_statement_ready",
    label: "Sworn statement loaded on iPad for signature",
    sortOrder: 2,
    autoCompletable: false,
  },
  {
    phase: "pre",
    key: "certificate_template_ready",
    label: "Certificate workflow ready (tag + product info)",
    sortOrder: 3,
    autoCompletable: false,
  },
  {
    phase: "post",
    key: "sworn_statement_filed",
    label: "Signed sworn statement uploaded to patient record",
    sortOrder: 10,
    autoCompletable: false,
  },
  {
    phase: "post",
    key: "certificate_generated",
    label: "Rabies certificate generated",
    sortOrder: 11,
    autoCompletable: true,
  },
  {
    phase: "post",
    key: "certificate_filed",
    label: "Certificate attached to patient documents",
    sortOrder: 12,
    autoCompletable: true,
  },
  {
    phase: "post",
    key: "certificate_sent_client",
    label: "Certificate emailed/mailed to client with visit summary",
    sortOrder: 13,
    autoCompletable: false,
  },
  {
    phase: "post",
    key: "certificate_sent_town",
    label: "Copy sent to client’s town clerk",
    sortOrder: 14,
    autoCompletable: false,
  },
];
