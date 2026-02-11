import { toast } from 'sonner'

export interface Notebook {
  id: number
  title: string
  description: string | null
  instructions: string | null
  created_at: string
  updated_at: string | null
}

export interface NotebookCreate {
  title: string
  description?: string | null
  instructions?: string | null
}

export interface NotebookUpdate {
  title?: string
  description?: string | null
  instructions?: string | null
}

const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
}

export async function fetchNotebooks(): Promise<Notebook[]> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/notebooks`)
    if (!response.ok) {
      toast.error(`Failed to fetch notebooks: ${response.statusText}`)
      return []
    }
    return response.json()
  } catch {
    toast.error('Error fetching notebooks')
    return []
  }
}

export async function createNotebook(
  data: NotebookCreate
): Promise<Notebook | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/notebooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      toast.error(`Failed to create notebook: ${response.statusText}`)
      return null
    }
    return response.json()
  } catch {
    toast.error('Error creating notebook')
    return null
  }
}

export async function updateNotebook(
  id: number,
  data: NotebookUpdate
): Promise<Notebook | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/notebooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      toast.error(`Failed to update notebook: ${response.statusText}`)
      return null
    }
    return response.json()
  } catch {
    toast.error('Error updating notebook')
    return null
  }
}

export interface NotebookSession {
  session_id: string
  notebook_id: number
  created_at: string
}

export async function fetchNotebookSessions(
  notebookId: number
): Promise<NotebookSession[]> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/api/notebooks/${notebookId}/sessions`
    )
    if (!response.ok) {
      return []
    }
    return response.json()
  } catch {
    return []
  }
}

export async function fetchNotebook(id: number): Promise<Notebook | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/notebooks/${id}`)
    if (!response.ok) {
      return null
    }
    return response.json()
  } catch {
    return null
  }
}

export async function deleteNotebook(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/notebooks/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      toast.error(`Failed to delete notebook: ${response.statusText}`)
      return false
    }
    return true
  } catch {
    toast.error('Error deleting notebook')
    return false
  }
}
