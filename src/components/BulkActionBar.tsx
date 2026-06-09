import { Bookmark, BookmarkX, Archive, ArchiveRestore, CheckCheck, RotateCcw, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export type BulkAction = "save" | "unsave" | "archive" | "unarchive" | "replied" | "reset" | "read";
export type BulkFilter = "new" | "saved" | "replied" | "archived" | "all";

export function BulkActionBar({
  count,
  onAction,
  onClear,
  pending,
  filter = "new",
}: {
  count: number;
  onAction: (a: BulkAction) => void;
  onClear: () => void;
  pending?: boolean;
  filter?: BulkFilter;
}) {
  if (count === 0) return null;

  const showSave = filter !== "saved";
  const showUnsave = filter === "saved";
  const showReplied = filter !== "replied";
  const showReset = filter === "replied";
  const showArchive = filter !== "archived";
  const showUnarchive = filter === "archived";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 border border-border bg-card shadow-lg px-2 py-1.5 rounded-full">
      <span className="text-xs font-semibold px-3 text-foreground">
        {count} selected
      </span>
      <div className="h-5 w-px bg-border mx-1" />
      {showSave && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAction("save")} className="gap-1.5 rounded-full">
          <Bookmark className="h-3.5 w-3.5" /> Save
        </Button>
      )}
      {showUnsave && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAction("unsave")} className="gap-1.5 rounded-full">
          <BookmarkX className="h-3.5 w-3.5" /> Unsave
        </Button>
      )}
      {showReplied && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAction("replied")} className="gap-1.5 rounded-full">
          <CheckCheck className="h-3.5 w-3.5" /> Replied
        </Button>
      )}
      {showReset && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAction("reset")} className="gap-1.5 rounded-full">
          <RotateCcw className="h-3.5 w-3.5" /> Mark new
        </Button>
      )}
      {showArchive && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAction("archive")} className="gap-1.5 rounded-full">
          <Archive className="h-3.5 w-3.5" /> Archive
        </Button>
      )}
      {showUnarchive && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAction("unarchive")} className="gap-1.5 rounded-full">
          <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAction("read")} className="gap-1.5 rounded-full">
        <Eye className="h-3.5 w-3.5" /> Mark read
      </Button>
      <div className="h-5 w-px bg-border mx-1" />
      <Button size="sm" variant="ghost" onClick={onClear} className="rounded-full">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
