import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { CalendarIcon, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface BlockedDate {
  id: number;
  date: Date;
  reason?: string;
  timezone: string;
}

interface BlockedDatesProps {
  blockedDates: BlockedDate[];
  onAddBlockedDates: (dates: { date: Date; reason?: string }[]) => Promise<void>;
  onRemoveBlockedDate: (id: number) => Promise<void>;
  onEditBlockedDate?: (id: number, updates: { date: Date; reason?: string }) => Promise<void>;
}

export function BlockedDates({
  blockedDates,
  onAddBlockedDates,
  onRemoveBlockedDate,
  onEditBlockedDate,
}: BlockedDatesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [note, setNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [editingDate, setEditingDate] = useState<BlockedDate | null>(null);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setIsCalendarOpen(false);
  };

  const handleSave = async () => {
    if (!selectedDate) return;

    try {
      setIsAdding(true);
      if (editingDate && onEditBlockedDate) {
        await onEditBlockedDate(editingDate.id, {
          date: selectedDate,
          reason: note,
        });
      } else {
        await onAddBlockedDates([{ date: selectedDate, reason: note }]);
      }
      handleCloseDialog();
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeletingIds((prev) => [...prev, id]);
      await onRemoveBlockedDate(id);
    } finally {
      setDeletingIds((prev) => prev.filter((deleteId) => deleteId !== id));
    }
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingDate(null);
    setSelectedDate(undefined);
    setNote('');
    setIsOpen(true);
  };

  const handleEdit = (blocked: BlockedDate, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingDate(blocked);
    setSelectedDate(blocked.date);
    setNote(blocked.reason || '');
    setIsOpen(true);
  };

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditingDate(null);
    setSelectedDate(undefined);
    setNote('');
  };

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      handleCloseDialog();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {blockedDates.length > 0 ? (
        <div className="divide-y divide-eleva-neutral-200 rounded-lg border border-eleva-neutral-200">
          {blockedDates
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map((blocked) => (
              <div
                key={blocked.id}
                className="hover:bg-eleva-neutral-50 group flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm font-medium text-eleva-neutral-900">
                    {formatInTimeZone(blocked.date, blocked.timezone, 'MMM dd, yyyy')}
                  </span>
                  {blocked.reason && (
                    <span className="text-sm text-eleva-neutral-900/70">{blocked.reason}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleEdit(blocked, e)}
                          className="rounded-full text-eleva-neutral-900/60 opacity-0 transition-opacity hover:bg-eleva-primary/10 hover:text-eleva-primary group-hover:opacity-100"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit blocked date</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(blocked.id)}
                          disabled={deletingIds.includes(blocked.id)}
                          className={cn(
                            'rounded-full opacity-0 transition-opacity group-hover:opacity-100',
                            'text-eleva-neutral-900/60 hover:bg-eleva-highlight-red/10 hover:text-eleva-highlight-red',
                            deletingIds.includes(blocked.id) && 'cursor-not-allowed opacity-50',
                          )}
                        >
                          {deletingIds.includes(blocked.id) ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete blocked date</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <p className="text-sm text-eleva-neutral-900/60">No blocked dates added yet.</p>
      )}

      <Dialog open={isOpen} onOpenChange={handleDialogChange}>
        <Button
          variant="outline"
          onClick={(e) => handleAdd(e)}
          className="w-fit gap-2 rounded-md border-eleva-primary-light text-eleva-primary transition-colors hover:bg-eleva-primary-light hover:text-white"
        >
          <Plus className="size-4" />
          Add blockout date
        </Button>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingDate ? 'Edit blockout date' : 'Select blockout date'}</DialogTitle>
            <DialogDescription>
              {editingDate
                ? 'Update the date or note for this blocked time'
                : 'Choose a date and add an optional note to block it out from your schedule'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-eleva-neutral-900">Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'h-10 w-full justify-start rounded border-eleva-neutral-200 text-left font-normal',
                      !selectedDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {selectedDate ? (
                      <span className="font-mono text-sm">
                        {format(selectedDate, 'MMM dd, yyyy')}
                      </span>
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    classNames={{
                      months: 'sm:space-x-0',
                      month_caption: 'flex justify-between items-center pt-1 pb-2 relative',
                      caption_label: 'text-sm font-medium pl-2',
                      nav: 'space-x-1 flex items-center absolute right-4 z-10',
                      button_previous:
                        'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded border border-eleva-neutral-200',
                      button_next:
                        'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded border border-eleva-neutral-200',
                    }}
                    disabled={(date) =>
                      blockedDates.some((blocked) => {
                        if (editingDate && editingDate.id === blocked.id) return false;
                        const calendarDateInTz = toZonedTime(date, blocked.timezone);
                        const blockedDateInTz = toZonedTime(blocked.date, blocked.timezone);

                        return (
                          formatInTimeZone(calendarDateInTz, blocked.timezone, 'yyyy-MM-dd') ===
                          formatInTimeZone(blockedDateInTz, blocked.timezone, 'yyyy-MM-dd')
                        );
                      })
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-eleva-neutral-900">Note (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note for this blocked date..."
                className="h-10 rounded border-eleva-neutral-200 focus:border-eleva-primary focus:ring-eleva-primary/20"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isAdding}
              className="rounded border-eleva-neutral-200 text-eleva-neutral-900 transition-colors hover:bg-eleva-neutral-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedDate || isAdding}
              className={cn(
                'min-w-[100px] rounded-lg font-medium transition-all',
                'bg-eleva-primary text-white hover:bg-eleva-primary/90',
                'focus:ring-2 focus:ring-eleva-primary/50 focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {editingDate ? 'Updating...' : 'Adding...'}
                </>
              ) : editingDate ? (
                'Update date'
              ) : (
                'Add date'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
