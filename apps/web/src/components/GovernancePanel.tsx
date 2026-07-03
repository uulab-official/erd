import { useState } from "react";
import type { ColumnType, NamingRuleSet } from "@modelforge/schema-engine";
import { Button, Card, Input, Select, Tabs } from "@modelforge/ui";
import { useEditorStore } from "../store/useEditorStore.js";

type GovernanceTab = "domains" | "dictionary" | "naming" | "subjectAreas";

const COLUMN_TYPES: ColumnType[] = [
  "string",
  "integer",
  "bigint",
  "float",
  "boolean",
  "datetime",
  "json",
  "enum",
  "uuid",
];

const CASE_OPTIONS: NamingRuleSet["case"][] = ["snake", "camel", "pascal", "upper", "lower"];

function DomainsSection() {
  const { model, createDomain, updateDomain, deleteDomain, assignDomain, unassignDomain } =
    useEditorStore();
  const domains = model.domains ?? [];
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("string");
  const [length, setLength] = useState("");
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});

  const attributeOptions = model.entities.flatMap((entity) =>
    entity.attributes.map((attribute) => ({
      entityId: entity.id,
      attributeId: attribute.id,
      label: `${entity.logicalName}.${attribute.logicalName}`,
      domainId: attribute.domainId,
    })),
  );

  function handleCreate() {
    if (!name.trim()) return;
    createDomain({
      id: crypto.randomUUID(),
      name: name.trim(),
      type,
      length: length ? Number(length) : undefined,
    });
    setName("");
    setLength("");
  }

  function handleAssign(domainId: string) {
    const target = assignTarget[domainId];
    if (!target) return;
    const [entityId, attributeId] = target.split(":");
    if (!entityId || !attributeId) return;
    assignDomain(entityId, attributeId, domainId);
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Domain name (e.g. Email)"
          className="flex-1"
        />
        <Select value={type} onChange={(e) => setType(e.target.value as ColumnType)}>
          {COLUMN_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          value={length}
          onChange={(e) => setLength(e.target.value)}
          placeholder="Length"
          className="w-20"
        />
        <Button variant="secondary" size="sm" onClick={handleCreate}>
          Add Domain
        </Button>
      </div>

      {domains.length === 0 && <p className="text-sm text-slate-400">No domains yet.</p>}

      <ul className="flex flex-col gap-2">
        {domains.map((domain) => {
          const assigned = attributeOptions.filter((a) => a.domainId === domain.id);
          const unassigned = attributeOptions.filter((a) => a.domainId !== domain.id);
          return (
            <Card key={domain.id} as="li" className="p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{domain.name}</span>
                <span className="text-sm text-slate-500">
                  {domain.type}
                  {domain.length !== undefined && `(${domain.length})`}
                </span>
                <Input
                  type="number"
                  defaultValue={domain.length ?? ""}
                  placeholder="length"
                  className="w-20"
                  onBlur={(e) =>
                    updateDomain(domain.id, {
                      length: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
                <button
                  className="ml-auto text-sm text-red-600 hover:underline"
                  onClick={() => deleteDomain(domain.id)}
                >
                  Delete
                </button>
              </div>

              {assigned.length > 0 && (
                <ul className="ml-4 mt-2 flex flex-col gap-1 text-xs text-slate-600">
                  {assigned.map((a) => (
                    <li key={`${a.entityId}.${a.attributeId}`} className="flex items-center gap-2">
                      {a.label}
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => unassignDomain(a.entityId, a.attributeId)}
                      >
                        Unassign
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {unassigned.length > 0 && (
                <div className="ml-4 mt-2 flex items-center gap-2">
                  <Select
                    value={assignTarget[domain.id] ?? ""}
                    onChange={(e) =>
                      setAssignTarget({ ...assignTarget, [domain.id]: e.target.value })
                    }
                  >
                    <option value="">Assign to attribute…</option>
                    {unassigned.map((a) => (
                      <option
                        key={`${a.entityId}.${a.attributeId}`}
                        value={`${a.entityId}:${a.attributeId}`}
                      >
                        {a.label}
                      </option>
                    ))}
                  </Select>
                  <button
                    className="text-sm text-brand-700 hover:underline"
                    onClick={() => handleAssign(domain.id)}
                  >
                    Assign
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </ul>
    </div>
  );
}

function DictionarySection() {
  const { model, addDictionaryEntry, updateDictionaryEntry, deleteDictionaryEntry } =
    useEditorStore();
  const dictionary = model.dictionary ?? [];
  const [logicalTerm, setLogicalTerm] = useState("");
  const [standardName, setStandardName] = useState("");

  function handleAdd() {
    if (!logicalTerm.trim() || !standardName.trim()) return;
    addDictionaryEntry({
      id: crypto.randomUUID(),
      logicalTerm: logicalTerm.trim(),
      standardName: standardName.trim(),
    });
    setLogicalTerm("");
    setStandardName("");
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Input
          value={logicalTerm}
          onChange={(e) => setLogicalTerm(e.target.value)}
          placeholder="Logical term (e.g. Identifier)"
          className="flex-1"
        />
        <Input
          value={standardName}
          onChange={(e) => setStandardName(e.target.value)}
          placeholder="Standard name (e.g. id)"
          className="flex-1"
        />
        <Button variant="secondary" size="sm" onClick={handleAdd}>
          Add Term
        </Button>
      </div>

      {dictionary.length === 0 && (
        <p className="text-sm text-slate-400">No dictionary terms yet.</p>
      )}

      <ul className="flex flex-col gap-2">
        {dictionary.map((entry) => (
          <Card key={entry.id} as="li" className="flex items-center gap-2 p-2.5">
            <span className="text-slate-900">{entry.logicalTerm}</span>
            <span className="text-slate-400">→</span>
            <Input
              defaultValue={entry.standardName}
              onBlur={(e) => updateDictionaryEntry(entry.id, { standardName: e.target.value })}
            />
            <button
              className="ml-auto text-sm text-red-600 hover:underline"
              onClick={() => deleteDictionaryEntry(entry.id)}
            >
              Delete
            </button>
          </Card>
        ))}
      </ul>
    </div>
  );
}

function NamingRulesSection() {
  const { model, updateNamingRuleSet } = useEditorStore();
  const rules = model.namingRules;
  const [caseKind, setCaseKind] = useState<NamingRuleSet["case"]>(rules?.case ?? "snake");
  const [entityPrefix, setEntityPrefix] = useState(rules?.entityPrefix ?? "");
  const [entitySuffix, setEntitySuffix] = useState(rules?.entitySuffix ?? "");
  const [attributePrefix, setAttributePrefix] = useState(rules?.attributePrefix ?? "");
  const [attributeSuffix, setAttributeSuffix] = useState(rules?.attributeSuffix ?? "");
  const [reservedWords, setReservedWords] = useState((rules?.reservedWords ?? []).join(", "));

  function handleSave() {
    updateNamingRuleSet({
      case: caseKind,
      entityPrefix: entityPrefix || undefined,
      entitySuffix: entitySuffix || undefined,
      attributePrefix: attributePrefix || undefined,
      attributeSuffix: attributeSuffix || undefined,
      reservedWords: reservedWords
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean),
      abbreviations: rules?.abbreviations ?? {},
    });
  }

  function handleClear() {
    updateNamingRuleSet(undefined);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {!rules && (
        <p className="text-sm text-slate-400">
          No naming rules configured yet — nothing is enforced until you save some below.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        Case
        <Select
          value={caseKind}
          onChange={(e) => setCaseKind(e.target.value as NamingRuleSet["case"])}
        >
          {CASE_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </label>
      <div className="flex gap-2">
        <Input
          value={entityPrefix}
          onChange={(e) => setEntityPrefix(e.target.value)}
          placeholder="Entity prefix"
        />
        <Input
          value={entitySuffix}
          onChange={(e) => setEntitySuffix(e.target.value)}
          placeholder="Entity suffix"
        />
        <Input
          value={attributePrefix}
          onChange={(e) => setAttributePrefix(e.target.value)}
          placeholder="Attribute prefix"
        />
        <Input
          value={attributeSuffix}
          onChange={(e) => setAttributeSuffix(e.target.value)}
          placeholder="Attribute suffix"
        />
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Reserved words (comma-separated, added on top of the built-in SQL list)
        <Input value={reservedWords} onChange={(e) => setReservedWords(e.target.value)} />
      </label>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleSave}>
          Save Naming Rules
        </Button>
        {rules && (
          <button className="text-sm text-red-600 hover:underline" onClick={handleClear}>
            Clear (disable enforcement)
          </button>
        )}
      </div>
    </div>
  );
}

const SUBJECT_AREA_COLORS = ["#6366f1", "#f97316", "#10b981", "#ec4899", "#0ea5e9", "#eab308"];

function SubjectAreasSection() {
  const {
    model,
    createSubjectArea,
    updateSubjectArea,
    deleteSubjectArea,
    assignEntityToSubjectArea,
    unassignEntityFromSubjectArea,
  } = useEditorStore();
  const subjectAreas = model.subjectAreas ?? [];
  const [name, setName] = useState("");
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});

  function handleCreate() {
    if (!name.trim()) return;
    createSubjectArea({
      id: crypto.randomUUID(),
      name: name.trim(),
      entityIds: [],
      color: SUBJECT_AREA_COLORS[subjectAreas.length % SUBJECT_AREA_COLORS.length],
    });
    setName("");
  }

  function handleAssign(subjectAreaId: string) {
    const entityId = assignTarget[subjectAreaId];
    if (!entityId) return;
    assignEntityToSubjectArea(entityId, subjectAreaId);
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subject area name (e.g. Sales)"
          className="flex-1"
        />
        <Button variant="secondary" size="sm" onClick={handleCreate}>
          Add Subject Area
        </Button>
      </div>

      {subjectAreas.length === 0 && <p className="text-sm text-slate-400">No subject areas yet.</p>}

      <ul className="flex flex-col gap-2">
        {subjectAreas.map((subjectArea) => {
          const members = model.entities.filter((e) => e.subjectAreaId === subjectArea.id);
          const unassigned = model.entities.filter((e) => e.subjectAreaId !== subjectArea.id);
          return (
            <Card key={subjectArea.id} as="li" className="p-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: subjectArea.color }}
                />
                <Input
                  defaultValue={subjectArea.name}
                  className="flex-1"
                  onBlur={(e) => updateSubjectArea(subjectArea.id, { name: e.target.value })}
                />
                <button
                  className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={members.length > 0}
                  title={members.length > 0 ? "Unassign every entity first" : undefined}
                  onClick={() => deleteSubjectArea(subjectArea.id)}
                >
                  Delete
                </button>
              </div>

              {members.length > 0 && (
                <ul className="ml-5 mt-2 flex flex-col gap-1 text-xs text-slate-600">
                  {members.map((entity) => (
                    <li key={entity.id} className="flex items-center gap-2">
                      {entity.logicalName}
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => unassignEntityFromSubjectArea(entity.id)}
                      >
                        Unassign
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {unassigned.length > 0 && (
                <div className="ml-5 mt-2 flex items-center gap-2">
                  <Select
                    value={assignTarget[subjectArea.id] ?? ""}
                    onChange={(e) =>
                      setAssignTarget({ ...assignTarget, [subjectArea.id]: e.target.value })
                    }
                  >
                    <option value="">Assign entity…</option>
                    {unassigned.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.logicalName}
                      </option>
                    ))}
                  </Select>
                  <button
                    className="text-sm text-brand-700 hover:underline"
                    onClick={() => handleAssign(subjectArea.id)}
                  >
                    Assign
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </ul>
    </div>
  );
}

export function GovernancePanel() {
  const [tab, setTab] = useState<GovernanceTab>("domains");

  return (
    <div>
      <Tabs
        items={[
          { id: "domains", label: "Domains" },
          { id: "dictionary", label: "Dictionary" },
          { id: "naming", label: "Naming Rules" },
          { id: "subjectAreas", label: "Subject Areas" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as GovernanceTab)}
        className="border-b-0 bg-slate-50"
      />
      {tab === "domains" && <DomainsSection />}
      {tab === "dictionary" && <DictionarySection />}
      {tab === "naming" && <NamingRulesSection />}
      {tab === "subjectAreas" && <SubjectAreasSection />}
    </div>
  );
}
