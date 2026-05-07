import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { createTask } from '../services';

interface QuickAddInputProps {
  dueDate?: string;
  onCreated: () => void;
}

export function QuickAddInput({ dueDate, onCreated }: QuickAddInputProps) {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      await createTask({
        title: trimmed,
        priority: 'medium',
        status: 'todo',
        due_date: dueDate ?? undefined,
      });
      setTitle('');
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aufgabe konnte nicht erstellt werden');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Input
      value={title}
      disabled={isSaving}
      placeholder="Aufgabe hinzufügen..."
      className="h-8 bg-bg-elevated text-xs"
      onChange={(event) => setTitle(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void handleSubmit();
        }
      }}
    />
  );
}
