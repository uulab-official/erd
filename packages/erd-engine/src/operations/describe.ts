import type { HistoryEntry } from "./history.js";
import { isTransaction } from "./history.js";
import type { OperationType } from "./types.js";

const LABELS: Record<OperationType, string> = {
  CreateEntity: "Create entity",
  DeleteEntity: "Delete entity",
  RenameEntity: "Rename entity",
  MoveEntity: "Move entity",
  SetEntityMeta: "Update entity metadata",
  AddAttribute: "Add attribute",
  RemoveAttribute: "Remove attribute",
  RenameAttribute: "Rename attribute",
  ChangeAttributeType: "Change attribute type",
  SetAttributeFlags: "Update attribute flags",
  SetAttributeDefault: "Set attribute default",
  AssignDomain: "Assign domain",
  UnassignDomain: "Unassign domain",
  CreateIndex: "Create index",
  DeleteIndex: "Delete index",
  CreateRelationship: "Create relationship",
  DeleteRelationship: "Delete relationship",
  ChangeRelationshipCardinality: "Change relationship cardinality",
  ChangeRelationshipKind: "Change relationship kind",
  SetRelationshipMeta: "Update relationship metadata",
  CreateDomain: "Create domain",
  UpdateDomain: "Update domain",
  DeleteDomain: "Delete domain",
  AddDictionaryEntry: "Add dictionary entry",
  UpdateDictionaryEntry: "Update dictionary entry",
  DeleteDictionaryEntry: "Delete dictionary entry",
  UpdateNamingRuleSet: "Update naming rules",
  CreateSubjectArea: "Create subject area",
  UpdateSubjectArea: "Update subject area",
  DeleteSubjectArea: "Delete subject area",
  AssignEntityToSubjectArea: "Assign entity to subject area",
  UnassignEntityFromSubjectArea: "Unassign entity from subject area",
};

// Human-readable label for a History Panel entry. Transactions already carry their own
// label (docs/operations.md); single Operations are labeled by type.
export function describeHistoryEntry(entry: HistoryEntry): string {
  if (isTransaction(entry)) return entry.label;
  return LABELS[entry.type as OperationType] ?? entry.type;
}
