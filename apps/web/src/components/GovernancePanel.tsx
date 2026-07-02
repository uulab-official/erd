import { useState } from "react";
import type { ColumnType, NamingRuleSet } from "@modelforge/schema-engine";
import { useEditorStore } from "../store/useEditorStore.js";

type GovernanceTab = "domains" | "dictionary" | "naming";

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

const inputClass = "rounded border border-neutral-300 px-2 py-1 text-sm";

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
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Domain name (e.g. Email)"
          className={`${inputClass} flex-1`}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ColumnType)}
          className={inputClass}
        >
          {COLUMN_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={length}
          onChange={(e) => setLength(e.target.value)}
          placeholder="Length"
          className={`${inputClass} w-20`}
        />
        <button
          className="rounded bg-neutral-800 px-3 py-1 text-sm text-white"
          onClick={handleCreate}
        >
          Add Domain
        </button>
      </div>

      {domains.length === 0 && <p className="text-neutral-400">No domains yet.</p>}

      <ul className="flex flex-col gap-2">
        {domains.map((domain) => {
          const assigned = attributeOptions.filter((a) => a.domainId === domain.id);
          const unassigned = attributeOptions.filter((a) => a.domainId !== domain.id);
          return (
            <li key={domain.id} className="rounded border border-neutral-200 p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{domain.name}</span>
                <span className="text-neutral-500">
                  {domain.type}
                  {domain.length !== undefined && `(${domain.length})`}
                </span>
                <input
                  type="number"
                  defaultValue={domain.length ?? ""}
                  placeholder="length"
                  className={`${inputClass} w-20`}
                  onBlur={(e) =>
                    updateDomain(domain.id, {
                      length: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
                <button
                  className="ml-auto text-red-600 hover:underline"
                  onClick={() => deleteDomain(domain.id)}
                >
                  Delete
                </button>
              </div>

              {assigned.length > 0 && (
                <ul className="ml-4 mt-1 text-xs text-neutral-600">
                  {assigned.map((a) => (
                    <li key={`${a.entityId}.${a.attributeId}`}>
                      {a.label}{" "}
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
                <div className="ml-4 mt-1 flex items-center gap-2">
                  <select
                    className={inputClass}
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
                  </select>
                  <button
                    className="text-sm text-neutral-700 hover:underline"
                    onClick={() => handleAssign(domain.id)}
                  >
                    Assign
                  </button>
                </div>
              )}
            </li>
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
        <input
          value={logicalTerm}
          onChange={(e) => setLogicalTerm(e.target.value)}
          placeholder="Logical term (e.g. Identifier)"
          className={`${inputClass} flex-1`}
        />
        <input
          value={standardName}
          onChange={(e) => setStandardName(e.target.value)}
          placeholder="Standard name (e.g. id)"
          className={`${inputClass} flex-1`}
        />
        <button className="rounded bg-neutral-800 px-3 py-1 text-sm text-white" onClick={handleAdd}>
          Add Term
        </button>
      </div>

      {dictionary.length === 0 && <p className="text-neutral-400">No dictionary terms yet.</p>}

      <ul className="flex flex-col gap-1">
        {dictionary.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-2 rounded border border-neutral-200 p-2"
          >
            <span>{entry.logicalTerm}</span>
            <span className="text-neutral-400">→</span>
            <input
              defaultValue={entry.standardName}
              className={inputClass}
              onBlur={(e) => updateDictionaryEntry(entry.id, { standardName: e.target.value })}
            />
            <button
              className="ml-auto text-red-600 hover:underline"
              onClick={() => deleteDictionaryEntry(entry.id)}
            >
              Delete
            </button>
          </li>
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
    <div className="flex flex-col gap-3 p-4">
      {!rules && (
        <p className="text-neutral-400">
          No naming rules configured yet — nothing is enforced until you save some below.
        </p>
      )}
      <label className="flex items-center gap-2">
        Case
        <select
          className={inputClass}
          value={caseKind}
          onChange={(e) => setCaseKind(e.target.value as NamingRuleSet["case"])}
        >
          {CASE_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <input
          value={entityPrefix}
          onChange={(e) => setEntityPrefix(e.target.value)}
          placeholder="Entity prefix"
          className={inputClass}
        />
        <input
          value={entitySuffix}
          onChange={(e) => setEntitySuffix(e.target.value)}
          placeholder="Entity suffix"
          className={inputClass}
        />
        <input
          value={attributePrefix}
          onChange={(e) => setAttributePrefix(e.target.value)}
          placeholder="Attribute prefix"
          className={inputClass}
        />
        <input
          value={attributeSuffix}
          onChange={(e) => setAttributeSuffix(e.target.value)}
          placeholder="Attribute suffix"
          className={inputClass}
        />
      </div>
      <label className="flex flex-col gap-1">
        Reserved words (comma-separated, added on top of the built-in SQL list)
        <input
          value={reservedWords}
          onChange={(e) => setReservedWords(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex gap-2">
        <button
          className="rounded bg-neutral-800 px-3 py-1 text-sm text-white"
          onClick={handleSave}
        >
          Save Naming Rules
        </button>
        {rules && (
          <button className="text-sm text-red-600 hover:underline" onClick={handleClear}>
            Clear (disable enforcement)
          </button>
        )}
      </div>
    </div>
  );
}

export function GovernancePanel() {
  const [tab, setTab] = useState<GovernanceTab>("domains");

  return (
    <div>
      <div className="flex gap-4 border-b border-neutral-200 px-4 py-1 text-sm">
        <button
          className={tab === "domains" ? "font-semibold" : "text-neutral-500"}
          onClick={() => setTab("domains")}
        >
          Domains
        </button>
        <button
          className={tab === "dictionary" ? "font-semibold" : "text-neutral-500"}
          onClick={() => setTab("dictionary")}
        >
          Dictionary
        </button>
        <button
          className={tab === "naming" ? "font-semibold" : "text-neutral-500"}
          onClick={() => setTab("naming")}
        >
          Naming Rules
        </button>
      </div>
      {tab === "domains" && <DomainsSection />}
      {tab === "dictionary" && <DictionarySection />}
      {tab === "naming" && <NamingRulesSection />}
    </div>
  );
}
