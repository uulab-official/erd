import type { Model } from "@modelforge/schema-engine";
import type { Operation, Transaction } from "@modelforge/sdk";
import { applyInverse, applyOperation, toDispatchable } from "./apply.js";
import { undoTransaction, redoTransaction } from "./transaction.js";

export type HistoryEntry = Operation | Transaction;

export function isTransaction(entry: HistoryEntry): entry is Transaction {
  return "operations" in entry;
}

// Undo/Redo stack shared by single Operations and compound Transactions alike —
// this is the mechanism History Panel / Ctrl+Z / Ctrl+Shift+Z drive in the UI.
export class OperationHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Oldest first — what a History Panel renders top-to-bottom or bottom-to-top.
  entries(): readonly HistoryEntry[] {
    return [...this.undoStack];
  }

  undo(model: Model): Model {
    const entry = this.undoStack.pop();
    if (!entry) return model;
    this.redoStack.push(entry);
    return isTransaction(entry) ? undoTransaction(model, entry) : applyInverse(model, entry);
  }

  redo(model: Model): Model {
    const entry = this.redoStack.pop();
    if (!entry) return model;
    this.undoStack.push(entry);
    return isTransaction(entry)
      ? redoTransaction(model, entry)
      : applyOperation(model, toDispatchable(entry));
  }

  // Rewinds to just after entries()[index] was applied, i.e. undoes every entry after
  // it. Only rewinds backward — index must point at an entry already in the undo stack
  // (a no-op if it's out of range, so callers can't accidentally skip forward).
  jumpToIndex(model: Model, index: number): Model {
    const targetLength = index + 1;
    if (index < 0 || targetLength > this.undoStack.length) return model;
    let current = model;
    while (this.undoStack.length > targetLength) {
      current = this.undo(current);
    }
    return current;
  }
}
