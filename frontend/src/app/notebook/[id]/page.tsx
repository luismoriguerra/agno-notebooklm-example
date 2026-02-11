'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Suspense } from 'react'

import Sidebar from '@/components/chat/Sidebar/Sidebar'
import { ChatArea } from '@/components/chat/ChatArea'
import NotebookHeader from '@/components/notebooks/NotebookHeader'
import { useStore } from '@/store'
import { fetchNotebook } from '@/api/notebooks'

function NotebookChatContent() {
  const params = useParams()
  const notebookId = Number(params.id)
  const { setCurrentNotebook } = useStore()

  const hasEnvToken = !!process.env.NEXT_PUBLIC_OS_SECURITY_KEY
  const envToken = process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''

  useEffect(() => {
    if (!notebookId || isNaN(notebookId)) return

    const loadNotebook = async () => {
      const notebook = await fetchNotebook(notebookId)
      if (notebook) {
        setCurrentNotebook(notebook)
      }
    }
    loadNotebook()

    return () => {
      setCurrentNotebook(null)
    }
  }, [notebookId, setCurrentNotebook])

  return (
    <div className="flex h-screen bg-background/80">
      <Sidebar hasEnvToken={hasEnvToken} envToken={envToken} />
      <div className="flex flex-grow flex-col overflow-hidden">
        <NotebookHeader />
        <ChatArea />
      </div>
    </div>
  )
}

export default function NotebookChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NotebookChatContent />
    </Suspense>
  )
}
