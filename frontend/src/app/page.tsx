'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import { MoreVertical, Plus, BookOpen, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import NotebookFormDialog from '@/components/notebooks/NotebookFormDialog'
import DeleteNotebookDialog from '@/components/notebooks/DeleteNotebookDialog'

import {
  fetchNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  type Notebook,
  type NotebookCreate,
  type NotebookUpdate
} from '@/api/notebooks'

export default function HomePage() {
  const router = useRouter()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form dialog state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete dialog state
  const [deletingNotebook, setDeletingNotebook] = useState<Notebook | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const loadNotebooks = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchNotebooks()
    setNotebooks(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadNotebooks()
  }, [loadNotebooks])

  // --- Handlers ---

  const handleCreate = () => {
    setEditingNotebook(null)
    setIsFormOpen(true)
  }

  const handleEdit = (notebook: Notebook) => {
    setEditingNotebook(notebook)
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (data: NotebookCreate | NotebookUpdate) => {
    setIsSubmitting(true)
    try {
      if (editingNotebook) {
        const updated = await updateNotebook(editingNotebook.id, data)
        if (updated) {
          toast.success('Notebook updated')
          setIsFormOpen(false)
          loadNotebooks()
        }
      } else {
        const created = await createNotebook(data as NotebookCreate)
        if (created) {
          toast.success('Notebook created')
          setIsFormOpen(false)
          loadNotebooks()
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (notebook: Notebook) => {
    setDeletingNotebook(notebook)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingNotebook) return
    setIsDeleting(true)
    try {
      const success = await deleteNotebook(deletingNotebook.id)
      if (success) {
        toast.success('Notebook deleted')
        setDeletingNotebook(null)
        loadNotebooks()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRowClick = (notebook: Notebook) => {
    router.push(`/notebook/${notebook.id}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background/80">
      {/* Header */}
      <div className="mx-auto w-full max-w-5xl px-6 pt-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-geist text-2xl font-semibold text-primary">
            Recent notebooks
          </h1>
          <Button
            onClick={handleCreate}
            className="rounded-xl font-geist"
            size="default"
          >
            <Plus className="mr-1 h-4 w-4" />
            Create notebook
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-accent/30"
              />
            ))}
          </div>
        ) : notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted" />
            <p className="mb-2 font-geist text-lg text-secondary">
              No notebooks yet
            </p>
            <p className="mb-6 text-sm text-muted">
              Create your first notebook to get started.
            </p>
            <Button
              onClick={handleCreate}
              className="rounded-xl font-geist"
              size="default"
            >
              <Plus className="mr-1 h-4 w-4" />
              Create notebook
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_200px_140px_48px] gap-4 border-b border-border px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                Title
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                Description
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                Created
              </span>
              <span />
            </div>

            {/* Table Rows */}
            {notebooks.map((notebook) => (
              <div
                key={notebook.id}
                onClick={() => handleRowClick(notebook)}
                className="group grid cursor-pointer grid-cols-[1fr_200px_140px_48px] gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/40"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <BookOpen className="h-4 w-4 shrink-0 text-muted" />
                  <span className="truncate font-geist text-sm text-secondary">
                    {notebook.title}
                  </span>
                </div>
                <div className="flex items-center overflow-hidden">
                  <span className="truncate text-sm text-muted">
                    {notebook.description || '--'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-muted">
                    {dayjs(notebook.created_at).format('MMM D, YYYY')}
                  </span>
                </div>
                <div className="flex items-center justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4 text-muted" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-border bg-background"
                    >
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(notebook)
                        }}
                        className="cursor-pointer font-geist text-secondary"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(notebook)
                        }}
                        className="cursor-pointer font-geist text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NotebookFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        notebook={editingNotebook}
        isSubmitting={isSubmitting}
      />

      <DeleteNotebookDialog
        isOpen={!!deletingNotebook}
        onClose={() => setDeletingNotebook(null)}
        onDelete={handleDeleteConfirm}
        isDeleting={isDeleting}
        notebookTitle={deletingNotebook?.title || ''}
      />
    </div>
  )
}
