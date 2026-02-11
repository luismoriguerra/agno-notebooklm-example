'use client'

import { useState, type FC } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import { updateNotebook, type NotebookUpdate } from '@/api/notebooks'
import NotebookFormDialog from './NotebookFormDialog'

const NotebookHeader: FC = () => {
  const router = useRouter()
  const { currentNotebook, setCurrentNotebook } = useStore()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!currentNotebook) return null

  const handleBack = () => {
    router.push('/')
  }

  const handleEditSubmit = async (data: NotebookUpdate) => {
    setIsSubmitting(true)
    try {
      const updated = await updateNotebook(currentNotebook.id, data)
      if (updated) {
        setCurrentNotebook(updated)
        toast.success('Notebook updated')
        setIsEditOpen(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4 text-secondary" />
        </Button>
        <h2 className="truncate font-geist text-sm font-medium text-secondary">
          {currentNotebook.title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 shrink-0"
          onClick={() => setIsEditOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5 text-muted" />
        </Button>
      </div>

      <NotebookFormDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleEditSubmit}
        notebook={currentNotebook}
        isSubmitting={isSubmitting}
      />
    </>
  )
}

export default NotebookHeader
