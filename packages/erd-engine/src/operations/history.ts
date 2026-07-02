import type { Model } from "@modelforge/schema-engine";
import type { Operation, Transaction } from "@modelforge/sdk";
import { applyInverse, applyOperation, toDispatchable } from "./apply.js";
import { undoTransaction, redoTransaction } from "./transaction.js";

export type HistoryEntry = Operation | Transaction;

function isTransaction(entry: HistoryEntry): entry is Transaction {
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
}
