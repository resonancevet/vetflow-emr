export type VisitPrepItemDef = {
  key: string;
  label: string;
  sortOrder: number;
};

/** Base pack/prep items shown under every upcoming patient appointment. */
export const VISIT_PREP_BASE_ITEMS: VisitPrepItemDef[] = [
  {
    key: "create_visit_plan",
    label: "Create Visit Plan",
    sortOrder: 0,
  },
];

/** Added when rabies is planned or the patient is due for rabies. */
export const VISIT_PREP_RABIES_ITEMS: VisitPrepItemDef[] = [
  {
    key: "pre_rabies_client_statement",
    label: "Pre-Rabies Client Statement",
    sortOrder: 1,
  },
];
