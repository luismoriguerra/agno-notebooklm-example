'use client'

import { useState, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Notebook, NotebookCreate, NotebookUpdate } from '@/api/notebooks'

interface NotebookFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: NotebookCreate | NotebookUpdate) => Promise<void>
  notebook?: Notebook | null
  isSubmitting: boolean
}

const NotebookFormDialog: FC<NotebookFormDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  notebook,
  isSubmitting
}) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')

  const isEditing = !!notebook

  useEffect(() => {
    if (notebook) {
      setTitle(notebook.title)
      setDescription(notebook.description || '')
      setInstructions(notebook.instructions || '')
    } else {
      setTitle('')
      setDescription('')
      setInstructions('')
    }
  }, [notebook, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit({
      title: title || 'Untitled notebook',
      description: description || null,
      instructions: instructions || null
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="font-geist max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit notebook' : 'Create notebook'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your notebook details.'
              : 'Create a new notebook to start researching and analyzing documents.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm text-secondary">
              Title
            </Label>
            <Input
              id="title"
              placeholder="Untitled notebook"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border-border bg-background text-secondary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm text-secondary">
              Description
            </Label>
            <textarea
              id="description"
              placeholder="What is this notebook about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-secondary placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions" className="text-sm text-secondary">
              Instructions
            </Label>
            <textarea
              id="instructions"
              placeholder="Custom instructions for the AI agents..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-secondary placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-border font-geist"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-geist"
            >
              {isSubmitting
                ? isEditing
                  ? 'Saving...'
                  : 'Creating...'
                : isEditing
                  ? 'Save changes'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default NotebookFormDialog
